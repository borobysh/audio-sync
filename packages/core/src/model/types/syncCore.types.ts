import { AudioState } from "./engine.types";

export type SyncCoreState = AudioState & { isLeader: boolean }

export type AudioEvent = {
    type: 'PLAY' | 'PAUSE' | 'STATE_UPDATE' | 'SYNC_REQUEST';
    payload: Partial<SyncCoreState>;
    timestamp: number;
}

export type SyncConfig = Partial<{
    syncPlay: boolean;
    syncPause: boolean;
    syncSeek: boolean;
    syncTrackChange: boolean;
}>