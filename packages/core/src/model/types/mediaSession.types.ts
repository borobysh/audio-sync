/**
 * Media Session API Types
 * 
 * Types for integrating with browser's Media Session API
 * for native OS-level media controls (lock screen, notifications, hardware buttons)
 */

/**
 * Standard Media Session actions supported by browsers
 */
export type MediaSessionAction =
    | 'play'
    | 'pause'
    | 'previoustrack'
    | 'nexttrack'
    | 'seekbackward'
    | 'seekforward'
    | 'seekto'
    | 'stop';

/**
 * Playback state for Media Session
 */
export type MediaSessionPlaybackState = 'none' | 'paused' | 'playing';

/**
 * Artwork image for Media Session metadata
 */
export interface MediaImage {
    src: string;
    sizes?: string;
    type?: string;
}

/**
 * Metadata for currently playing track
 */
export interface MediaMetadata {
    title?: string;
    artist?: string;
    album?: string;
    artwork?: MediaImage[];
}

/**
 * Position state for Media Session
 */
export interface MediaPositionState {
    duration?: number;
    playbackRate?: number;
    position?: number;
}

/**
 * Configuration for Media Session integration
 */
export interface MediaSessionConfig {
    /**
     * Enable/disable Media Session integration
     * @default true
     */
    enabled: boolean;

    /**
     * Step size in seconds for seek forward/backward actions
     * @default 10
     */
    seekStep: number;

    /**
     * Interval in milliseconds for updating position state
     * @default 1000
     */
    updateInterval: number;

    /**
     * Actions to enable (if not specified, all available actions are enabled)
     */
    actions?: MediaSessionAction[];

    /**
     * Artwork configuration
     */
    artwork?: {
        /**
         * Default fallback artwork URL if track has no artwork
         */
        defaultUrl?: string;

        /**
         * Sizes to generate for artwork (in pixels)
         * @default [96, 128, 192, 256, 384, 512]
         */
        sizes?: number[];
    };
}

/**
 * Action handler callback type
 */
export type MediaSessionActionHandler = (details?: MediaSessionActionDetails) => void;

/**
 * Details provided to action handlers
 */
export interface MediaSessionActionDetails {
    action: MediaSessionAction;
    seekOffset?: number;
    seekTime?: number;
    fastSeek?: boolean;
}

/**
 * Callbacks for Media Session to interact with player
 */
export interface MediaSessionCallbacks {
    onPlay: () => void;
    onPause: () => void;
    onStop?: () => void;
    onSeekBackward?: (seekOffset?: number) => void;
    onSeekForward?: (seekOffset?: number) => void;
    onSeekTo?: (seekTime: number, fastSeek?: boolean) => void;
    onPreviousTrack?: () => void;
    onNextTrack?: () => void;
}
