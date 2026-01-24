import { Engine } from './Engine';
import { Driver } from './Driver';
import { EventEmitter } from "./EventEmitter";
import { AudioEvent, SyncConfig, SyncCoreState } from "./types/syncCore.types";
import { AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG } from "../config/sync.config";
import { DEFAULT_PLAYER_STATE } from "../config/engine.config";
import { PendingAction, SyncCoordinator } from "./sync/SyncCoordinator";
import { PlaybackSyncHandler } from "./sync/PlaybackSyncHandler";
import { PlaylistManager } from "./playlist/PlaylistManager";
import { PlaylistConfig } from "./types/playlist.types";
import { AudioInstanceEventData } from "./types/eventEmitter.types";
import { describeSyncConfig, validateSyncConfig } from "./types/syncConfig.types";

const DEBUG = true;
const AUTHOR_LIB_TAG = '[borobysh/audio-sync]'
const log = (instanceId: string, ...args: any[]) => {
    if (DEBUG) {
        console.log(`[Sync:${instanceId.slice(0, 4)}]`, ...args);
    }
};

/**
 * Configuration for AudioInstance including sync and playlist settings
 */
export interface AudioInstanceConfig extends SyncConfig {
    playlist?: Partial<PlaylistConfig>;
}

/**
 * AudioInstance - The main entry point of the library.
 * Now acts as a manager coordinating the engine, driver, synchronization, and playlist.
 */
export class AudioInstance extends EventEmitter<AudioInstanceEventData> {
    private readonly _engine: Engine;
    private readonly _driver: Driver;
    private readonly _coordinator: SyncCoordinator;
    private readonly _playbackSyncHandler: PlaybackSyncHandler;
    private readonly _playlistManager: PlaylistManager | null;
    private readonly _config: Required<SyncConfig>;
    private readonly _instanceId: string;

    private _syncIntervalId: ReturnType<typeof setInterval> | null = null;

    constructor(channelName: string = 'audio_sync_v1', config: AudioInstanceConfig = {}) {
        super();
        this._instanceId = Math.random().toString(36).substring(2, 11);
        this._config = { ...AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG, ...config };

        this._validateConfig()

        this._engine = new Engine();
        this._driver = new Driver(this._engine);

        // Initialize playback sync handler
        this._playbackSyncHandler = new PlaybackSyncHandler(
            this._instanceId,
            this._config,
            this._driver,
            this._engine
        );

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

        // Initialize playlist if config provided
        this._playlistManager = config.playlist !== undefined ? new PlaylistManager(
            config.playlist,
            {
                onPlayTrack: (src) => this.play(src),
                onBroadcast: (type, payload) => this._coordinator.broadcast(type as any, payload)
            }
        ) : null;

        this._initCoreListeners();
        this._initPeriodicSync();

        if (this._playlistManager) {
            this._initPlaylistListeners();
        }

        log(this._instanceId, '🚀 Instance created, sending SYNC_REQUEST');
        this._coordinator.broadcast('SYNC_REQUEST', {});
    }

    // --- Accessors ---

    public get engine(): Engine {
        return this._engine;
    }

    public get driver(): Driver {
        return this._driver;
    }

    public get playlist(): PlaylistManager | null {
        return this._playlistManager;
    }

    public get instanceId(): string {
        return this._instanceId;
    }

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

    // Delegate to PlaybackSyncHandler
    private _isSyncAllowed(type: AudioEvent['type']): boolean {
        return this._playbackSyncHandler.isSyncAllowed(type);
    }

    private _validateConfig() {
        const validation = validateSyncConfig(this._config);
        if (validation.warnings.length > 0) {
            console.warn(`${AUTHOR_LIB_TAG} Configuration warnings:`);
            validation.warnings.forEach(w => console.warn(w));
        }

        console.log(`${AUTHOR_LIB_TAG} Current configuration:`);
        console.log(describeSyncConfig(this._config));
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

        this._engine.on('play', () => {
            broadcastLocalAction('PLAY');
            this._emitEvent('play', { src: this._engine.state.currentSrc });
        });
        this._engine.on('pause', () => {
            broadcastLocalAction('PAUSE');
            this._emitEvent('pause', undefined);
        });
        this._engine.on('stop', () => this._emitEvent('stop', undefined));
        this._engine.on('seek', () => {
            broadcastLocalAction('STATE_UPDATE');
            this._emitEvent('seek', { time: this._engine.state.currentTime });
        });
        this._engine.on('ended', () => {
            this._emitEvent('ended', undefined);
            // Auto-advance to next track if playlist is enabled
            if (this._playlistManager) {
                this._playlistManager.onTrackEnded();
            }
        });
        this._engine.on('error', () => {
            const error = this._engine.state.error;
            if (error) this._emitEvent('error', error);
        });
        this._engine.on('buffering', ({ isBuffering }: { isBuffering: boolean }) => {
            this._emitEvent('buffering', { isBuffering });
        });
        this._engine.on('buffer_progress', ({ bufferedSeconds }: { bufferedSeconds: number }) => {
            this._emitEvent('bufferProgress', { bufferedSeconds });
        });
    }

    private _initPlaylistListeners() {
        if (!this._playlistManager) return;

        // Forward all playlist events to AudioInstance
        this._playlistManager.on('trackChanged', (data) => this._emitEvent('playlistTrackChanged', data));
        this._playlistManager.on('queueUpdated', (data) => this._emitEvent('playlistQueueUpdated', data));
        this._playlistManager.on('playlistEnded', (data) => this._emitEvent('playlistEnded', data));
        this._playlistManager.on('repeatModeChanged', (data) => this._emitEvent('playlistRepeatModeChanged', data));
        this._playlistManager.on('shuffleChanged', (data) => this._emitEvent('playlistShuffleChanged', data));
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

    /**
     * Route remote events to appropriate handlers
     */
    private _handleRemoteEvent(type: AudioEvent['type'], payload: Partial<SyncCoreState>, timestamp: number) {
        // Route playlist events to PlaylistManager
        if (this._playlistManager && type.startsWith('PLAYLIST_')) {
            this._playlistManager.handleRemoteAction(type, payload);
            return;
        }

        // Route playback events to PlaybackSyncHandler
        this._playbackSyncHandler.handleRemoteEvent(type, payload, timestamp);
    }

    private _executeAction(action: PendingAction) {
        switch (action.action) {
            case 'play':
                this._driver.play(action.src);
                break;
            case 'pause':
                this._driver.pause();
                break;
            case 'seek':
                if (typeof action.seekTime === 'number') this._driver.seek(action.seekTime);
                break;
            case 'stop':
                this._driver.stop();
                break;
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

    public mute() {
        this._driver.mute();
    }

    public unmute() {
        this._driver.unmute();
    }

    public toggleMute() {
        this._driver.toggleMute();
    }

    public destroy() {
        this._stopPeriodicSync();
        this._coordinator.close();
        this._driver.stop();
        this._engine.setSyncState(DEFAULT_PLAYER_STATE);
    }
}
