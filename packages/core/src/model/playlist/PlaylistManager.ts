import { Playlist } from "./Playlist";
import { Track, PlaylistConfig, PlaylistEventPayloads } from "../types/playlist.types";
import { AUDIO_INSTANCE_DEFAULT_PLAYLIST_CONFIG } from "../../config/playlist.config";
import { EventEmitter } from "../EventEmitter";
import { createLogger } from "../../shared/logger";

const log = createLogger('PlaylistManager');

/**
 * Callbacks for PlaylistManager to interact with AudioInstance
 */
export interface PlaylistManagerCallbacks {
    /** Called when a new track should be played */
    onPlayTrack: (src: string) => void;
    /** Called when playlist actions should be broadcast */
    onBroadcast?: (type: string, payload: any) => void;
    /** Check if track change remote control is enabled */
    isTrackChangeRemoteControlAllowed?: () => boolean;
    /** Check if we're in remote control mode as follower */
    isRemoteControlFollower?: () => boolean;
    /** Check if allowRemoteControl is enabled */
    isAllowRemoteControlEnabled?: () => boolean;
}

/**
 * PlaylistManager - Integrates Playlist with AudioInstance
 * Handles auto-advance, sync, and playback coordination
 */
export class PlaylistManager extends EventEmitter<PlaylistEventPayloads> {
    private readonly _playlist: Playlist;
    private readonly _config: Required<PlaylistConfig>;
    private readonly _callbacks: PlaylistManagerCallbacks;
    
    private _autoAdvanceEnabled: boolean = true;
    private _isProcessingRemote: boolean = false;

    constructor(
        config: Partial<PlaylistConfig> = {},
        callbacks: PlaylistManagerCallbacks
    ) {
        super();
        this._config = { ...AUDIO_INSTANCE_DEFAULT_PLAYLIST_CONFIG, ...config };
        this._callbacks = callbacks;
        this._playlist = new Playlist();

        // Set initial modes
        this._playlist.setRepeat(this._config.defaultRepeatMode);
        this._playlist.setShuffle(this._config.defaultShuffle);
        this._autoAdvanceEnabled = this._config.autoAdvance;

        // Forward all playlist events
        this._forwardPlaylistEvents();

        log('✅ PlaylistManager created');
    }

    // ===== Getters =====

    /**
     * Get the underlying Playlist instance
     */
    public get playlist(): Playlist {
        return this._playlist;
    }

    /**
     * Get current track
     */
    public get currentTrack(): Track | null {
        return this._playlist.currentTrack;
    }

    /**
     * Get playlist state
     */
    public get state() {
        return this._playlist.state;
    }

    // ===== Track Management =====

    /**
     * Add track and optionally broadcast
     */
    public add(track: Track, position?: number): void {
        this._playlist.add(track, position);
        if (!this._isProcessingRemote) {
            this._broadcastAction('PLAYLIST_ADD', { track, position });
        }
    }

    /**
     * Add multiple tracks
     */
    public addMany(tracks: Track[], position?: number): void {
        this._playlist.addMany(tracks, position);
        if (!this._isProcessingRemote) {
            this._broadcastAction('PLAYLIST_ADD', { tracks, position });
        }
    }

    /**
     * Remove track by ID
     */
    public remove(trackId: string): boolean {
        const result = this._playlist.remove(trackId);
        if (result && !this._isProcessingRemote) {
            this._broadcastAction('PLAYLIST_REMOVE', { trackId });
        }
        return result;
    }

    /**
     * Clear playlist
     */
    public clear(): void {
        this._playlist.clear();
        if (!this._isProcessingRemote) {
            this._broadcastAction('PLAYLIST_CLEAR', {});
        }
    }

    /**
     * Move track
     */
    public move(fromIndex: number, toIndex: number): void {
        this._playlist.move(fromIndex, toIndex);
        if (!this._isProcessingRemote) {
            this._broadcastAction('PLAYLIST_MOVE', { fromIndex, toIndex });
        }
    }

    // ===== Navigation & Playback =====

    /**
     * Play a specific track by queue index
     */
    public playTrack(queueIndex: number): boolean {
        const success = this._playlist.jumpTo(queueIndex);
        if (success && this._playlist.currentTrack) {
            this._callbacks.onPlayTrack(this._playlist.currentTrack.src);
            if (!this._isProcessingRemote) {
                this._broadcastTrackChangeAction('PLAYLIST_JUMP', { queueIndex });
            }
        }
        return success;
    }

    /**
     * Play next track
     */
    public next(): boolean {
        const nextTrack = this._playlist.next();
        if (nextTrack) {
            this._callbacks.onPlayTrack(nextTrack.src);
            if (!this._isProcessingRemote) {
                this._broadcastTrackChangeAction('PLAYLIST_NEXT', {});
            }
            return true;
        }
        return false;
    }

    /**
     * Play previous track
     */
    public prev(): boolean {
        const prevTrack = this._playlist.prev();
        if (prevTrack) {
            this._callbacks.onPlayTrack(prevTrack.src);
            if (!this._isProcessingRemote) {
                this._broadcastTrackChangeAction('PLAYLIST_PREV', {});
            }
            return true;
        }
        return false;
    }

    // ===== Modes =====

    /**
     * Set repeat mode
     */
    public setRepeat(mode: 'none' | 'all' | 'one'): void {
        this._playlist.setRepeat(mode);
        if (!this._isProcessingRemote) {
            this._broadcastAction('PLAYLIST_REPEAT', { mode });
        }
    }

    /**
     * Toggle repeat mode
     */
    public toggleRepeat(): void {
        const newMode = this._playlist.toggleRepeat();
        if (!this._isProcessingRemote) {
            this._broadcastAction('PLAYLIST_REPEAT', { mode: newMode });
        }
    }

    /**
     * Set shuffle
     */
    public setShuffle(enabled: boolean): void {
        this._playlist.setShuffle(enabled);
        if (!this._isProcessingRemote) {
            this._broadcastAction('PLAYLIST_SHUFFLE', { enabled });
        }
    }

    /**
     * Toggle shuffle
     */
    public toggleShuffle(): void {
        this.setShuffle(!this._playlist.state.shuffleEnabled);
    }

    // ===== Auto-Advance =====

    /**
     * Handle track ended event from AudioInstance
     * Called automatically when a track finishes playing
     */
    public onTrackEnded(): void {
        if (!this._autoAdvanceEnabled) {
            log('⏹️ Auto-advance disabled, stopping');
            return;
        }

        log('🔄 Track ended, auto-advancing...');
        this.next();
    }

    /**
     * Enable/disable auto-advance
     */
    public setAutoAdvance(enabled: boolean): void {
        this._autoAdvanceEnabled = enabled;
        log(`🔄 Auto-advance: ${enabled ? 'ON' : 'OFF'}`);
    }

    // ===== Sync Handling =====

    /**
     * Handle remote playlist action from other tabs
     */
    public handleRemoteAction(type: string, payload: any): void {
        this._isProcessingRemote = true;
        
        try {
            switch (type) {
                case 'PLAYLIST_ADD':
                    if (payload.tracks) {
                        this._playlist.addMany(payload.tracks, payload.position);
                    } else if (payload.track) {
                        this._playlist.add(payload.track, payload.position);
                    }
                    break;

                case 'PLAYLIST_REMOVE':
                    this._playlist.remove(payload.trackId);
                    break;

                case 'PLAYLIST_CLEAR':
                    this._playlist.clear();
                    break;

                case 'PLAYLIST_MOVE':
                    this._playlist.move(payload.fromIndex, payload.toIndex);
                    break;

                case 'PLAYLIST_JUMP':
                    this.playTrack(payload.queueIndex);
                    break;

                case 'PLAYLIST_NEXT':
                    this.next();
                    break;

                case 'PLAYLIST_PREV':
                    this.prev();
                    break;

                case 'PLAYLIST_SHUFFLE':
                    this._playlist.setShuffle(payload.enabled);
                    break;

                case 'PLAYLIST_REPEAT':
                    this._playlist.setRepeat(payload.mode);
                    break;

                case 'PLAYLIST_STATE_UPDATE':
                    this._playlist.setState(payload);
                    break;
            }
        } finally {
            this._isProcessingRemote = false;
        }
    }

    // ===== Private Methods =====

    /**
     * Broadcast playlist action to other tabs
     */
    private _broadcastAction(type: string, payload: any): void {
        if (this._config.syncPlaylist && this._callbacks.onBroadcast) {
            this._callbacks.onBroadcast(type, payload);
        }
    }

    /**
     * Broadcast track change action (next/prev/jump) with remote control check
     */
    private _broadcastTrackChangeAction(type: string, payload: any): void {
        if (!this._callbacks.onBroadcast) {
            return;
        }

        // Check if allowRemoteControl is enabled
        const isAllowRemoteControlEnabled = this._callbacks.isAllowRemoteControlEnabled?.() || false;
        
        // If allowRemoteControl is enabled, check remoteSync flag for ALL sync operations
        // This prevents sync when remoteSync.trackChange is false, even in normal sync mode
        if (isAllowRemoteControlEnabled) {
            const isTrackChangeAllowed = !this._callbacks.isTrackChangeRemoteControlAllowed || 
                                        this._callbacks.isTrackChangeRemoteControlAllowed();
            if (!isTrackChangeAllowed) {
                return; // remoteSync.trackChange is false, block all sync
            }
        }

        // Check if we're in remote control mode as follower
        const isRemoteControlFollower = this._callbacks.isRemoteControlFollower?.() || false;
        
        // Send if: (syncPlaylist enabled) OR (remote control enabled and trackChange allowed)
        const shouldBroadcast = (this._config.syncPlaylist) || 
                               (isRemoteControlFollower);
        
        if (shouldBroadcast) {
            this._callbacks.onBroadcast(type, payload);
        }
    }

    /**
     * Forward all events from Playlist to PlaylistManager subscribers
     */
    private _forwardPlaylistEvents(): void {
        this._playlist.on('trackChanged', (data) => this._emitEvent('trackChanged', data));
        this._playlist.on('queueUpdated', (data) => this._emitEvent('queueUpdated', data));
        this._playlist.on('playlistEnded', (data) => this._emitEvent('playlistEnded', data));
        this._playlist.on('repeatModeChanged', (data) => this._emitEvent('repeatModeChanged', data));
        this._playlist.on('shuffleChanged', (data) => this._emitEvent('shuffleChanged', data));
    }
}
