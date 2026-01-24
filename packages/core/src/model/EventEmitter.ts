import { SyncCoreState } from "./types/syncCore.types";
import { AudioInstanceEventData, AudioInstanceEventType } from "./types/eventEmitter.types";

/**
 * Generic EventEmitter for type-safe event handling
 */
export class EventEmitter<TEventPayloads = AudioInstanceEventData> {
    private _stateSubscribers = new Set<(state: SyncCoreState) => void>();
    private _eventSubscribers = new Map<keyof TEventPayloads, Set<Function>>();

    /**
     * Subscribe to all state changes (legacy API, for backwards compatibility)
     */
    public subscribe(callback: (state: SyncCoreState) => void) {
        this._stateSubscribers.add(callback);
        return () => this._stateSubscribers.delete(callback);
    }

    /**
     * Subscribe to a specific event type
     */
    public on<T extends keyof TEventPayloads>(
        event: T,
        callback: (data: TEventPayloads[T]) => void
    ): () => void {
        if (!this._eventSubscribers.has(event)) {
            this._eventSubscribers.set(event, new Set());
        }
        this._eventSubscribers.get(event)!.add(callback);
        return () => this._eventSubscribers.get(event)?.delete(callback);
    }

    /**
     * Unsubscribe from a specific event type
     */
    public off<T extends keyof TEventPayloads>(
        event: T,
        callback: (data: TEventPayloads[T]) => void
    ): void {
        this._eventSubscribers.get(event)?.delete(callback);
    }

    /**
     * Emit state change (for legacy subscribe API)
     */
    protected emit(state: SyncCoreState) {
        this._stateSubscribers.forEach((cb) => cb(state));
        // Only emit stateChange if it exists in the event payloads
        if ('stateChange' in ({} as TEventPayloads)) {
            this._emitEvent('stateChange' as keyof TEventPayloads, state as any);
        }
    }

    /**
     * Emit a specific event
     */
    protected _emitEvent<T extends keyof TEventPayloads>(
        event: T,
        data: TEventPayloads[T]
    ) {
        this._eventSubscribers.get(event)?.forEach((cb) => cb(data));
    }
}