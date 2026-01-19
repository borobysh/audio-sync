import { AudioState } from "./types/engine.types";

export class EventEmitter {
    private subscribers = new Set<(state: AudioState) => void>();

    public on(callback: (state: AudioState) => void) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    protected emit(state: AudioState) {
        this.subscribers.forEach((cb) => cb(state));
    }
}