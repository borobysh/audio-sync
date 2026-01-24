/**
 * Type-safe sync configuration types
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
