// Public API
export { AudioInstance } from "./model/AudioInstance";
export type { AudioInstanceConfig } from "./model/AudioInstance";

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

// Validated sync config types & presets
export type {
    ValidatedSyncConfig,
    IndependentTabsConfig,
    SynchronizedTabsConfig,
    RemoteControlConfig,
    CustomSyncConfig
} from "./model/types/syncConfig.types";
export { 
    SyncPresets,
    AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG,
    validateSyncConfig,
    describeSyncConfig 
} from "./model/types/syncConfig.types";

// Public config
export { DEFAULT_PLAYLIST_CONFIG } from "./config/playlist.config";
