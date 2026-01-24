import { SyncCoreState } from "./syncCore.types";
import { PlaylistEventPayloads } from "./playlist.types";

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
    | 'error'            // Error occurred
    | 'buffering'        // Audio buffering state
    | 'bufferProgress'   // Buffer progress update
    | 'playlistTrackChanged'      // Playlist track changed
    | 'playlistQueueUpdated'      // Playlist queue updated
    | 'playlistEnded'             // Playlist ended
    | 'playlistRepeatModeChanged' // Playlist repeat mode changed
    | 'playlistShuffleChanged';   // Playlist shuffle changed


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
    buffering: { isBuffering: boolean };
    bufferProgress: { bufferedSeconds: number };
    playlistTrackChanged: PlaylistEventPayloads['trackChanged'];
    playlistQueueUpdated: PlaylistEventPayloads['queueUpdated'];
    playlistEnded: PlaylistEventPayloads['playlistEnded'];
    playlistRepeatModeChanged: PlaylistEventPayloads['repeatModeChanged'];
    playlistShuffleChanged: PlaylistEventPayloads['shuffleChanged'];
};