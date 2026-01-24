/**
 * Configuration for PlaybackRateManager
 */
export interface PlaybackRateConfig {
    /** Default playback rate (default: 1) */
    default: number;
    /** Minimum allowed playback rate (default: 0.25) */
    min: number;
    /** Maximum allowed playback rate (default: 4) */
    max: number;
    /** Step for increment/decrement operations (default: 0.25) */
    step: number;
    /** Preserve pitch when changing speed (default: true) */
    preservePitch: boolean;
    /** Persist playback rate to localStorage (default: false) */
    persistToLocalStorage: boolean;
    /** LocalStorage key for persistence (default: 'audio-sync-playback-rate') */
    localStorageKey?: string;
}

/**
 * Default playback rate configuration
 */
export const DEFAULT_PLAYBACK_RATE_CONFIG: Required<PlaybackRateConfig> = {
    default: 1,
    min: 0.25,
    max: 4,
    step: 0.25,
    preservePitch: true,
    persistToLocalStorage: false,
    localStorageKey: 'audio-sync-playback-rate'
};

/**
 * Event payloads for playback rate events
 */
export type PlaybackRateEventPayloads = {
    playbackRateChange: {
        playbackRate: number;
        previousRate: number;
    };
};
