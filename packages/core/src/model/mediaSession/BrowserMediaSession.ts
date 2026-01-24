import { AbstractMediaSession } from "./AbstractMediaSession";
import {
    MediaMetadata,
    MediaPositionState,
    MediaSessionAction,
    MediaSessionActionHandler,
    MediaSessionCallbacks,
    MediaSessionConfig,
    MediaSessionPlaybackState
} from "../types/mediaSession.types";
import { createLogger } from "../../shared/logger";

/**
 * Browser Media Session implementation using native Media Session API
 * 
 * Integrates with OS-level media controls:
 * - Lock screen controls (iOS, Android)
 * - System notifications (Windows, macOS, Linux)
 * - Hardware buttons (headphones, keyboard)
 * - Picture-in-Picture controls
 * 
 * Browser support:
 * - Chrome/Edge 73+
 * - Firefox 82+
 * - Safari 15+
 * - Opera 60+
 */
export class BrowserMediaSession extends AbstractMediaSession {
    private readonly _log: ReturnType<typeof createLogger>;
    private _updateIntervalId: ReturnType<typeof setInterval> | null = null;
    private _registeredActions: Set<MediaSessionAction> = new Set();

    constructor(config: MediaSessionConfig, callbacks: MediaSessionCallbacks) {
        super(config, callbacks);
        this._log = createLogger('MediaSession');

        if (!this.isSupported()) {
            this._log('⚠️ Media Session API not supported in this browser');
        }
    }

    /**
     * Check if Media Session API is supported
     */
    public isSupported(): boolean {
        return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
    }

    /**
     * Activate Media Session and register action handlers
     */
    public activate(): void {
        if (!this.isSupported() || !this.config.enabled) {
            return;
        }

        if (this.isActive) {
            this._log('⚠️ Already active');
            return;
        }

        this._log('✅ Activating Media Session');
        this.isActive = true;

        // Register action handlers
        this._registerActionHandlers();

        // Start periodic position updates if configured
        if (this.config.updateInterval > 0) {
            this._startPositionUpdates();
        }
    }

    /**
     * Deactivate Media Session and unregister handlers
     */
    public deactivate(): void {
        if (!this.isSupported() || !this.isActive) {
            return;
        }

        this._log('🔇 Deactivating Media Session');
        this.isActive = false;

        // Unregister all action handlers
        this._unregisterActionHandlers();

        // Stop position updates
        this._stopPositionUpdates();

        // Clear metadata
        this.clear();
    }

    /**
     * Update metadata for currently playing track
     */
    public updateMetadata(metadata: MediaMetadata): void {
        if (!this.isSupported() || !this.config.enabled) {
            return;
        }

        try {
            const artwork = this._prepareArtwork(metadata.artwork);

            // Use native MediaMetadata constructor
            if ('MediaMetadata' in window) {
                navigator.mediaSession.metadata = new (window as any).MediaMetadata({
                    title: metadata.title || 'Unknown Title',
                    artist: metadata.artist || 'Unknown Artist',
                    album: metadata.album || '',
                    artwork: artwork
                });

                this._log('📝 Metadata updated:', metadata.title, '-', metadata.artist);
            }
        } catch (error) {
            this._log('❌ Failed to update metadata:', error);
        }
    }

    /**
     * Update playback state
     */
    public setPlaybackState(state: MediaSessionPlaybackState): void {
        if (!this.isSupported() || !this.config.enabled) {
            return;
        }

        try {
            navigator.mediaSession.playbackState = state;
            this._log('▶️ Playback state:', state);
        } catch (error) {
            this._log('❌ Failed to set playback state:', error);
        }
    }

    /**
     * Update position state (current time, duration, playback rate)
     */
    public setPositionState(state: MediaPositionState): void {
        if (!this.isSupported() || !this.config.enabled) {
            return;
        }

        try {
            // Validate values
            const duration = typeof state.duration === 'number' && isFinite(state.duration) && state.duration > 0
                ? state.duration
                : undefined;

            const position = typeof state.position === 'number' && isFinite(state.position) && state.position >= 0
                ? Math.min(state.position, duration || Infinity)
                : undefined;

            const playbackRate = typeof state.playbackRate === 'number' && isFinite(state.playbackRate) && state.playbackRate > 0
                ? state.playbackRate
                : 1.0;

            if (duration !== undefined && position !== undefined) {
                navigator.mediaSession.setPositionState({
                    duration,
                    playbackRate,
                    position
                });
            }
        } catch (error) {
            // Silently fail - position state is not critical
            // Some browsers might not support this yet
        }
    }

    /**
     * Set custom action handler
     */
    public setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
        if (!this.isSupported() || !this.config.enabled) {
            return;
        }

        try {
            navigator.mediaSession.setActionHandler(action, handler as any);
            
            if (handler) {
                this._registeredActions.add(action);
                this._log('🎮 Action handler registered:', action);
            } else {
                this._registeredActions.delete(action);
                this._log('🎮 Action handler unregistered:', action);
            }
        } catch (error) {
            this._log('❌ Failed to set action handler:', action, error);
        }
    }

    /**
     * Clear all metadata and reset state
     */
    public clear(): void {
        if (!this.isSupported()) {
            return;
        }

        try {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = 'none';
            this._log('🧹 Metadata cleared');
        } catch (error) {
            this._log('❌ Failed to clear metadata:', error);
        }
    }

    /**
     * Destroy and cleanup resources
     */
    public destroy(): void {
        this._log('💥 Destroying Media Session');
        this.deactivate();
    }

    // --- Private Methods ---

    /**
     * Register default action handlers based on config
     */
    private _registerActionHandlers(): void {
        const actionsToRegister = this.config.actions || this._getDefaultActions();

        for (const action of actionsToRegister) {
            const handler = this._getActionHandler(action);
            if (handler) {
                this.setActionHandler(action, handler);
            }
        }
    }

    /**
     * Unregister all action handlers
     */
    private _unregisterActionHandlers(): void {
        for (const action of this._registeredActions) {
            this.setActionHandler(action, null);
        }
        this._registeredActions.clear();
    }

    /**
     * Get default actions to register
     */
    private _getDefaultActions(): MediaSessionAction[] {
        const actions: MediaSessionAction[] = ['play', 'pause'];

        // Add playlist navigation if callbacks provided
        if (this.callbacks.onPreviousTrack) {
            actions.push('previoustrack');
        }
        if (this.callbacks.onNextTrack) {
            actions.push('nexttrack');
        }

        // Add seek actions if callbacks provided
        if (this.callbacks.onSeekBackward) {
            actions.push('seekbackward');
        }
        if (this.callbacks.onSeekForward) {
            actions.push('seekforward');
        }
        if (this.callbacks.onSeekTo) {
            actions.push('seekto');
        }

        // Add stop if callback provided
        if (this.callbacks.onStop) {
            actions.push('stop');
        }

        return actions;
    }

    /**
     * Get action handler for specific action
     */
    private _getActionHandler(action: MediaSessionAction): MediaSessionActionHandler | null {
        switch (action) {
            case 'play':
                return () => {
                    this._log('🎮 Action: play');
                    this.callbacks.onPlay();
                };

            case 'pause':
                return () => {
                    this._log('🎮 Action: pause');
                    this.callbacks.onPause();
                };

            case 'stop':
                return this.callbacks.onStop
                    ? () => {
                        this._log('🎮 Action: stop');
                        this.callbacks.onStop!();
                    }
                    : null;

            case 'previoustrack':
                return this.callbacks.onPreviousTrack
                    ? () => {
                        this._log('🎮 Action: previoustrack');
                        this.callbacks.onPreviousTrack!();
                    }
                    : null;

            case 'nexttrack':
                return this.callbacks.onNextTrack
                    ? () => {
                        this._log('🎮 Action: nexttrack');
                        this.callbacks.onNextTrack!();
                    }
                    : null;

            case 'seekbackward':
                return this.callbacks.onSeekBackward
                    ? (details) => {
                        const seekOffset = details?.seekOffset || this.config.seekStep;
                        this._log('🎮 Action: seekbackward', seekOffset);
                        this.callbacks.onSeekBackward!(seekOffset);
                    }
                    : null;

            case 'seekforward':
                return this.callbacks.onSeekForward
                    ? (details) => {
                        const seekOffset = details?.seekOffset || this.config.seekStep;
                        this._log('🎮 Action: seekforward', seekOffset);
                        this.callbacks.onSeekForward!(seekOffset);
                    }
                    : null;

            case 'seekto':
                return this.callbacks.onSeekTo
                    ? (details) => {
                        if (details?.seekTime !== undefined) {
                            this._log('🎮 Action: seekto', details.seekTime);
                            this.callbacks.onSeekTo!(details.seekTime, details.fastSeek);
                        }
                    }
                    : null;

            default:
                return null;
        }
    }

    /**
     * Prepare artwork array with proper sizes
     */
    private _prepareArtwork(artwork?: any[]): any[] {
        if (!artwork || artwork.length === 0) {
            // Use default artwork if provided
            if (this.config.artwork.defaultUrl) {
                return this._generateArtworkSizes(this.config.artwork.defaultUrl);
            }
            return [];
        }

        // If artwork is already an array with proper format, return as-is
        if (Array.isArray(artwork) && artwork.length > 0) {
            return artwork;
        }

        return [];
    }

    /**
     * Generate artwork array with multiple sizes
     */
    private _generateArtworkSizes(url: string): any[] {
        const sizes = this.config.artwork.sizes || [96, 128, 192, 256, 384, 512];
        return sizes.map(size => ({
            src: url,
            sizes: `${size}x${size}`,
            type: this._guessImageType(url)
        }));
    }

    /**
     * Guess image MIME type from URL
     */
    private _guessImageType(url: string): string {
        const ext = url.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'png': return 'image/png';
            case 'jpg':
            case 'jpeg': return 'image/jpeg';
            case 'webp': return 'image/webp';
            case 'gif': return 'image/gif';
            case 'svg': return 'image/svg+xml';
            default: return 'image/jpeg';
        }
    }

    /**
     * Start periodic position state updates
     */
    private _startPositionUpdates(): void {
        if (this._updateIntervalId) {
            return;
        }

        // Position updates will be triggered externally via setPositionState
        // This is just a placeholder for future enhancements
    }

    /**
     * Stop periodic position state updates
     */
    private _stopPositionUpdates(): void {
        if (this._updateIntervalId) {
            clearInterval(this._updateIntervalId);
            this._updateIntervalId = null;
        }
    }
}
