import { SyncConfig } from "../model/types/syncCore.types";

export const AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG: Required<SyncConfig> = {
    syncPlay: true,
    syncPause: true,
    syncSeek: true,
    syncTrackChange: true,
    singlePlayback: true,
    syncInterval: 1000,
    leadershipHandshakeTimeout: 100
};