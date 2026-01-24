/**
 * Sync configuration presets, defaults, and validation utilities
 */

import { SyncConfig } from "../model/types/syncCore.types";
import {
    IndependentTabsConfig,
    SynchronizedTabsConfig,
    RemoteControlConfig,
    CustomSyncConfig
} from "../model/types/syncConfig.types";

/**
 * Default sync configuration for AudioInstance
 */
export const AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG: Required<SyncConfig> = {
    syncPlay: true,
    syncPause: true,
    syncSeek: false,
    syncTrackChange: true,
    syncPlaybackRate: true,
    singlePlayback: true,
    syncInterval: 1000,
    leadershipHandshakeTimeout: 100,
    allowRemoteControl: false,
    autoClaimLeadershipIfNone: true
};

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
        syncPlaybackRate: false,
        singlePlayback: false,
        syncInterval: 0,
        allowRemoteControl: false,
        autoClaimLeadershipIfNone: false,
    } satisfies IndependentTabsConfig,

    /**
     * All tabs play the same content in sync
     */
    SYNCHRONIZED: {
        syncPlay: true,
        syncPause: true,
        syncSeek: true,
        syncTrackChange: true,
        syncPlaybackRate: true,
        singlePlayback: false,
        syncInterval: 1000,
        allowRemoteControl: false,
        autoClaimLeadershipIfNone: false,
    } satisfies SynchronizedTabsConfig,

    /**
     * One tab plays, others control (like Spotify Connect)
     * Followers can control playback but must manually claim leadership to play audio
     */
    REMOTE_CONTROL: {
        syncPlay: true,
        syncPause: true,
        syncSeek: true,
        syncTrackChange: true,
        singlePlayback: true,
        syncInterval: 1000,
        allowRemoteControl: true,
        autoClaimLeadershipIfNone: true,
    } satisfies RemoteControlConfig,

    /**
     * Simple play/pause sync - each tab becomes leader when it plays/pauses
     * No track or seek synchronization
     */
    PLAY_PAUSE_SYNC: {
        syncPlay: true,
        syncPause: true,
        syncSeek: false,
        syncTrackChange: false,
        syncPlaybackRate: false,
        singlePlayback: false,
        syncInterval: 0,
        allowRemoteControl: false,
        autoClaimLeadershipIfNone: false,
    } satisfies CustomSyncConfig,

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
        allowRemoteControl: false,
        autoClaimLeadershipIfNone: false,
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

    if (config.syncPlaybackRate) {
        features.push('⚡ Playback rate (speed) syncs');
    } else {
        features.push('⚡ Each tab can set speed independently');
    }

    return features.join('\n');
}
