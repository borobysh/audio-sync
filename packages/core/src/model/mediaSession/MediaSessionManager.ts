import { AbstractMediaSession } from "./AbstractMediaSession";
import { BrowserMediaSession } from "./BrowserMediaSession";
import {
    MediaMetadata,
    MediaSessionCallbacks,
    MediaSessionConfig
} from "../types/mediaSession.types";
import { createLogger } from "../../shared/logger";
import { SyncCoreState } from "../types/syncCore.types";

/**
 * Media Session Manager
 * 
 * Manages Media Session integration with AudioInstance.
 * Handles:
 * - Automatic metadata updates on track change
 * - Playback state synchronization
 * - Position state updates
 * - Cross-tab coordination (only leader controls Media Session)
 * - Action handler registration
 */
export class MediaSessionManager {
    private readonly _mediaSession: AbstractMediaSession;
    private readonly _log: ReturnType<typeof createLogger>;
    private _isLeader: boolean = false;
    private _currentState: Partial<SyncCoreState> = {};

    constructor(
        config: MediaSessionConfig,
        callbacks: MediaSessionCallbacks,
        mediaSessionImpl?: AbstractMediaSession
    ) {
        this._log = createLogger('MediaSessionManager');

        // Allow dependency injection of custom Media Session implementation
        if (mediaSessionImpl) {
            this._mediaSession = mediaSessionImpl;
        } else {
            this._mediaSession = new BrowserMediaSession(config, callbacks);
        }

        if (!this._mediaSession.isSupported()) {
            this._log('⚠️ Media Session API not supported - graceful degradation');
        } else {
            this._log('✅ Media Session Manager initialized');
        }
    }

    /**
     * Handle leadership change
     * Only leader should control Media Session to avoid conflicts
     */
    public onLeadershipChange(isLeader: boolean): void {
        this._isLeader = isLeader;

        if (isLeader) {
            this._log('👑 Became leader - activating Media Session');
            this._mediaSession.activate();
            
            // Restore current state
            if (this._currentState.currentSrc) {
                this._updateFromState(this._currentState);
            }
        } else {
            this._log('👥 Lost leadership - deactivating Media Session');
            this._mediaSession.deactivate();
        }
    }

    /**
     * Handle state updates from AudioInstance
     */
    public onStateUpdate(state: Partial<SyncCoreState>): void {
        this._currentState = { ...this._currentState, ...state };

        // Only leader controls Media Session
        if (!this._isLeader || !this._mediaSession.isSupported()) {
            return;
        }

        this._updateFromState(state);
    }

    /**
     * Handle track change
     */
    public onTrackChange(metadata: MediaMetadata): void {
        // Only leader controls Media Session
        if (!this._isLeader || !this._mediaSession.isSupported()) {
            return;
        }

        this._log('🎵 Track changed:', metadata.title);
        this._mediaSession.updateMetadata(metadata);
    }

    /**
     * Handle playback state change
     */
    public onPlaybackStateChange(isPlaying: boolean): void {
        // Only leader controls Media Session
        if (!this._isLeader || !this._mediaSession.isSupported()) {
            return;
        }

        const state = isPlaying ? 'playing' : 'paused';
        this._mediaSession.setPlaybackState(state);
    }

    /**
     * Update position state
     */
    public updatePositionState(currentTime: number, duration: number, playbackRate: number = 1.0): void {
        // Only leader controls Media Session
        if (!this._isLeader || !this._mediaSession.isSupported()) {
            return;
        }

        this._mediaSession.setPositionState({
            position: currentTime,
            duration: duration,
            playbackRate: playbackRate
        });
    }

    /**
     * Check if Media Session is supported
     */
    public isSupported(): boolean {
        return this._mediaSession.isSupported();
    }

    /**
     * Check if Media Session is active
     */
    public isActive(): boolean {
        return this._mediaSession.isMediaSessionActive();
    }

    /**
     * Get Media Session instance (for advanced usage)
     */
    public getMediaSession(): AbstractMediaSession {
        return this._mediaSession;
    }

    /**
     * Destroy and cleanup
     */
    public destroy(): void {
        this._log('💥 Destroying Media Session Manager');
        this._mediaSession.destroy();
    }

    // --- Private Methods ---

    /**
     * Update Media Session from state
     */
    private _updateFromState(state: Partial<SyncCoreState>): void {
        // Update playback state
        if (state.isPlaying !== undefined) {
            this.onPlaybackStateChange(state.isPlaying);
        }

        // Update position state
        if (state.currentTime !== undefined && state.duration !== undefined) {
            // Note: playbackRate is not part of AudioState yet, defaulting to 1.0
            this.updatePositionState(
                state.currentTime,
                state.duration,
                1.0
            );
        }
    }
}
