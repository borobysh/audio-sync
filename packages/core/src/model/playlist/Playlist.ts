import { EventEmitter } from "../EventEmitter";
import { Track, RepeatMode, PlaylistState, PlaylistEventPayloads } from "../types/playlist.types";

const DEBUG = true;
const log = (...args: any[]) => {
    if (DEBUG) {
        console.log('[Playlist]', ...args);
    }
};

/**
 * Playlist - Pure logic for managing a queue of tracks
 * Does not handle audio playback or synchronization
 */
export class Playlist extends EventEmitter<PlaylistEventPayloads> {
    private _tracks: Track[] = [];
    private _currentIndex: number = -1;
    private _repeatMode: RepeatMode = 'none';
    private _shuffleEnabled: boolean = false;
    private _queue: Track[] = [];
    private _queueMap: number[] = []; // Maps queue index to tracks index

    constructor(initialTracks: Track[] = []) {
        super();
        if (initialTracks.length > 0) {
            this.addMany(initialTracks);
        }
    }

    // ===== Getters =====

    /**
     * Get current playlist state
     */
    public get state(): PlaylistState {
        return {
            tracks: [...this._tracks],
            currentIndex: this._currentIndex,
            repeatMode: this._repeatMode,
            shuffleEnabled: this._shuffleEnabled,
            queue: [...this._queue],
            queueMap: [...this._queueMap],
        };
    }

    /**
     * Get current track
     */
    public get currentTrack(): Track | null {
        if (this._currentIndex < 0 || this._currentIndex >= this._queue.length) {
            return null;
        }
        return this._queue[this._currentIndex];
    }

    /**
     * Get all tracks
     */
    public get tracks(): Track[] {
        return [...this._tracks];
    }

    /**
     * Get queue (shuffled or original)
     */
    public get queue(): Track[] {
        return [...this._queue];
    }

    /**
     * Check if there's a next track
     */
    public get hasNext(): boolean {
        if (this._repeatMode === 'one') return true;
        if (this._repeatMode === 'all') return true;
        return this._currentIndex < this._queue.length - 1;
    }

    /**
     * Check if there's a previous track
     */
    public get hasPrev(): boolean {
        if (this._repeatMode === 'one') return true;
        if (this._repeatMode === 'all') return true;
        return this._currentIndex > 0;
    }

    // ===== Track Management =====

    /**
     * Add a single track to the playlist
     */
    public add(track: Track, position?: number): void {
        const actualPosition = position ?? this._tracks.length;
        this._tracks.splice(actualPosition, 0, track);
        this._rebuildQueue();
        log(`➕ Added track "${track.title || track.src}" at position ${actualPosition}`);
        this._emitEvent('queueUpdated', { tracks: this.tracks, queue: this.queue });
    }

    /**
     * Add multiple tracks to the playlist
     */
    public addMany(tracks: Track[], position?: number): void {
        const actualPosition = position ?? this._tracks.length;
        this._tracks.splice(actualPosition, 0, ...tracks);
        this._rebuildQueue();
        log(`➕ Added ${tracks.length} tracks at position ${actualPosition}`);
        this._emitEvent('queueUpdated', { tracks: this.tracks, queue: this.queue });
    }

    /**
     * Remove a track by ID
     */
    public remove(trackId: string): boolean {
        const index = this._tracks.findIndex(t => t.id === trackId);
        if (index === -1) return false;

        const wasCurrentTrack = this._queueMap[this._currentIndex] === index;
        this._tracks.splice(index, 1);
        this._rebuildQueue();

        // If we removed the current track, adjust index
        if (wasCurrentTrack && this._currentIndex >= this._queue.length) {
            this._currentIndex = Math.max(0, this._queue.length - 1);
        }

        log(`➖ Removed track ${trackId}`);
        this._emitEvent('queueUpdated', { tracks: this.tracks, queue: this.queue });
        return true;
    }

    /**
     * Clear all tracks from playlist
     */
    public clear(): void {
        const previousTrack = this.currentTrack;
        this._tracks = [];
        this._queue = [];
        this._queueMap = [];
        this._currentIndex = -1;
        log('🗑️ Cleared playlist');
        this._emitEvent('queueUpdated', { tracks: [], queue: [] });
        this._emitEvent('trackChanged', { 
            current: null, 
            previous: previousTrack, 
            currentIndex: -1 
        });
    }

    /**
     * Reorder tracks
     */
    public move(fromIndex: number, toIndex: number): void {
        if (fromIndex < 0 || fromIndex >= this._tracks.length) return;
        if (toIndex < 0 || toIndex >= this._tracks.length) return;

        const [track] = this._tracks.splice(fromIndex, 1);
        this._tracks.splice(toIndex, 0, track);
        this._rebuildQueue();
        log(`🔀 Moved track from ${fromIndex} to ${toIndex}`);
        this._emitEvent('queueUpdated', { tracks: this.tracks, queue: this.queue });
    }

    // ===== Navigation =====

    /**
     * Jump to a specific track index in the queue
     */
    public jumpTo(queueIndex: number): boolean {
        if (queueIndex < 0 || queueIndex >= this._queue.length) {
            log(`⚠️ Invalid queue index: ${queueIndex}`);
            return false;
        }

        const previousTrack = this.currentTrack;
        this._currentIndex = queueIndex;
        const currentTrack = this.currentTrack;

        log(`⏭️ Jumped to index ${queueIndex}: "${currentTrack?.title || currentTrack?.src}"`);
        this._emitEvent('trackChanged', { 
            current: currentTrack, 
            previous: previousTrack, 
            currentIndex: this._currentIndex 
        });
        return true;
    }

    /**
     * Move to next track
     */
    public next(): Track | null {
        if (this._queue.length === 0) {
            log('⚠️ Cannot go next: playlist is empty');
            return null;
        }

        const previousTrack = this.currentTrack;

        // Repeat one: stay on current track
        if (this._repeatMode === 'one') {
            log('🔂 Repeat one: staying on current track');
            return this.currentTrack;
        }

        // Move to next track
        const nextIndex = this._currentIndex + 1;

        if (nextIndex >= this._queue.length) {
            // Reached end of queue
            if (this._repeatMode === 'all') {
                // Loop back to start
                this._currentIndex = 0;
                log('🔁 Repeat all: looping back to start');
            } else {
                // Playlist ended
                log('🏁 Playlist ended');
                this._emitEvent('playlistEnded', undefined);
                return null;
            }
        } else {
            this._currentIndex = nextIndex;
        }

        const currentTrack = this.currentTrack;
        log(`⏭️ Next track: "${currentTrack?.title || currentTrack?.src}"`);
        this._emitEvent('trackChanged', { 
            current: currentTrack, 
            previous: previousTrack, 
            currentIndex: this._currentIndex 
        });
        return currentTrack;
    }

    /**
     * Move to previous track
     */
    public prev(): Track | null {
        if (this._queue.length === 0) {
            log('⚠️ Cannot go prev: playlist is empty');
            return null;
        }

        const previousTrack = this.currentTrack;

        // Repeat one: stay on current track
        if (this._repeatMode === 'one') {
            log('🔂 Repeat one: staying on current track');
            return this.currentTrack;
        }

        // Move to previous track
        const prevIndex = this._currentIndex - 1;

        if (prevIndex < 0) {
            // At start of queue
            if (this._repeatMode === 'all') {
                // Loop to end
                this._currentIndex = this._queue.length - 1;
                log('🔁 Repeat all: looping to end');
            } else {
                // Stay at start
                this._currentIndex = 0;
                log('⏮️ Already at start');
            }
        } else {
            this._currentIndex = prevIndex;
        }

        const currentTrack = this.currentTrack;
        log(`⏮️ Previous track: "${currentTrack?.title || currentTrack?.src}"`);
        this._emitEvent('trackChanged', { 
            current: currentTrack, 
            previous: previousTrack, 
            currentIndex: this._currentIndex 
        });
        return currentTrack;
    }

    // ===== Playback Modes =====

    /**
     * Set repeat mode
     */
    public setRepeat(mode: RepeatMode): void {
        if (this._repeatMode === mode) return;
        this._repeatMode = mode;
        log(`🔁 Repeat mode: ${mode}`);
        this._emitEvent('repeatModeChanged', { mode });
    }

    /**
     * Toggle shuffle
     */
    public setShuffle(enabled: boolean): void {
        if (this._shuffleEnabled === enabled) return;
        
        const currentTrack = this.currentTrack;
        this._shuffleEnabled = enabled;
        this._rebuildQueue();

        // Keep the same track playing after shuffle
        if (currentTrack) {
            const newIndex = this._queue.findIndex(t => t.id === currentTrack.id);
            if (newIndex !== -1) {
                this._currentIndex = newIndex;
            }
        }

        log(`🔀 Shuffle: ${enabled ? 'ON' : 'OFF'}`);
        this._emitEvent('shuffleChanged', { enabled });
        this._emitEvent('queueUpdated', { tracks: this.tracks, queue: this.queue });
    }

    /**
     * Toggle repeat mode (none -> all -> one -> none)
     */
    public toggleRepeat(): RepeatMode {
        const modes: RepeatMode[] = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(this._repeatMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        this.setRepeat(nextMode);
        return nextMode;
    }

    // ===== State Management =====

    /**
     * Set complete playlist state (for sync)
     */
    public setState(state: Partial<PlaylistState>): void {
        const previousTrack = this.currentTrack;
        let trackChanged = false;

        if (state.tracks) {
            this._tracks = [...state.tracks];
        }

        if (typeof state.repeatMode !== 'undefined') {
            this._repeatMode = state.repeatMode;
        }

        if (typeof state.shuffleEnabled !== 'undefined') {
            this._shuffleEnabled = state.shuffleEnabled;
        }

        this._rebuildQueue();

        if (typeof state.currentIndex !== 'undefined') {
            const validIndex = Math.max(-1, Math.min(state.currentIndex, this._queue.length - 1));
            if (this._currentIndex !== validIndex) {
                this._currentIndex = validIndex;
                trackChanged = true;
            }
        }

        log('📦 State updated');
        this._emitEvent('queueUpdated', { tracks: this.tracks, queue: this.queue });

        if (trackChanged) {
            this._emitEvent('trackChanged', { 
                current: this.currentTrack, 
                previous: previousTrack, 
                currentIndex: this._currentIndex 
            });
        }
    }

    // ===== Private Methods =====

    /**
     * Rebuild queue based on shuffle state
     */
    private _rebuildQueue(): void {
        if (this._shuffleEnabled) {
            // Create shuffled queue
            const indices = this._tracks.map((_, i) => i);
            this._shuffleArray(indices);
            this._queueMap = indices;
            this._queue = indices.map(i => this._tracks[i]);
        } else {
            // Original order
            this._queueMap = this._tracks.map((_, i) => i);
            this._queue = [...this._tracks];
        }
    }

    /**
     * Fisher-Yates shuffle algorithm
     */
    private _shuffleArray(array: number[]): void {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}
