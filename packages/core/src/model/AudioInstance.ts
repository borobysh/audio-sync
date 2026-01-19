import { Engine } from './Engine';
import { Driver } from './Driver';
import { EventEmitter } from "./EventEmitter";
import { AudioState } from "./types/engine.types";
import { AudioEvent, SyncConfig, SyncCoreState } from "./types/syncCore.types";
import { DEFAULT_SYNC_CONFIG } from "../config/sync.config";

/**
 * AudioInstance - The main entry point of the library.
 * It orchestrates the AudioEngine (state management), AudioDriver (hardware/API interaction),
 * and cross-tab synchronization logic via BroadcastChannel
 */
export class AudioInstance extends EventEmitter {
    private readonly _engine: Engine;
    private readonly _driver: Driver;
    private readonly _channel: BroadcastChannel;
    private _config: Required<SyncConfig>;

    private readonly _instanceId: string;
    private _isLeader: boolean = false;

    constructor(channelName: string = 'audio_sync_v1', config: SyncConfig = {}) {
        super();
        this._instanceId = Math.random().toString(36).substring(2, 11);
        this._config = { ...DEFAULT_SYNC_CONFIG, ...config };

        this._engine = new Engine();
        this._driver = new Driver(this._engine);
        this._channel = new BroadcastChannel(channelName);

        this._initCoreListeners();
        this._initBroadcastListeners();

        this._broadcast({ type: 'SYNC_REQUEST', payload: {}, timestamp: Date.now() });
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
     * Use it only for specific low-level tasks like audio parameter tuning.
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
        this._engine.on('state_change', () => {
            this.emit(this.state);
        });

        const broadcastLocalAction = (type: AudioEvent['type']) => {
            if (!this._isSyncAllowed(type)) return;

            // Local user interaction makes this instance the Leader
            this._isLeader = true;

            this._broadcast({
                type,
                payload: {
                    ...this._engine.state,
                    isLeader: true
                },
                timestamp: Date.now()
            });
        };

        this._engine.on('play', () => broadcastLocalAction('PLAY'));
        this._engine.on('pause', () => broadcastLocalAction('PAUSE'));
        this._engine.on('seek', () => broadcastLocalAction('STATE_UPDATE'));
    }

    /**
     * Listens for messages from other tabs via BroadcastChannel.
     */
    private _initBroadcastListeners() {
        this._channel.onmessage = (event: MessageEvent<AudioEvent>) => {
            const { type, payload, timestamp } = event.data;

            // Если кто-то другой стал лидером, мы снимаем с себя корону
            if (['PLAY', 'PAUSE', 'STATE_UPDATE'].includes(type) && payload.isLeader) {
                this._isLeader = false;
            }

            this._handleRemoteEvent(type, payload, timestamp);
        };
    }

    /**
     * Handles incoming remote synchronization events.
     */
    private _handleRemoteEvent(type: AudioEvent['type'], payload: Partial<SyncCoreState>, timestamp: number) {
        if (!this._isSyncAllowed(type)) {
            return;
        }

        switch (type) {
            case 'PLAY':
                this._syncTime(payload, timestamp);
                this._driver.play(payload.currentSrc || undefined);
                break;

            case 'PAUSE':
                this._driver.pause();
                break;

            case 'STATE_UPDATE':
                const isTrackChanging = payload.currentSrc !== this._engine.state.currentSrc;

                if (isTrackChanging && !this._config.syncTrackChange) {
                    return;
                }

                if (!isTrackChanging && !this._config.syncSeek) {
                    return;
                }

                this._syncTime(payload, timestamp);

                if (payload.isPlaying && !this._engine.state.isPlaying) {
                    this._driver.play(payload.currentSrc || undefined);
                } else if (!payload.isPlaying && this._engine.state.isPlaying) {
                    this._driver.pause();
                }
                break;

            case 'SYNC_REQUEST':
                if (this._isLeader) {
                    this._broadcast({
                        type: 'STATE_UPDATE',
                        payload: {
                            ...this._engine.state,
                            isLeader: true
                        },
                        timestamp: Date.now()
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
        if (typeof payload.currentTime !== 'number') {
            return;
        }

        const latency = (Date.now() - sentAt) / 1000;
        const adjustedTime = payload.isPlaying ? payload.currentTime + latency : payload.currentTime;
        const diff = Math.abs(this._engine.state.currentTime - adjustedTime);

        // 300ms threshold prevents micro-stutters during playback
        if (diff > 0.3) {
            this._driver.seek(adjustedTime);
        }
    }

    /**
     * Sends a message to the broadcast channel.
     */
    private _broadcast(event: AudioEvent) {
        this._channel.postMessage(event);
    }

    // --- Public API ---

    /**
     * Starts playback.
     * @param src Optional source URL to load.
     */
    public play(src?: string) {
        this._driver.play(src);
    }

    /**
     * Pauses playback.
     */
    public pause() {
        this._driver.pause();
    }

    /**
     * Seeks to a specific time.
     * @param time Time in seconds.
     */
    public seek(time: number) {
        this._driver.seek(time);
    }

    /**
     * Sets the local volume level.
     * @param value Volume from 0.0 to 1.0.
     */
    public setVolume(value: number) {
        this._driver.setVolume(value);
    }

    /**
     * Closes the broadcast channel and stops playback.
     */
    public destroy() {
        this._channel.close();
        this._driver.pause();
    }
}