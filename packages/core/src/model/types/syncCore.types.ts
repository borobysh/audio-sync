import { AudioState } from "./engine.types";

export type SyncCoreState = AudioState & { isLeader: boolean }

export type AudioEventType =
    | 'PLAY'
    | 'PAUSE'
    | 'STATE_UPDATE'
    | 'SYNC_REQUEST'
    | 'LEADERSHIP_CLAIM'
    | 'LEADERSHIP_ACK';

export type LeadershipAction = 'play' | 'pause' | 'seek' | 'stop';

export type AudioEvent = {
    type: AudioEventType;
    payload: Partial<SyncCoreState> & {
        /** Action that triggered leadership claim */
        action?: LeadershipAction;
        /** Source for play action */
        src?: string;
        /** Time for seek action */
        seekTime?: number;
    };
    timestamp: number;
    /** ID of the instance that sent this event **/
    instanceId?: string;
}

export type SyncConfig = Partial<{
    /** Sync play events between tabs */
    syncPlay: boolean;
    /** Sync pause events between tabs */
    syncPause: boolean;
    /** Sync seek/time changes between tabs */
    syncSeek: boolean;
    /** Sync track changes between tabs */
    syncTrackChange: boolean;
    /**
     * If true, only the leader tab plays audio, followers just track state.
     * If false, all tabs play audio simultaneously (synchronized).
     * Default: true
     */
    singlePlayback: boolean;
    /**
     * Interval in milliseconds for periodic time sync from leader to followers.
     * Set to 0 to disable periodic sync.
     * Default: 1000 ms
     */
    syncInterval: number;
    /**
     * Timeout in milliseconds to wait for leadership acknowledgment.
     * After this timeout, the tab becomes leader anyway.
     * Default: 100 ms
     */
    leadershipHandshakeTimeout: number;
}>