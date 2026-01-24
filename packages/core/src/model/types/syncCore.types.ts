import { AudioState } from "./engine.types";

export type SyncCoreState = AudioState & { isLeader: boolean }

export type AudioEventType =
    | 'PLAY'
    | 'PAUSE'
    | 'STOP'
    | 'STATE_UPDATE'
    | 'SYNC_REQUEST'
    | 'LEADERSHIP_CLAIM'
    | 'LEADERSHIP_ACK'
    | 'PLAYBACK_RATE_CHANGE';

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
    /** Sync playback rate (speed) changes between tabs */
    syncPlaybackRate: boolean;
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
     * Fine-grained control over which actions can be sent remotely.
     * Only applies when allowRemoteControl is true.
     * If not specified, all actions are allowed by default.
     * 
     * @example
     * ```typescript
     * // Only allow play/pause remote control
     * remoteSync: {
     *   play: true,
     *   pause: true,
     *   stop: false,
     *   seek: false,
     *   playbackRate: false
     * }
     * ```
     * 
     * Default: all actions allowed (all flags true)
     */
    remoteSync?: {
        /** Allow remote play commands (default: true) */
        play?: boolean;
        /** Allow remote pause commands (default: true) */
        pause?: boolean;
        /** Allow remote stop commands (default: true) */
        stop?: boolean;
        /** Allow remote seek commands (default: true) */
        seek?: boolean;
        /** Allow remote playback rate change commands (default: true) */
        playbackRate?: boolean;
    };
    /**
     * Automatically become leader if no active leader exists when trying to perform an action.
     * Only works when allowRemoteControl is true.
     * Default: true
     */
    autoClaimLeadershipIfNone: boolean;
}>