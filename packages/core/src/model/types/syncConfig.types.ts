/**
 * Type-safe sync configuration with validation
 */

import { SyncConfig } from "./syncCore.types";

/**
 * Validated sync configuration that prevents conflicting combinations
 */
export type ValidatedSyncConfig = 
    | IndependentTabsConfig
    | SynchronizedTabsConfig
    | RemoteControlConfig
    | CustomSyncConfig;

/**
 * 1️⃣ Independent Tabs Mode
 * 
 * Use case: Each tab plays its own content independently
 * Example: User has multiple tabs with different playlists
 */
export interface IndependentTabsConfig extends SyncConfig {
    syncPlay?: false;
    syncPause?: false;
    syncSeek?: false;
    syncTrackChange: false;
    singlePlayback: false;
}

/**
 * 2️⃣ Synchronized Tabs Mode
 * 
 * Use case: All tabs play the same content in perfect sync
 * Example: User wants consistent experience across all tabs
 */
export interface SynchronizedTabsConfig extends SyncConfig {
    syncPlay: true;
    syncPause: true;
    syncSeek?: boolean;
    syncTrackChange: true;
    singlePlayback: false;  // All tabs play audio
}

/**
 * 3️⃣ Remote Control Mode (like Spotify Connect)
 * 
 * Use case: One tab plays audio, others can control it
 * Example: Desktop plays, phone controls
 */
export interface RemoteControlConfig extends SyncConfig {
    syncPlay: true;
    syncPause: true;
    syncSeek?: boolean;
    syncTrackChange: true;
    singlePlayback: true;  // Only leader plays audio
}

/**
 * 4️⃣ Custom Sync Mode
 * 
 * For advanced use cases - no validation
 */
export interface CustomSyncConfig extends SyncConfig {
    // Any combination allowed
}

/**
 * Configuration presets for common use cases
 */
export const SyncPresets = {
    /**
     * Each tab is completely independent
     */
    INDEPENDENT: {
        syncPlay: false,
        syncPause: false,
        syncSeek: false,
        syncTrackChange: false,
        singlePlayback: false,
        syncInterval: 0,  // No periodic sync needed
    } satisfies IndependentTabsConfig,

    /**
     * All tabs play the same content in sync
     */
    SYNCHRONIZED: {
        syncPlay: true,
        syncPause: true,
        syncSeek: true,
        syncTrackChange: true,
        singlePlayback: false,
        syncInterval: 1000,
    } satisfies SynchronizedTabsConfig,

    /**
     * One tab plays, others control (like Spotify Connect)
     */
    REMOTE_CONTROL: {
        syncPlay: true,
        syncPause: true,
        syncSeek: true,
        syncTrackChange: true,
        singlePlayback: true,
        syncInterval: 1000,
    } satisfies RemoteControlConfig,

    /**
     * Synced playback but independent tracks
     */
    SYNCED_PLAYBACK_INDEPENDENT_TRACKS: {
        syncPlay: true,
        syncPause: true,
        syncSeek: false,
        syncTrackChange: false,
        singlePlayback: false,
        syncInterval: 0,
    } satisfies CustomSyncConfig,
} as const;

/**
 * Validate sync configuration and warn about potential conflicts
 */
export function validateSyncConfig(config: Partial<SyncConfig>): {
    valid: boolean;
    warnings: string[];
} {
    const warnings: string[] = [];

    // Check for conflicting combinations
    if (config.singlePlayback === true && config.syncPlay === false) {
        warnings.push(
            '⚠️ singlePlayback: true + syncPlay: false - ' +
            'Only leader plays, but play events are not synced. This may cause confusion.'
        );
    }

    if (config.singlePlayback === false && 
        config.syncPlay === false && 
        config.syncPause === false && 
        config.syncSeek === false && 
        config.syncTrackChange === false) {
        warnings.push(
            '⚠️ All tabs play but nothing is synced - ' +
            'Consider using singlePlayback: true or enabling some sync options.'
        );
    }

    if (config.syncTrackChange === true && config.syncPlay === false) {
        warnings.push(
            '⚠️ syncTrackChange: true + syncPlay: false - ' +
            'Tracks sync but play state does not. This may cause unexpected behavior.'
        );
    }

    if (config.singlePlayback === true && config.syncInterval === 0) {
        warnings.push(
            '💡 singlePlayback: true + syncInterval: 0 - ' +
            'Consider enabling periodic sync for better follower state tracking.'
        );
    }

    return {
        valid: warnings.length === 0,
        warnings
    };
}

/**
 * Helper to describe what a config does
 */
export function describeSyncConfig(config: Partial<SyncConfig>): string {
    const features: string[] = [];

    if (config.singlePlayback) {
        features.push('🎵 Only leader tab plays audio');
    } else {
        features.push('🔊 All tabs play audio simultaneously');
    }

    if (config.syncTrackChange) {
        features.push('🎵 Tracks sync across tabs');
    } else {
        features.push('🎵 Each tab plays independent tracks');
    }

    if (config.syncPlay && config.syncPause) {
        features.push('⏯️ Play/pause syncs');
    }

    if (config.syncSeek) {
        features.push('⏩ Seek/time syncs');
    } else {
        features.push('⏩ Each tab can seek independently');
    }

    return features.join('\n');
}
