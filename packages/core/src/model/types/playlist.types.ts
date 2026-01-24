/**
 * Playlist types for audio-sync library
 */

/**
 * Represents a single track in the playlist
 */
export interface Track {
    /** Unique identifier for the track */
    id: string;
    /** Audio source URL */
    src: string;
    /** Track title (optional) */
    title?: string;
    /** Artist name (optional) */
    artist?: string;
    /** Album name (optional) */
    album?: string;
    /** Track duration in seconds (optional, can be auto-detected) */
    duration?: number;
    /** Cover art URL (optional) */
    coverArt?: string;
    /** Any additional metadata */
    metadata?: Record<string, any>;
}

/**
 * Repeat modes for playlist playback
 */
export type RepeatMode = 'none' | 'all' | 'one';

/**
 * Complete state of the playlist
 */
export interface PlaylistState {
    /** All tracks in the playlist (original order) */
    tracks: Track[];
    /** Current track index in the queue (not in tracks if shuffled) */
    currentIndex: number;
    /** Current repeat mode */
    repeatMode: RepeatMode;
    /** Whether shuffle is enabled */
    shuffleEnabled: boolean;
    /** Actual playback queue (shuffled if shuffle is enabled) */
    queue: Track[];
    /** Mapping from queue index to original tracks index (for shuffle) */
    queueMap: number[];
}

/**
 * Configuration options for playlist
 */
export interface PlaylistConfig {
    /** Automatically play next track when current ends */
    autoAdvance: boolean;
    /** Default repeat mode */
    defaultRepeatMode: RepeatMode;
    /** Start with shuffle enabled */
    defaultShuffle: boolean;
    /** Synchronize playlist changes between tabs */
    syncPlaylist: boolean;
}

/**
 * Playlist event types
 */
export type PlaylistEventType = 
    | 'trackChanged'
    | 'queueUpdated'
    | 'playlistEnded'
    | 'repeatModeChanged'
    | 'shuffleChanged';

/**
 * Playlist event payloads
 */
export interface PlaylistEventPayloads {
    trackChanged: {
        current: Track | null;
        previous: Track | null;
        currentIndex: number;
    };
    queueUpdated: {
        tracks: Track[];
        queue: Track[];
    };
    playlistEnded: undefined;
    repeatModeChanged: {
        mode: RepeatMode;
    };
    shuffleChanged: {
        enabled: boolean;
    };
}

/**
 * Playlist sync events (for BroadcastChannel)
 */
export type PlaylistSyncEvent = 
    | 'PLAYLIST_ADD'
    | 'PLAYLIST_REMOVE'
    | 'PLAYLIST_CLEAR'
    | 'PLAYLIST_NEXT'
    | 'PLAYLIST_PREV'
    | 'PLAYLIST_JUMP'
    | 'PLAYLIST_SHUFFLE'
    | 'PLAYLIST_REPEAT'
    | 'PLAYLIST_STATE_UPDATE';
