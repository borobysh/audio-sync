import {
    MediaMetadata,
    MediaPositionState,
    MediaSessionAction,
    MediaSessionActionHandler,
    MediaSessionCallbacks,
    MediaSessionConfig,
    MediaSessionPlaybackState
} from "../types/mediaSession.types";

/**
 * Abstract Media Session interface - contract for AudioInstance
 * 
 * This is the minimal contract that AudioInstance expects from any Media Session implementation.
 * You can create your own Media Session implementation by extending this class.
 * 
 * Examples:
 * - BrowserMediaSession (default) - uses native Media Session API
 * - MockMediaSession - for testing
 * - CustomMediaSession - for custom integrations (e.g., Electron, React Native)
 * 
 * Why abstraction?
 * - Media Session API might be deprecated/changed in future
 * - Allows custom implementations for different platforms
 * - Easy to test with mock implementations
 * - Projects can continue using the library even if API changes
 */
export abstract class AbstractMediaSession {
    protected config: Required<MediaSessionConfig>;
    protected callbacks: MediaSessionCallbacks;
    protected isActive: boolean = false;

    constructor(config: MediaSessionConfig, callbacks: MediaSessionCallbacks) {
        this.config = this._mergeWithDefaults(config);
        this.callbacks = callbacks;
    }

    /**
     * Check if Media Session is supported in current environment
     */
    abstract isSupported(): boolean;

    /**
     * Activate Media Session (start listening to actions)
     * Called when instance becomes leader or starts playback
     */
    abstract activate(): void;

    /**
     * Deactivate Media Session (stop listening to actions)
     * Called when instance loses leadership or stops playback
     */
    abstract deactivate(): void;

    /**
     * Update metadata for currently playing track
     * @param metadata Track metadata (title, artist, album, artwork)
     */
    abstract updateMetadata(metadata: MediaMetadata): void;

    /**
     * Update playback state
     * @param state Current playback state ('none' | 'paused' | 'playing')
     */
    abstract setPlaybackState(state: MediaSessionPlaybackState): void;

    /**
     * Update position state (current time, duration, playback rate)
     * @param state Position state
     */
    abstract setPositionState(state: MediaPositionState): void;

    /**
     * Set custom action handler
     * Allows overriding default behavior for specific actions
     * @param action Action name
     * @param handler Handler function
     */
    abstract setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void;

    /**
     * Clear all metadata and reset state
     */
    abstract clear(): void;

    /**
     * Destroy and cleanup resources
     */
    abstract destroy(): void;

    /**
     * Check if Media Session is currently active
     */
    public isMediaSessionActive(): boolean {
        return this.isActive;
    }

    /**
     * Get current configuration
     */
    public getConfig(): Readonly<Required<MediaSessionConfig>> {
        return this.config;
    }

    /**
     * Merge user config with defaults
     */
    private _mergeWithDefaults(config: MediaSessionConfig): Required<MediaSessionConfig> {
        return {
            enabled: config.enabled ?? true,
            seekStep: config.seekStep ?? 10,
            updateInterval: config.updateInterval ?? 1000,
            actions: config.actions,
            artwork: {
                defaultUrl: config.artwork?.defaultUrl,
                sizes: config.artwork?.sizes ?? [96, 128, 192, 256, 384, 512]
            }
        };
    }
}
