import { Engine } from './Engine';
import { Driver } from './Driver';
import { EventEmitter } from "./EventEmitter";
import { AudioState } from "./types/engine.types";
import { AudioEvent, SyncConfig, SyncCoreState } from "./types/syncCore.types";
import { AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG } from "../config/sync.config";
import { DEFAULT_PLAYER_STATE } from "../config/engine.config";
import { LatencyCompensator } from "./sync/LatencyCompensator";
import { PendingAction, SyncCoordinator } from "./sync/SyncCoordinator";

const DEBUG = true;
const log = (instanceId: string, ...args: any[]) => {
    if (DEBUG) {
        console.log(`[Sync:${instanceId.slice(0, 4)}]`, ...args);
    }
};

/**
 * AudioInstance - The main entry point of the library.
 * Now acts as a manager coordinating the engine, driver, and synchronization.
 */
export class AudioInstance extends EventEmitter {
    private readonly _engine: Engine;
    private readonly _driver: Driver;
    private readonly _coordinator: SyncCoordinator;
    private readonly _config: Required<SyncConfig>;
    private readonly _instanceId: string;
    
    private _syncIntervalId: ReturnType<typeof setInterval> | null = null;

    constructor(channelName: string = 'audio_sync_v1', config: SyncConfig = {}) {
        super();
        this._instanceId = Math.random().toString(36).substring(2, 11);
        this._config = { ...AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG, ...config };

        this._engine = new Engine();
        this._driver = new Driver(this._engine);
        
        this._coordinator = new SyncCoordinator(
            this._instanceId,
            channelName,
            this._config,
            {
                onRemoteEvent: (type, payload, timestamp) => this._handleRemoteEvent(type, payload, timestamp),
                onLeadershipChange: (isLeader) => {
                    log(this._instanceId, isLeader ? '👑 Became leader' : '👑➡️ Giving up leadership');
                    this._emitEvent('leaderChange', { isLeader });
                    
                    // If singlePlayback is enabled and we lost leadership while playing, stop audio
                    if (!isLeader && this._config.singlePlayback && this._engine.state.isPlaying) {
                        log(this._instanceId, `🔇 Stopping real playback (lost leadership)`);
                        this._driver.pauseSilently();
                    }
                },
                onSyncRequest: () => {
                    if (this._coordinator.isLeader) {
                        this._broadcastState('STATE_UPDATE');
                    }
                }
            }
        );

        this._initCoreListeners();
        this._initPeriodicSync();

        log(this._instanceId, '🚀 Instance created, sending SYNC_REQUEST');
        this._coordinator.broadcast('SYNC_REQUEST', {});
    }

    // --- Accessors ---

    public get engine(): Engine { return this._engine; }
    public get driver(): Driver { return this._driver; }
    public get instanceId(): string { return this._instanceId; }
    public get state(): SyncCoreState {
        return {
            ...this._engine.state,
            isLeader: this._coordinator.isLeader
        };
    }
    public get isLeader(): boolean {
        return this._coordinator.isLeader;
    }

    // --- Private Methods ---

    private _isSyncAllowed(type: AudioEvent['type']): boolean {
        switch (type) {
            case 'PLAY': return this._config.syncPlay;
            case 'PAUSE': return this._config.syncPause;
            case 'STATE_UPDATE': return this._config.syncSeek || this._config.syncTrackChange;
            default: return true;
        }
    }

    private _initCoreListeners() {
        let previousSrc: string | null = null;

        this._engine.on('state_change', () => {
            const state = this.state;
            this.emit(state);
            this._emitEvent('timeUpdate', { currentTime: state.currentTime, duration: state.duration });

            if (state.currentSrc !== previousSrc) {
                this._emitEvent('trackChange', { src: state.currentSrc, previousSrc });
                previousSrc = state.currentSrc;
            }
        });

        const broadcastLocalAction = (type: AudioEvent['type']) => {
            if (this._coordinator.isProcessingRemoteEvent || !this._isSyncAllowed(type)) return;

            this._coordinator.setLeader(true);
            this._broadcastState(type);
        };

        this._engine.on('play', () => { broadcastLocalAction('PLAY'); this._emitEvent('play', { src: this._engine.state.currentSrc }); });
        this._engine.on('pause', () => { broadcastLocalAction('PAUSE'); this._emitEvent('pause', undefined); });
        this._engine.on('stop', () => this._emitEvent('stop', undefined));
        this._engine.on('seek', () => { broadcastLocalAction('STATE_UPDATE'); this._emitEvent('seek', { time: this._engine.state.currentTime }); });
        this._engine.on('ended', () => this._emitEvent('ended', undefined));
        this._engine.on('error', () => {
            const error = this._engine.state.error;
            if (error) this._emitEvent('error', error);
        });
    }

    private _broadcastState(type: AudioEvent['type']) {
        this._coordinator.broadcast(type, {
            ...this._engine.state,
            isLeader: true
        });
    }

    private _initPeriodicSync() {
        if (this._config.syncInterval <= 0) return;
        this._syncIntervalId = setInterval(() => {
            if (this._coordinator.isLeader && this._engine.state.isPlaying) {
                this._broadcastState('STATE_UPDATE');
            }
        }, this._config.syncInterval);
    }

    private _stopPeriodicSync() {
        if (this._syncIntervalId) {
            clearInterval(this._syncIntervalId);
            this._syncIntervalId = null;
        }
    }

    private _handleRemoteEvent(type: AudioEvent['type'], payload: Partial<SyncCoreState>, timestamp: number) {
        if (!this._isSyncAllowed(type)) return;

        const latency = (Date.now() - timestamp) / 1000;

        switch (type) {
            case 'PLAY':
                const adjustedTime = LatencyCompensator.calculateAdjustedTime(payload.currentTime, payload.isPlaying, latency, 0);
                if (this._config.singlePlayback) {
                    this._engine.setSyncState({
                        isPlaying: false,
                        currentSrc: this._config.syncTrackChange ? (payload.currentSrc || null) : this._engine.state.currentSrc,
                        duration: this._config.syncTrackChange ? (payload.duration || 0) : this._engine.state.duration,
                        currentTime: this._config.syncSeek ? (isFinite(adjustedTime) ? adjustedTime : 0) : this._engine.state.currentTime
                    });
                } else {
                    const isSourceChanging = payload.currentSrc && payload.currentSrc !== this._engine.state.currentSrc;
                    if (isSourceChanging) {
                        this._driver.play(payload.currentSrc || undefined);
                        if (isFinite(adjustedTime) && adjustedTime >= 0) this._driver.seekWhenReady(adjustedTime);
                    } else {
                        this._syncTime(payload, timestamp);
                        this._driver.play(payload.currentSrc || undefined);
                    }
                }
                break;

            case 'PAUSE':
                if (this._config.singlePlayback) {
                    if (this._config.syncPause) this._engine.setSyncState({ isPlaying: false });
                } else {
                    this._driver.pause();
                }
                break;

            case 'STATE_UPDATE':
                const isTrackChanging = payload.currentSrc !== this._engine.state.currentSrc;
                if ((isTrackChanging && !this._config.syncTrackChange) || (!isTrackChanging && !this._config.syncSeek)) return;

                const stateAdjustedTime = LatencyCompensator.calculateAdjustedTime(
                    payload.currentTime,
                    payload.isPlaying,
                    latency,
                    this._engine.state.currentTime
                );

                if (this._config.singlePlayback) {
                    this._engine.setSyncState({
                        isPlaying: payload.isPlaying ?? this._engine.state.isPlaying,
                        currentSrc: payload.currentSrc ?? this._engine.state.currentSrc,
                        currentTime: isFinite(stateAdjustedTime) ? stateAdjustedTime : this._engine.state.currentTime,
                        duration: payload.duration ?? this._engine.state.duration
                    });
                } else {
                    this._syncTime(payload, timestamp);
                    if (payload.isPlaying && !this._engine.state.isPlaying) {
                        this._driver.play(payload.currentSrc || undefined);
                    } else if (!payload.isPlaying && this._engine.state.isPlaying) {
                        this._driver.pause();
                    } else if (isTrackChanging && payload.isPlaying) {
                        this._driver.play(payload.currentSrc || undefined);
                    }
                }
                break;
        }
    }

    private _syncTime(payload: Partial<AudioState>, sentAt: number) {
        if (typeof payload.currentTime !== 'number' || !isFinite(payload.currentTime)) return;

        const latency = (Date.now() - sentAt) / 1000;
        const adjustedTime = LatencyCompensator.calculateAdjustedTime(payload.currentTime, payload.isPlaying, latency);

        if (!isFinite(adjustedTime) || adjustedTime < 0) return;

        const diff = Math.abs(this._engine.state.currentTime - adjustedTime);

        // 300ms threshold prevents micro-stutters during playback
        if (diff > 0.3) {
            log(this._instanceId, `⏱️ Seeking to ${adjustedTime.toFixed(2)} (diff=${diff.toFixed(2)})`);
            this._driver.seek(adjustedTime);
        }
    }

    private _executeAction(action: PendingAction) {
        switch (action.action) {
            case 'play': this._driver.play(action.src); break;
            case 'pause': this._driver.pause(); break;
            case 'seek': if (typeof action.seekTime === 'number') this._driver.seek(action.seekTime); break;
            case 'stop': this._driver.stop(); break;
        }
    }

    // --- Public API ---

    public play(src?: string) {
        if (this._config.singlePlayback) {
            this._coordinator.claimLeadership({ action: 'play', src }, (a) => this._executeAction(a));
        } else {
            this._driver.play(src);
        }
    }

    public pause() {
        if (this._config.singlePlayback) {
            this._coordinator.claimLeadership({ action: 'pause' }, (a) => this._executeAction(a));
        } else {
            this._driver.pause();
        }
    }

    public seek(time: number) {
        if (this._config.singlePlayback) {
            this._coordinator.claimLeadership({ action: 'seek', seekTime: time }, (a) => this._executeAction(a));
        } else {
            this._driver.seek(time);
        }
    }

    public setVolume(value: number) {
        this._driver.setVolume(value);
    }

    public stop() {
        if (this._config.singlePlayback) {
            this._coordinator.claimLeadership({ action: 'stop' }, (a) => this._executeAction(a));
        } else {
            this._driver.stop();
        }
    }

    public mute() { this._driver.mute(); }
    public unmute() { this._driver.unmute(); }
    public toggleMute() { this._driver.toggleMute(); }

    public destroy() {
        this._stopPeriodicSync();
        this._coordinator.close();
        this._driver.stop();
        this._engine.setSyncState(DEFAULT_PLAYER_STATE);
    }
}
