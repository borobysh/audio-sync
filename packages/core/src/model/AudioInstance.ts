import { Engine } from './Engine';
import { Driver } from './Driver';
import { EventEmitter } from "./EventEmitter";
import { AudioState } from "./types/engine.types";
import { AudioEvent, LeadershipAction, SyncConfig, SyncCoreState } from "./types/syncCore.types";
import { AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG } from "../config/sync.config";
import { DEFAULT_PLAYER_STATE } from "../config/engine.config";

const DEBUG = true;
const log = (instanceId: string, ...args: any[]) => {
    if (DEBUG) {
        console.log(`[Sync:${instanceId.slice(0, 4)}]`, ...args);
    }
};

/**
 * Calculates latency-adjusted playback time.
 * If playing, adds latency compensation. Otherwise returns raw time or fallback.
 */
const calculateAdjustedTime = (
    currentTime: number | undefined,
    isPlaying: boolean | undefined,
    latencySeconds: number,
    fallback: number = 0
): number => {
    const isValidTime = typeof currentTime === 'number' && isFinite(currentTime);

    if (!isValidTime) {
        return fallback;
    }

    return isPlaying ? currentTime + latencySeconds : currentTime;
};

/**
 * Pending action to execute after leadership handshake
 */
type PendingAction = {
    action: LeadershipAction;
    src?: string;
    seekTime?: number;
};

/**
 * AudioInstance - The main entry point of the library.
 */
export class AudioInstance extends EventEmitter {
    private readonly _engine: Engine;
    private readonly _driver: Driver;
    private readonly _channel: BroadcastChannel;
    private _config: Required<SyncConfig>;

    private readonly _instanceId: string;
    private _isLeader: boolean = false;
    private _isProcessingRemoteEvent: boolean = false;
    private _syncIntervalId: ReturnType<typeof setInterval> | null = null;

    // Leadership handshake state
    private _pendingAction: PendingAction | null = null;
    private _handshakeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _isClaimingLeadership: boolean = false;

    constructor(channelName: string = 'audio_sync_v1', config: SyncConfig = {}) {
        super();
        this._instanceId = Math.random().toString(36).substring(2, 11);
        this._config = { ...AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG, ...config };

        this._engine = new Engine();
        this._driver = new Driver(this._engine);
        this._channel = new BroadcastChannel(channelName);

        this._initCoreListeners();
        this._initBroadcastListeners();
        this._initPeriodicSync();

        log(this._instanceId, '🚀 Instance created, sending SYNC_REQUEST');
        this._broadcast({ type: 'SYNC_REQUEST', payload: {}, timestamp: Date.now(), instanceId: this._instanceId });
    }

    /**
     * Provides access to the underlying engine.
     * Use this to access the state or lower-level engine events.
     */
    public get engine(): Engine {
        return this._engine;
    }

    /**
     * Provides access to the audio driver.
     * * @warning Direct manipulation of the driver (e.g. calling driver.play() manually)
     * might bypass the synchronization logic if not handled carefully.
     * Use it only for specific low-level tasks.
     */
    public get driver(): Driver {
        return this._driver;
    }

    /**
     * Returns the unique ID for this specific tab/instance.
     */
    public get instanceId(): string {
        return this._instanceId;
    }

    /**
     * Returns the current consolidated state of the player.
     */
    public get state(): SyncCoreState {
        return {
            ...this._engine.state,
            isLeader: this._isLeader
        };
    }

    /**
     * Internal check to see if a specific action type is allowed to be synced.
     */
    private _isSyncAllowed(type: AudioEvent['type']): boolean {
        switch (type) {
            case 'PLAY':
                return this._config.syncPlay;
            case 'PAUSE':
                return this._config.syncPause;
            case 'STATE_UPDATE':
                return this._config.syncSeek || this._config.syncTrackChange;
            default:
                return true;
        }
    }

    /**
     * Initializes listeners for local engine changes.
     */
    private _initCoreListeners() {
        let previousSrc: string | null = null;

        this._engine.on('state_change', () => {
            const state = this.state;
            this.emit(state);

            this._emitEvent('timeUpdate', {
                currentTime: state.currentTime,
                duration: state.duration
            });

            if (state.currentSrc !== previousSrc) {
                this._emitEvent('trackChange', {
                    src: state.currentSrc,
                    previousSrc
                });
                previousSrc = state.currentSrc;
            }
        });

        const broadcastLocalAction = (type: AudioEvent['type']) => {
            // Don't broadcast if we're processing a remote event to prevent circular updates
            if (this._isProcessingRemoteEvent) {
                log(this._instanceId, `⏭️ Skipping broadcast ${type} - processing remote event`);
                return;
            }

            if (!this._isSyncAllowed(type)) {
                log(this._instanceId, `⏭️ Skipping broadcast ${type} - sync not allowed`);
                return;
            }

            // Local user interaction makes this instance the Leader
            const wasLeader = this._isLeader;
            this._isLeader = true;

            // Emit leaderChange if we became the leader
            if (!wasLeader && this._isLeader) {
                log(this._instanceId, `👑 Became leader`);
                this._emitEvent('leaderChange', { isLeader: true });
            }

            log(this._instanceId, `📤 Broadcasting ${type}`, {
                wasLeader,
                isLeader: this._isLeader,
                isPlaying: this._engine.state.isPlaying,
                currentSrc: this._engine.state.currentSrc?.slice(-20),
                currentTime: this._engine.state.currentTime.toFixed(2)
            });

            this._broadcast({
                type,
                payload: {
                    ...this._engine.state,
                    isLeader: true
                },
                timestamp: Date.now(),
                instanceId: this._instanceId
            });
        };

        // Engine events -> broadcast + emit specific events
        this._engine.on('play', () => {
            broadcastLocalAction('PLAY');
            this._emitEvent('play', { src: this._engine.state.currentSrc });
        });

        this._engine.on('pause', () => {
            broadcastLocalAction('PAUSE');
            this._emitEvent('pause', undefined);
        });

        this._engine.on('stop', () => {
            this._emitEvent('stop', undefined);
        });

        this._engine.on('seek', () => {
            broadcastLocalAction('STATE_UPDATE');
            this._emitEvent('seek', { time: this._engine.state.currentTime });
        });

        this._engine.on('ended', () => {
            this._emitEvent('ended', undefined);
        });

        this._engine.on('error', () => {
            const error = this._engine.state.error;
            if (error) {
                this._emitEvent('error', error);
            }
        });
    }

    /**
     * Initializes periodic sync timer for leader to broadcast current time.
     */
    private _initPeriodicSync() {
        if (this._config.syncInterval <= 0) {
            log(this._instanceId, '⏭️ Periodic sync disabled (syncInterval <= 0)');
            return;
        }

        this._syncIntervalId = setInterval(() => {
            // Only sync if we're the leader and playing
            if (this._isLeader && this._engine.state.isPlaying) {
                log(this._instanceId, `⏱️ Periodic sync: time=${this._engine.state.currentTime.toFixed(2)}`);
                this._broadcast({
                    type: 'STATE_UPDATE',
                    payload: {
                        ...this._engine.state,
                        isLeader: true
                    },
                    timestamp: Date.now(),
                    instanceId: this._instanceId
                });
            }
        }, this._config.syncInterval);
    }

    /**
     * Stops periodic sync timer.
     */
    private _stopPeriodicSync() {
        if (this._syncIntervalId) {
            clearInterval(this._syncIntervalId);
            this._syncIntervalId = null;
        }
    }

    /**
     * Initiates the leadership handshake.
     * Sends LEADERSHIP_CLAIM and waits for other tabs to acknowledge.
     */
    private _claimLeadership(action: PendingAction) {
        // If we're already the leader and not in singlePlayback mode, execute immediately
        if (this._isLeader && !this._config.singlePlayback) {
            this._executeAction(action);
            return;
        }

        // If we're already claiming leadership, queue the new action
        if (this._isClaimingLeadership) {
            log(this._instanceId, `⏳ Already claiming leadership, updating pending action`);
            this._pendingAction = action;
            return;
        }

        // If we're already the leader in singlePlayback mode, execute immediately
        // no need for handshake, we already have leadership
        if (this._isLeader) {
            this._executeAction(action);
            return;
        }

        log(this._instanceId, `🤝 Starting leadership handshake for action: ${action.action}`);

        this._isClaimingLeadership = true;
        this._pendingAction = action;

        // Send LEADERSHIP_CLAIM to all other tabs
        this._broadcast({
            type: 'LEADERSHIP_CLAIM',
            payload: {
                action: action.action,
                src: action.src,
                seekTime: action.seekTime,
                isLeader: true
            },
            timestamp: Date.now(),
            instanceId: this._instanceId
        });

        // Set timeout - after this we become leader regardless of ACKs
        this._handshakeTimeoutId = setTimeout(() => {
            this._completeLeadershipHandshake();
        }, this._config.leadershipHandshakeTimeout);
    }

    /**
     * Called when we receive ACK from another tab (or when timeout expires).
     * Completes the handshake and executes the pending action.
     */
    private _completeLeadershipHandshake() {
        if (!this._isClaimingLeadership) {
            return;
        }

        if (this._handshakeTimeoutId) {
            clearTimeout(this._handshakeTimeoutId);
            this._handshakeTimeoutId = null;
        }

        log(this._instanceId, `✅ Leadership handshake complete, becoming leader`);

        const wasLeader = this._isLeader;
        this._isLeader = true;
        this._isClaimingLeadership = false;

        if (!wasLeader) {
            this._emitEvent('leaderChange', { isLeader: true });
        }

        if (this._pendingAction) {
            const action = this._pendingAction;
            this._pendingAction = null;
            this._executeAction(action);
        }
    }

    /**
     * Executes the actual action after leadership is confirmed.
     */
    private _executeAction(action: PendingAction) {
        log(this._instanceId, `▶️ Executing action: ${action.action}`, {
            src: action.src?.slice(-20),
            seekTime: action.seekTime
        });

        switch (action.action) {
            case 'play':
                this._driver.play(action.src);
                break;
            case 'pause':
                this._driver.pause();
                break;
            case 'seek':
                if (typeof action.seekTime === 'number') {
                    this._driver.seek(action.seekTime);
                }
                break;
            case 'stop':
                this._driver.stop();
                break;
        }
    }

    /**
     * Listens for messages from other tabs via BroadcastChannel.
     */
    private _initBroadcastListeners() {
        this._channel.onmessage = (event: MessageEvent<AudioEvent>) => {
            const { type, payload, timestamp, instanceId } = event.data;

            // Ignore our own messages to prevent circular updates
            if (instanceId === this._instanceId) {
                log(this._instanceId, `⏭️ Ignoring own message ${type}`);
                return;
            }

            log(this._instanceId, `📥 Received ${type} from ${instanceId?.slice(0, 4)}`, {
                payloadIsLeader: payload.isLeader,
                payloadIsPlaying: payload.isPlaying,
                payloadSrc: payload.currentSrc?.slice(-20),
                payloadTime: payload.currentTime?.toFixed(2),
                myIsLeader: this._isLeader,
                myIsPlaying: this._engine.state.isPlaying
            });

            this._isProcessingRemoteEvent = true;

            try {
                if (type === 'LEADERSHIP_CLAIM') {
                    this._handleLeadershipClaim(instanceId || '');
                    return;
                }

                if (type === 'LEADERSHIP_ACK') {
                    this._handleLeadershipAck(instanceId || '');
                    return;
                }

                // If someone else becomes the leader, we remove the crown
                // and stop the real playback (if singlePlayback)
                if (['PLAY', 'PAUSE', 'STATE_UPDATE'].includes(type) && payload.isLeader) {
                    if (this._isLeader) {
                        log(this._instanceId, `👑➡️ Giving up leadership to ${instanceId?.slice(0, 4)}`);
                        this._isLeader = false;

                        this._emitEvent('leaderChange', { isLeader: false });

                        // If singlePlayback is enabled, stop real audio playback SILENTLY
                        // because only the new leader should play audio
                        if (this._config.singlePlayback && this._engine.state.isPlaying) {
                            log(this._instanceId, `🔇 Stopping real playback silently (singlePlayback mode)`);
                            this._driver.pauseSilently();
                        }
                    }
                }

                this._handleRemoteEvent(type, payload, timestamp);
            } finally {
                this._isProcessingRemoteEvent = false;
            }
        };
    }

    /**
     * Handles LEADERSHIP_CLAIM from another tab.
     * Stops playback immediately and sends ACK.
     */
    private _handleLeadershipClaim(claimerId: string) {
        log(this._instanceId, `🤝 Received LEADERSHIP_CLAIM from ${claimerId.slice(0, 4)}`);

        if (this._isClaimingLeadership) {
            log(this._instanceId, `❌ Cancelling our own leadership claim`);
            if (this._handshakeTimeoutId) {
                clearTimeout(this._handshakeTimeoutId);
                this._handshakeTimeoutId = null;
            }
            this._isClaimingLeadership = false;
            this._pendingAction = null;
        }

        if (this._isLeader) {
            log(this._instanceId, `👑➡️ Giving up leadership to ${claimerId.slice(0, 4)}`);
            this._isLeader = false;
            this._emitEvent('leaderChange', { isLeader: false });
        }

        // Stop real playback immediately (BEFORE sending ACK)
        if (this._config.singlePlayback) {
            log(this._instanceId, `🔇 Stopping playback immediately (handshake)`);
            this._driver.pauseSilently();
        }

        // Send ACK to confirm we`ve stopped
        log(this._instanceId, `✅ Sending LEADERSHIP_ACK to ${claimerId.slice(0, 4)}`);
        this._broadcast({
            type: 'LEADERSHIP_ACK',
            payload: {},
            timestamp: Date.now(),
            instanceId: this._instanceId
        });
    }

    /**
     * Handles LEADERSHIP_ACK from another tab.
     * Can complete handshake early if all tabs have acknowledged.
     */
    private _handleLeadershipAck(ackerId: string) {
        log(this._instanceId, `✅ Received LEADERSHIP_ACK from ${ackerId.slice(0, 4)}`);

        // TODO For now, we still wait for timeout to ensure all tabs have time to ACK.
        // In a more advanced implementation, we could track known tabs and complete
        // handshake early when all have acknowledged.

        // Optional: Complete handshake immediately on first ACK for faster response
        // this._completeLeadershipHandshake();
    }

    /**
     * Handles incoming remote synchronization events.
     */
    private _handleRemoteEvent(type: AudioEvent['type'], payload: Partial<SyncCoreState>, timestamp: number) {
        if (!this._isSyncAllowed(type)) {
            log(this._instanceId, `⏭️ Skipping remote ${type} - sync not allowed`);
            return;
        }

        switch (type) {
            case 'PLAY':
                log(this._instanceId, `🎵 Handling remote PLAY`, {
                    myIsPlaying: this._engine.state.isPlaying,
                    mySrc: this._engine.state.currentSrc?.slice(-20),
                    payloadSrc: payload.currentSrc?.slice(-20),
                    singlePlayback: this._config.singlePlayback,
                    syncTrackChange: this._config.syncTrackChange,
                    syncSeek: this._config.syncSeek
                });

                const latency = (Date.now() - timestamp) / 1000;
                const adjustedTime = calculateAdjustedTime(payload.currentTime, payload.isPlaying, latency, 0);

                if (this._config.singlePlayback) {
                    // SINGLE PLAYBACK MODE: Only update isPlaying state, don't play audio
                    // Respect syncTrackChange and syncSeek flags - don't overwrite local state if disabled
                    log(this._instanceId, `📊 Syncing state only (singlePlayback mode)`);

                    const stateUpdate: Partial<AudioState> = {
                        isPlaying: false
                    };

                    if (this._config.syncTrackChange) {
                        stateUpdate.currentSrc = payload.currentSrc || null;
                        stateUpdate.duration = payload.duration || 0;
                    }

                    if (this._config.syncSeek) {
                        stateUpdate.currentTime = isFinite(adjustedTime) ? adjustedTime : 0;
                    }

                    this._engine.setSyncState(stateUpdate);
                } else {
                    // MULTI PLAYBACK MODE: Actually play audio
                    const isSourceChanging = payload.currentSrc && payload.currentSrc !== this._engine.state.currentSrc;

                    if (isSourceChanging) {
                        log(this._instanceId, `🔄 Source changing, playing new track`);
                        this._driver.play(payload.currentSrc || undefined);

                        if (isFinite(adjustedTime) && adjustedTime >= 0) {
                            this._driver.seekWhenReady(adjustedTime);
                        }
                    } else {
                        log(this._instanceId, `▶️ Same source, syncing time and playing`);
                        this._syncTime(payload, timestamp);
                        this._driver.play(payload.currentSrc || undefined);
                    }
                }
                break;

            case 'PAUSE':
                log(this._instanceId, `⏸️ Handling remote PAUSE`, { singlePlayback: this._config.singlePlayback });

                if (this._config.singlePlayback) {
                    // SINGLE PLAYBACK MODE: Only update isPlaying if syncPause is enabled
                    // Don't touch local track/time state
                    if (this._config.syncPause) {
                        log(this._instanceId, `📊 Syncing pause state only (singlePlayback mode)`);
                        this._engine.setSyncState({ isPlaying: false });
                    }
                } else {
                    // MULTI PLAYBACK MODE: Actually pause audio
                    this._driver.pause();
                }
                break;

            case 'STATE_UPDATE':
                const isTrackChanging = payload.currentSrc !== this._engine.state.currentSrc;

                log(this._instanceId, `📊 Handling remote STATE_UPDATE`, {
                    isTrackChanging,
                    payloadIsPlaying: payload.isPlaying,
                    myIsPlaying: this._engine.state.isPlaying,
                    singlePlayback: this._config.singlePlayback
                });

                if (isTrackChanging && !this._config.syncTrackChange) {
                    log(this._instanceId, `⏭️ Track change sync disabled`);
                    return;
                }

                if (!isTrackChanging && !this._config.syncSeek) {
                    log(this._instanceId, `⏭️ Seek sync disabled`);
                    return;
                }

                const stateLatency = (Date.now() - timestamp) / 1000;
                const stateAdjustedTime = calculateAdjustedTime(
                    payload.currentTime,
                    payload.isPlaying,
                    stateLatency,
                    this._engine.state.currentTime
                );

                if (this._config.singlePlayback) {
                    // SINGLE PLAYBACK MODE: Only update state
                    log(this._instanceId, `📊 Syncing state only (singlePlayback mode)`);
                    this._engine.setSyncState({
                        isPlaying: payload.isPlaying ?? this._engine.state.isPlaying,
                        currentSrc: payload.currentSrc ?? this._engine.state.currentSrc,
                        currentTime: isFinite(stateAdjustedTime) ? stateAdjustedTime : this._engine.state.currentTime,
                        duration: payload.duration ?? this._engine.state.duration
                    });
                } else {
                    // MULTI PLAYBACK MODE: Actually control audio
                    this._syncTime(payload, timestamp);

                    if (payload.isPlaying && !this._engine.state.isPlaying) {
                        log(this._instanceId, `▶️ Starting playback from STATE_UPDATE`);
                        this._driver.play(payload.currentSrc || undefined);
                    } else if (!payload.isPlaying && this._engine.state.isPlaying) {
                        log(this._instanceId, `⏸️ Pausing from STATE_UPDATE`);
                        this._driver.pause();
                    } else if (isTrackChanging && payload.isPlaying) {
                        log(this._instanceId, `🔄 Track changed and should play`);
                        this._driver.play(payload.currentSrc || undefined);
                    }
                }
                break;

            case 'SYNC_REQUEST':
                log(this._instanceId, `🔄 Handling SYNC_REQUEST, isLeader: ${this._isLeader}`);
                if (this._isLeader) {
                    log(this._instanceId, `📤 Responding to SYNC_REQUEST with current state`);
                    this._broadcast({
                        type: 'STATE_UPDATE',
                        payload: {
                            ...this._engine.state,
                            isLeader: true
                        },
                        timestamp: Date.now(),
                        instanceId: this._instanceId
                    });
                }
                break;
        }
    }

    /**
     * Logic for latency compensation.
     * Adjusts the current time based on network delay.
     */
    private _syncTime(payload: Partial<AudioState>, sentAt: number) {
        if (typeof payload.currentTime !== 'number' || !isFinite(payload.currentTime)) {
            log(this._instanceId, `⏭️ syncTime: invalid currentTime`, payload.currentTime);
            return;
        }

        const latency = (Date.now() - sentAt) / 1000;
        const adjustedTime = payload.isPlaying ? payload.currentTime + latency : payload.currentTime;

        if (!isFinite(adjustedTime) || adjustedTime < 0) {
            log(this._instanceId, `⏭️ syncTime: invalid adjustedTime`, adjustedTime);
            return;
        }

        const diff = Math.abs(this._engine.state.currentTime - adjustedTime);

        log(this._instanceId, `⏱️ syncTime: diff=${diff.toFixed(2)}, adjusted=${adjustedTime.toFixed(2)}, current=${this._engine.state.currentTime.toFixed(2)}`);

        // 300ms threshold prevents micro-stutters during playback
        if (diff > 0.3) {
            log(this._instanceId, `⏱️ Seeking to ${adjustedTime.toFixed(2)}`);
            this._driver.seek(adjustedTime);
        } else {
            log(this._instanceId, `⏭️ syncTime: diff too small, skipping seek`);
        }
    }

    /**
     * Sends a message to the broadcast channel.
     */
    private _broadcast(event: AudioEvent) {
        log(this._instanceId, `📡 Sending ${event.type}`, {
            isLeader: event.payload.isLeader,
            isPlaying: event.payload.isPlaying,
            src: event.payload.currentSrc?.slice(-20)
        });
        this._channel.postMessage(event);
    }

    // --- Public API ---

    /**
     * Starts playback.
     * In singlePlayback mode, initiates leadership handshake first.
     * @param src Optional source URL to load.
     */
    public play(src?: string) {
        if (this._config.singlePlayback) {
            this._claimLeadership({ action: 'play', src });
        } else {
            this._driver.play(src);
        }
    }

    /**
     * Pauses playback.
     * In singlePlayback mode, initiates leadership handshake first.
     */
    public pause() {
        if (this._config.singlePlayback) {
            this._claimLeadership({ action: 'pause' });
        } else {
            this._driver.pause();
        }
    }

    /**
     * Seeks to a specific time.
     * In singlePlayback mode, initiates leadership handshake first.
     * @param time Time in seconds.
     */
    public seek(time: number) {
        if (this._config.singlePlayback) {
            this._claimLeadership({ action: 'seek', seekTime: time });
        } else {
            this._driver.seek(time);
        }
    }

    /**
     * Sets the local volume level.
     * @param value Volume from 0.0 to 1.0.
     */
    public setVolume(value: number) {
        this._driver.setVolume(value);
    }

    /**
     * Stops playback and resets time to 0.
     * In singlePlayback mode, initiates leadership handshake first.
     */
    public stop() {
        if (this._config.singlePlayback) {
            this._claimLeadership({ action: 'stop' });
        } else {
            this._driver.stop();
        }
    }

    /**
     * Mutes audio output.
     */
    public mute() {
        this._driver.mute();
    }

    /**
     * Unmutes audio output.
     */
    public unmute() {
        this._driver.unmute();
    }

    /**
     * Toggles mute state.
     */
    public toggleMute() {
        this._driver.toggleMute();
    }

    /**
     * Returns true if this instance is currently the leader.
     */
    public get isLeader() {
        return this._isLeader;
    }

    /**
     * Closes the broadcast channel and stops playback.
     */
    public destroy() {
        if (this._handshakeTimeoutId) {
            clearTimeout(this._handshakeTimeoutId);
            this._handshakeTimeoutId = null;
        }
        this._stopPeriodicSync();
        this._channel.close();
        this._driver.stop();

        this._engine.setSyncState(DEFAULT_PLAYER_STATE);

        this._isLeader = false;
    }
}