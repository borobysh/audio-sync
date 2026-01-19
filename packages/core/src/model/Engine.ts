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

    public seek(time: number) {
        this._state.currentTime = time;
        this.emit('seek', time);
    }

    public get state(): AudioState {
        return { ...this._state };
    }
}