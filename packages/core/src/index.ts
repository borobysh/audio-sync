// Public API
export { AudioInstance } from "./model/AudioInstance";
export type { AudioInstanceConfig } from "./model/AudioInstance";

// Driver API
export { Driver } from "./model/Driver";
export { AbstractDriver } from "./model/drivers/AbstractDriver";

// Playlist API
export { Playlist } from "./model/playlist/Playlist";
export { PlaylistManager } from "./model/playlist/PlaylistManager";

// Public types
export type { SyncConfig, SyncCoreState } from "./model/types/syncCore.types";
export type { AudioState, AudioError } from "./model/types/engine.types";
export type { 
    Track, 
    RepeatMode, 
    PlaylistState, 
    PlaylistConfig,
    PlaylistEventType,
    PlaylistEventPayloads 
} from "./model/types/playlist.types";

// Validated sync config types
export type {
    ValidatedSyncConfig,
    IndependentTabsConfig,
    SynchronizedTabsConfig,
    RemoteControlConfig,
    CustomSyncConfig
} from "./model/types/syncConfig.types";

// Sync config presets and utilities
export { 
    SyncPresets,
    AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG,
    validateSyncConfig,
    describeSyncConfig 
} from "./config/syncConfig";

// Public config
export { DEFAULT_PLAYLIST_CONFIG } from "./config/playlist.config";
