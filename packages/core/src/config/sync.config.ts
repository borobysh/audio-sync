import { SyncConfig } from "../model/types/syncCore.types";

export const DEFAULT_SYNC_CONFIG: Required<SyncConfig> = {
    syncPlay: true,
    syncPause: true,
    syncSeek: true,
    syncTrackChange: true
};