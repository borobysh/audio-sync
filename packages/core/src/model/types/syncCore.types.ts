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
        /** True if this is a remote control command (follower sending to leader) */
        isRemoteCommand?: boolean;
        /** Custom user data - can be any arbitrary data you want to sync */
        customData?: any;
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
    /**
     * Allow followers to send control commands (play, pause, seek, track change) 
     * without automatically becoming leaders.
     * Useful for remote control scenarios (like Spotify Connect).
     * Leadership must be claimed manually via becomeLeader() method.
     * Default: false
     */
    allowRemoteControl: boolean;
    /**
     * Automatically become leader if no active leader exists when trying to perform an action.
     * Only works when allowRemoteControl is true.
     * Default: true
     */
    autoClaimLeadershipIfNone: boolean;
}>