import { AudioEngineContract, AudioState, EngineEventType } from "./types/engine.types";
import { DEFAULT_PLAYER_STATE } from "../config/engine.config";

export class Engine implements AudioEngineContract {
    private _state: AudioState = { ...DEFAULT_PLAYER_STATE };
    private _subscribers: Map<string, Set<Function>> = new Map();

    /**
     * Subscribe engine on events
     */
    public on(event: EngineEventType, callback: Function) {
        if (!this._subscribers.has(event)) {
            this._subscribers.set(event, new Set());
        }
        this._subscribers.get(event)?.add(callback);

        return () => this._subscribers.get(event)?.delete(callback);
    }

    /**
     * Notify handlers
     */
    private emit(event: EngineEventType, data?: any) {
        this._subscribers.get(event)?.forEach(cb => cb(data || this._state));

        if (event !== 'state_change') {
            this._subscribers.get('state_change')?.forEach(cb => cb(this._state));
        }
    }

    public updateState(patch: Partial<AudioState>) {
        this._state = { ...this._state, ...patch };
        this.emit('state_change');
    }

    public play(src?: string) {
        if (src && src !== this._state.currentSrc) {
            this._state.currentSrc = src;
            this._state.currentTime = 0;
            this._state.duration = 0;
        }

        this._state.isPlaying = true;
        this.emit('play', { src: this._state.currentSrc });
    }

    public pause() {
        this._state.isPlaying = false;
        this.emit('pause');
    }

    public stop() {
        this._state.isPlaying = false;
        this._state.currentTime = 0;
        this.emit('stop');
    }

    public seek(time: number) {
        this._state.currentTime = time;
        this.emit('seek', time);
    }

    /**
     * Silently update play state without triggering audio playback.
     * Used by followers to track leader's state without playing audio.
     */
    public setSyncState(patch: Partial<AudioState>) {
        this._state = { ...this._state, ...patch };
        // Only emit state_change, not play/pause/seek events
        // This updates UI without triggering Driver's audio element
        this.emit('state_change');
    }

    /**
     * Silently stop playback state without triggering audio pause.
     * Used when leadership is transferred to another tab.
     */
    public stopSilently() {
        this._state.isPlaying = false;
        this.emit('state_change');
    }

    /**
     * Emit ended event when track finishes.
     * Called by Driver when audio ends.
     */
    public emitEnded() {
        this.emit('ended');
    }

    /**
     * Emit error event.
     * Called by Driver when an error occurs.
     */
    public emitError() {
        this.emit('error', this._state.error);
    }

    /**
     * Update buffering state.
     * Called by Driver when audio starts/stops buffering.
     */
    public setBuffering(isBuffering: boolean) {
        if (this._state.isBuffering !== isBuffering) {
            this._state.isBuffering = isBuffering;
            this.emit('buffering', { isBuffering });
            this.emit('state_change');
        }
    }

    /**
     * Update buffer progress.
     * Called by Driver when buffer data changes.
     */
    public setBufferProgress(bufferedSeconds: number) {
        this._state.bufferedSeconds = bufferedSeconds;
        this.emit('buffer_progress', { bufferedSeconds });
        // Don't emit state_change for every progress update (too frequent)
    }

    public get state(): AudioState {
        return { ...this._state };
    }
}