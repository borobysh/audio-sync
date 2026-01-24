import { PlaylistConfig } from "../model/types/playlist.types";

/**
 * Default configuration for Playlist
 */
export const DEFAULT_PLAYLIST_CONFIG: Required<PlaylistConfig> = {
    autoAdvance: true,
    defaultRepeatMode: 'none',
    defaultShuffle: false,
    syncPlaylist: true,
};
