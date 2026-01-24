import { Engine } from './Engine';
import { Driver } from './Driver';
import { EventEmitter } from "./EventEmitter";
import { AudioEvent, SyncConfig, SyncCoreState } from "./types/syncCore.types";
import { DEFAULT_PLAYER_STATE } from "../config/engine.config";
import { PendingAction, SyncCoordinator } from "./sync/SyncCoordinator";
import { PlaybackSyncHandler } from "./sync/PlaybackSyncHandler";
import { PlaylistManager } from "./playlist/PlaylistManager";
import { PlaylistConfig } from "./types/playlist.types";
import { AudioInstanceEventData } from "./types/eventEmitter.types";
import {
    AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG,
    AUDIO_INSTANCE_DEFAULT_REMOTE_SYNC_CONFIG,
    describeSyncConfig,
    validateSyncConfig
} from "../config/syncConfig";
import { createLogger } from "../shared/logger";
import { MediaSessionManager } from "./mediaSession/MediaSessionManager";
import { MediaMetadata, MediaSessionConfig } from "./types/mediaSession.types";
import { AbstractMediaSession } from "./mediaSession/AbstractMediaSession";
import { PlaybackRateManager } from "./playbackRate/PlaybackRateManager";
import { PlaybackRateConfig } from "./types/playbackRate.types";

const AUTHOR_LIB_TAG = '[borobysh/audio-sync]';

/**
 * Configuration for AudioInstance including sync and playlist settings
 */
export interface AudioInstanceConfig extends SyncConfig {
    playlist?: Partial<PlaylistConfig>;
    /**
     * Custom driver implementation for dependency injection
     * Allows you to provide your own audio implementation (Web Audio API, Howler.js, etc.)
     */
    driver?: Driver;
    /**
     * Custom audio element for dependency injection
     * If driver is not provided, this will be used to create a default Driver
     */
    audioElement?: any;
    /**
     * Media Session API configuration
     * Enables OS-level media controls (lock screen, notifications, hardware buttons)
     */
    mediaSession?: Partial<MediaSessionConfig>;
    /**
     * Custom Media Session implementation for dependency injection
     * Allows you to provide your own Media Session implementation
     */
    mediaSessionImpl?: AbstractMediaSession;
    /**
     * Playback rate configuration
     * Controls playback speed (0.25x - 4x)
     */
    playbackRate?: Partial<PlaybackRateConfig>;
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
    private readonly _mediaSessionManager: MediaSessionManager | null;
    private readonly _playbackRateManager: PlaybackRateManager;
    private readonly _config: Required<SyncConfig>;
    private readonly _instanceId: string;
    private readonly _log: ReturnType<typeof createLogger>;

    private _syncIntervalId: ReturnType<typeof setInterval> | null = null;

    constructor(channelName: string = 'audio_sync_v1', config: AudioInstanceConfig = {}) {
        super();
        this._instanceId = Math.random().toString(36).substring(2, 11);
        this._config = { ...AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG, ...config };
        this._log = createLogger('Sync', this._instanceId);

        this._validateConfig()

        this._engine = new Engine();

        // Allow dependency injection of custom Driver or AudioElement
        if (config.driver) {
            this._driver = config.driver;
        } else if (config.audioElement) {
            this._driver = new Driver(this._engine, config.audioElement);
        } else {
            // Default: create Driver with new Audio()
            this._driver = new Driver(this._engine);
        }

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
                    this._log(isLeader ? 'Became leader' : 'Giving up leadership');
                    this._emitEvent('leaderChange', { isLeader });

                    // Notify Media Session Manager about leadership change
                    if (this._mediaSessionManager) {
                        this._mediaSessionManager.onLeadershipChange(isLeader);
                    }

                    // If singlePlayback is enabled and we lost leadership while playing, stop audio
                    if (!isLeader && this._config.singlePlayback && this._engine.state.isPlaying) {
                        this._log('Stopping real playback (lost leadership)');
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

        // Initialize Media Session if config provided
        this._mediaSessionManager = this._initMediaSession(config);

        // Initialize PlaybackRateManager (always enabled)
        this._playbackRateManager = new PlaybackRateManager(
            this._driver,
            config.playbackRate || {},
            {
                onBroadcast: (type, payload) => this._coordinator.broadcast(type as any, payload),
                isSyncEnabled: () => this._config.syncPlaybackRate
            }
        );

        this._initCoreListeners();
        this._initPeriodicSync();

        if (this._playlistManager) {
            this._initPlaylistListeners();
        }

        if (this._mediaSessionManager) {
            this._initMediaSessionListeners();
        }

        this._initPlaybackRateListeners();

        this._log('Instance created, sending SYNC_REQUEST');
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

    public get mediaSession(): MediaSessionManager | null {
        return this._mediaSessionManager;
    }

    public get instanceId(): string {
        return this._instanceId;
    }

    public get state(): SyncCoreState {
        return {
            ...this._engine.state,
            playbackRate: this._playbackRateManager.playbackRate,
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

    private _initMediaSession(config: AudioInstanceConfig): MediaSessionManager | null {
        if (config.mediaSession?.enabled === false) {
            return null;
        }

        // Default config
        const mediaSessionConfig: MediaSessionConfig = {
            enabled: true,
            seekStep: 10,
            updateInterval: 1000,
            ...config.mediaSession
        };

        // Create callbacks for Media Session actions
        const callbacks = {
            onPlay: () => {
                this._log('Media Session: play');
                this.play();
            },
            onPause: () => {
                this._log('Media Session: pause');
                this.pause();
            },
            onStop: () => {
                this._log('Media Session: stop');
                this.stop();
            },
            onSeekBackward: (seekOffset?: number) => {
                const offset = seekOffset || mediaSessionConfig.seekStep;
                const newTime = Math.max(0, this._engine.state.currentTime - offset);
                this._log('Media Session: seekbackward', offset, 'seconds');
                this.seek(newTime);
            },
            onSeekForward: (seekOffset?: number) => {
                const offset = seekOffset || mediaSessionConfig.seekStep;
                const newTime = Math.min(
                    this._engine.state.duration || Infinity,
                    this._engine.state.currentTime + offset
                );
                this._log('Media Session: seekforward', offset, 'seconds');
                this.seek(newTime);
            },
            onSeekTo: (seekTime: number) => {
                this._log('Media Session: seekto', seekTime);
                this.seek(seekTime);
            },
            onPreviousTrack: this._playlistManager ? () => {
                this._log('Media Session: previoustrack');
                this._playlistManager!.prev();
            } : undefined,
            onNextTrack: this._playlistManager ? () => {
                this._log('Media Session: nexttrack');
                this._playlistManager!.next();
            } : undefined
        };

        return new MediaSessionManager(
            mediaSessionConfig,
            callbacks,
            config.mediaSessionImpl
        );
    }

    private _initMediaSessionListeners() {
        if (!this._mediaSessionManager) {
            return;
        }

        // Update Media Session on state changes
        this._engine.on('state_change', () => {
            this._mediaSessionManager!.onStateUpdate(this.state);
        });

        // Update Media Session on track change
        this.on('trackChange', ({ src }) => {
            // Extract metadata from current track
            // For now, use basic metadata - can be enhanced later
            const metadata: MediaMetadata = {
                title: src || 'Unknown Track',
                artist: 'Unknown Artist'
            };

            // If playlist is available, get metadata from current track
            if (this._playlistManager) {
                const currentTrack = this._playlistManager.currentTrack;
                if (currentTrack) {
                    metadata.title = currentTrack.title || currentTrack.src;
                    metadata.artist = currentTrack.artist;
                    metadata.album = currentTrack.album;

                    // Convert coverArt URL to artwork array
                    if (currentTrack.coverArt) {
                        metadata.artwork = [
                            { src: currentTrack.coverArt, sizes: '512x512', type: 'image/jpeg' }
                        ];
                    }
                }
            }

            this._mediaSessionManager!.onTrackChange(metadata);
        });

        // Update Media Session on playback state change
        this.on('play', () => {
            this._mediaSessionManager!.onPlaybackStateChange(true);
        });

        this.on('pause', () => {
            this._mediaSessionManager!.onPlaybackStateChange(false);
        });

        this.on('stop', () => {
            this._mediaSessionManager!.onPlaybackStateChange(false);
        });
    }

    private _initPlaybackRateListeners() {
        // Forward playback rate change events to AudioInstance
        this._playbackRateManager.on('playbackRateChange', ({ playbackRate, previousRate }) => {
            this._emitEvent('playbackRateChange', { playbackRate, previousRate });

            // Update Media Session position state with new playback rate
            if (this._mediaSessionManager) {
                this._mediaSessionManager.onStateUpdate(this.state);
            }
        });

        // Apply playback rate when track changes (persist between tracks)
        this.on('trackChange', () => {
            // Ensure playback rate is applied to new track
            const currentRate = this._playbackRateManager.playbackRate;
            this._driver.setPlaybackRate(currentRate);
        });

        // Apply playback rate when playback starts (in case audio element resets it)
        this._engine.on('play', () => {
            // Small delay to ensure audio element is ready
            setTimeout(() => {
                const currentRate = this._playbackRateManager.playbackRate;
                this._driver.setPlaybackRate(currentRate);
            }, 10);
        });
    }

    private _broadcastState(type: AudioEvent['type'], isRemoteCommand: boolean = false, customData?: any) {
        this._coordinator.broadcast(type, {
            ...this._engine.state,
            isLeader: !isRemoteCommand,
            isRemoteCommand,
            customData
        });
    }

    private _initPeriodicSync() {
        if (this._config.syncInterval <= 0) {
            return;
        }
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

        // Route playback rate changes to PlaybackRateManager (only if sync is enabled)
        if (type === 'PLAYBACK_RATE_CHANGE') {
            if (this._config.syncPlaybackRate) {
                const rate = (payload as any).playbackRate;
                if (typeof rate === 'number' && isFinite(rate)) {
                    this._playbackRateManager.handleRemoteChange(rate);
                }
            }
            return;
        }

        // Handle remote control commands (from followers to leader)
        const isRemoteCommand = (payload as any).isRemoteCommand === true;
        if (this._coordinator.isLeader && isRemoteCommand) {
            this._handleRemoteControlCommand(type, payload);
            return;
        }

        // Route playback events to PlaybackSyncHandler
        this._playbackSyncHandler.handleRemoteEvent(type, payload, timestamp);
    }

    /**
     * Handle remote control commands sent by followers
     * Only executed on leader
     */
    private _handleRemoteControlCommand(type: AudioEvent['type'], payload: Partial<SyncCoreState>) {
        this._log('🎮 Received remote control command:', type, payload.currentSrc || '');

        switch (type) {
            case 'PLAY':
                if (payload.currentSrc && payload.currentSrc !== this._engine.state.currentSrc) {
                    this._driver.play(payload.currentSrc);
                } else {
                    this._driver.play();
                }
                break;

            case 'PAUSE':
                this._driver.pause();
                break;

            case 'STOP':
                this._driver.stop();
                break;

            case 'STATE_UPDATE':
                if (typeof payload.currentTime === 'number' && isFinite(payload.currentTime)) {
                    this._driver.seek(payload.currentTime);
                }
                break;

            case 'PLAYBACK_RATE_CHANGE':
                const rate = (payload as any).playbackRate;
                if (typeof rate === 'number' && isFinite(rate)) {
                    this._playbackRateManager.setPlaybackRate(rate, false); // Don't broadcast back
                }
                break;
        }
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

    // --- Private Helpers ---

    /**
     * Check if a specific action is allowed for remote control
     */
    private _isRemoteControlAllowed(action: 'play' | 'pause' | 'stop' | 'seek' | 'playbackRate'): boolean {
        if (!this._config.allowRemoteControl) {
            return false;
        }

        // Use default config if remoteSync is not specified
        const remoteSync = this._config.remoteSync || AUDIO_INSTANCE_DEFAULT_REMOTE_SYNC_CONFIG;

        // Check specific action flag (default to true if not specified)
        switch (action) {
            case 'play':
                return remoteSync.play !== false;
            case 'pause':
                return remoteSync.pause !== false;
            case 'stop':
                return remoteSync.stop !== false;
            case 'seek':
                return remoteSync.seek !== false;
            case 'playbackRate':
                return remoteSync.playbackRate !== false;
            default:
                return false;
        }
    }

    /**
     * Execute action with remote control logic:
     * - If we're the leader: claim leadership and execute
     * - If remote control enabled: send command or auto-claim if no leader
     * - Otherwise: claim leadership and execute
     */
    private _executeWithRemoteControlLogic(
        action: PendingAction,
        eventType: AudioEvent['type'],
        onRemoteCommand: () => void,
        remoteActionType: 'play' | 'pause' | 'stop' | 'seek' = 'play'
    ) {
        const isRemoteControlFollower = this._config.allowRemoteControl &&
            !this._coordinator.isLeader &&
            this._isRemoteControlAllowed(remoteActionType);

        if (!isRemoteControlFollower) {
            // Normal mode: claim leadership and execute
            this._coordinator.claimLeadership(action, (a) => this._executeAction(a));
            return;
        }

        // Remote control mode
        if (!this._config.autoClaimLeadershipIfNone) {
            // Just send remote command without checking for leader
            onRemoteCommand();
            this._broadcastState(eventType, true);
            return;
        }

        // Check if leader exists before sending command
        this._coordinator.checkForActiveLeader((hasLeader) => {
            if (hasLeader) {
                // Leader exists, send remote command
                this._log(`Sending remote ${eventType} command to leader`);
                onRemoteCommand();
                this._broadcastState(eventType, true);
            } else {
                // No leader found, auto-claim leadership
                this._log('No leader found, auto-claiming leadership');
                this._coordinator.claimLeadership(action, (a) => this._executeAction(a));
            }
        });
    }

    // --- Public API ---

    /**
     * Manually claim leadership on this tab.
     * Useful in remote control mode where followers control playback without auto-leadership.
     */
    public becomeLeader() {
        if (this._config.singlePlayback) {
            this._coordinator.claimLeadership({ action: 'play' }, () => {
                this._log('Manually became leader');
            });
        }
    }

    public play(src?: string) {
        if (!this._config.singlePlayback) {
            this._driver.play(src);
            return;
        }

        this._executeWithRemoteControlLogic(
            { action: 'play', src },
            'PLAY',
            () => {
                if (src) {
                    this._engine.setSyncState({ currentSrc: src, isPlaying: true });
                } else {
                    this._engine.setSyncState({ isPlaying: true });
                }
            },
            'play'
        );
    }

    public pause() {
        if (!this._config.singlePlayback) {
            this._driver.pause();
            return;
        }

        this._executeWithRemoteControlLogic(
            { action: 'pause' },
            'PAUSE',
            () => {
                this._engine.setSyncState({ isPlaying: false });
            },
            'pause'
        );
    }

    public seek(time: number) {
        if (!this._config.singlePlayback) {
            this._driver.seek(time);
            return;
        }

        this._executeWithRemoteControlLogic(
            { action: 'seek', seekTime: time },
            'STATE_UPDATE',
            () => {
                this._engine.setSyncState({ currentTime: time });
            },
            'seek'
        );
    }

    public setVolume(value: number) {
        this._driver.setVolume(value);
    }

    public stop() {
        if (!this._config.singlePlayback) {
            this._driver.stop();
            return;
        }

        // Check if we're in remote control mode as a follower
        const isRemoteControlFollower = this._config.allowRemoteControl &&
            !this._coordinator.isLeader &&
            this._isRemoteControlAllowed('stop');

        if (isRemoteControlFollower) {
            // Send remote command to leader
            if (!this._config.autoClaimLeadershipIfNone) {
                // Just send remote command without checking for leader
                this._coordinator.broadcast('STOP', {
                    ...this._engine.state,
                    isRemoteCommand: true
                });
                // Update local state without applying to driver (leader will apply it)
                this._engine.setSyncState({ isPlaying: false, currentTime: 0 });
                return;
            }

            // Check if leader exists before sending command
            this._coordinator.checkForActiveLeader((hasLeader) => {
                if (hasLeader) {
                    // Leader exists, send remote command
                    this._log('Sending remote STOP command to leader');
                    this._coordinator.broadcast('STOP', {
                        ...this._engine.state,
                        isRemoteCommand: true
                    });
                    // Update local state without applying to driver (leader will apply it)
                    this._engine.setSyncState({ isPlaying: false, currentTime: 0 });
                } else {
                    // No leader found, claim leadership and execute
                    this._coordinator.claimLeadership({ action: 'stop' }, (a) => this._executeAction(a));
                }
            });
        } else {
            // Normal mode: claim leadership and execute
            this._coordinator.claimLeadership({ action: 'stop' }, (a) => this._executeAction(a));
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

    /**
     * Set playback rate (speed)
     * @param rate Playback rate (0.25 to 4.0)
     * @example
     * ```typescript
     * player.setPlaybackRate(1.5); // 1.5x speed
     * ```
     */
    public setPlaybackRate(rate: number): void {
        // Check if we're in remote control mode as a follower
        const isRemoteControlFollower = this._config.allowRemoteControl &&
            !this._coordinator.isLeader &&
            this._config.syncPlaybackRate;

        if (isRemoteControlFollower) {
            // Send remote command to leader
            if (!this._config.autoClaimLeadershipIfNone) {
                // Just send remote command without checking for leader
                this._coordinator.broadcast('PLAYBACK_RATE_CHANGE', {
                    ...this._engine.state,
                    playbackRate: rate,
                    isRemoteCommand: true
                });
                // Update local state without applying to driver (leader will apply it)
                this._playbackRateManager.setPlaybackRateStateOnly(rate);
                return;
            }

            // Check if leader exists before sending command
            this._coordinator.checkForActiveLeader((hasLeader) => {
                if (hasLeader) {
                    // Leader exists, send remote command
                    this._log('Sending remote PLAYBACK_RATE_CHANGE command to leader');
                    this._coordinator.broadcast('PLAYBACK_RATE_CHANGE', {
                        ...this._engine.state,
                        playbackRate: rate,
                        isRemoteCommand: true
                    });
                    // Update local state without applying to driver (leader will apply it)
                    this._playbackRateManager.setPlaybackRateStateOnly(rate);
                } else {
                    // No leader found, apply locally
                    this._playbackRateManager.setPlaybackRate(rate);
                }
            });
        } else {
            // Normal mode: apply directly
            this._playbackRateManager.setPlaybackRate(rate);
        }
    }

    /**
     * Get current playback rate
     * @returns Current playback rate
     * @example
     * ```typescript
     * const rate = player.getPlaybackRate(); // 1.5
     * ```
     */
    public getPlaybackRate(): number {
        return this._playbackRateManager.getPlaybackRate();
    }

    /**
     * Cycle through preset playback rates
     * @param presets Array of playback rates to cycle through
     * @returns New playback rate
     * @example
     * ```typescript
     * player.cyclePlaybackRate([1, 1.25, 1.5, 2]); // Cycles through speeds
     * ```
     */
    public cyclePlaybackRate(presets: number[]): number {
        return this._playbackRateManager.cyclePlaybackRate(presets);
    }

    public destroy() {
        this._stopPeriodicSync();
        this._coordinator.close();
        this._driver.stop();
        this._engine.setSyncState(DEFAULT_PLAYER_STATE);

        // Cleanup Media Session
        if (this._mediaSessionManager) {
            this._mediaSessionManager.destroy();
        }
    }
}
