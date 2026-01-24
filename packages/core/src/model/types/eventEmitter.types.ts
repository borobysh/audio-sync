import { SyncCoreState } from "./syncCore.types";

/**
 * Event types emitted by AudioInstance
 */
export type AudioInstanceEventType =
    | 'stateChange'      // Any state change
    | 'play'             // Playback started
    | 'pause'            // Playback paused
    | 'stop'             // Playback stopped
    | 'ended'            // Track ended
    | 'timeUpdate'       // Time updated (every timeupdate from audio element)
    | 'seek'             // User seeked
    | 'trackChange'      // Track changed
    | 'volumeChange'     // Volume changed
    | 'leaderChange'     // Leadership changed
    | 'error';           // Error occurred


export type AudioInstanceEventData = {
    stateChange: SyncCoreState;
    play: { src: string | null };
    pause: void;
    stop: void;
    ended: void;
    timeUpdate: { currentTime: number; duration: number };
    seek: { time: number };
    trackChange: { src: string | null; previousSrc: string | null };
    volumeChange: { volume: number; muted: boolean };
    leaderChange: { isLeader: boolean };
    error: { message: string; code: string | null };
};