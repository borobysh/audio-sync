import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../../src/model/EventEmitter';
import { SyncCoreState } from '../../src/model/types/syncCore.types';

class TestEmitter extends EventEmitter {
    public triggerEmit(state: SyncCoreState) {
        this.emit(state);
    }

    public triggerEmitEvent(event: any, data: any) {
        this._emitEvent(event, data);
    }
}

describe('EventEmitter', () => {
    const mockState: SyncCoreState = {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        currentSrc: null,
        volume: 1,
        muted: false,
        error: null,
        isLeader: false
    };

    it('should handle legacy subscribe()', () => {
        const emitter = new TestEmitter();
        const callback = vi.fn();

        const unsubscribe = emitter.subscribe(callback);
        emitter.triggerEmit(mockState);

        expect(callback).toHaveBeenCalledWith(mockState);

        unsubscribe();
        emitter.triggerEmit({ ...mockState, isPlaying: true });
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle on() and off() for specific events', () => {
        const emitter = new TestEmitter();
        const callback = vi.fn();

        emitter.on('play', callback);
        emitter.triggerEmitEvent('play', { src: 'test.mp3' });

        expect(callback).toHaveBeenCalledWith({ src: 'test.mp3' });

        emitter.off('play', callback);
        emitter.triggerEmitEvent('play', { src: 'another.mp3' });
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function from on()', () => {
        const emitter = new TestEmitter();
        const callback = vi.fn();

        const unsubscribe = emitter.on('pause', callback);
        emitter.triggerEmitEvent('pause', undefined);

        expect(callback).toHaveBeenCalled();

        unsubscribe();
        emitter.triggerEmitEvent('pause', undefined);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should automatically emit stateChange event when legacy emit() is called', () => {
        const emitter = new TestEmitter();
        const callback = vi.fn();

        emitter.on('stateChange' as any, callback);
        emitter.triggerEmit(mockState);

        expect(callback).toHaveBeenCalledWith(mockState);
    });
});
