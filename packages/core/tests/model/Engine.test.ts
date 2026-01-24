import { describe, it, expect, vi } from 'vitest';
import { Engine } from '../../src/model/Engine';
import { DEFAULT_PLAYER_STATE } from '../../src/config/engine.config';

describe('Engine', () => {
    it('should initialize with default state', () => {
        const engine = new Engine();
        expect(engine.state).toEqual(DEFAULT_PLAYER_STATE);
    });

    it('should subscribe and unsubscribe from events', () => {
        const engine = new Engine();
        const callback = vi.fn();
        
        const unsubscribe = engine.on('play', callback);
        engine.play('test.mp3');
        
        expect(callback).toHaveBeenCalledTimes(1);
        
        unsubscribe();
        engine.play('another.mp3');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should emit state_change on any state update', () => {
        const engine = new Engine();
        const callback = vi.fn();
        
        engine.on('state_change', callback);
        engine.updateState({ volume: 0.5 });
        
        expect(callback).toHaveBeenCalledWith(expect.objectContaining({ volume: 0.5 }));
    });

    describe('playback methods', () => {
        it('should handle play() with new source', () => {
            const engine = new Engine();
            const playCallback = vi.fn();
            engine.on('play', playCallback);
            
            engine.play('track1.mp3');
            
            expect(engine.state.currentSrc).toBe('track1.mp3');
            expect(engine.state.isPlaying).toBe(true);
            expect(playCallback).toHaveBeenCalledWith({ src: 'track1.mp3' });
        });

        it('should reset time and duration when source changes in play()', () => {
            const engine = new Engine();
            engine.updateState({ currentTime: 10, duration: 100, currentSrc: 'old.mp3' });
            
            engine.play('new.mp3');
            
            expect(engine.state.currentTime).toBe(0);
            expect(engine.state.duration).toBe(0);
        });

        it('should handle pause()', () => {
            const engine = new Engine();
            const pauseCallback = vi.fn();
            engine.on('pause', pauseCallback);
            
            engine.play('test.mp3');
            engine.pause();
            
            expect(engine.state.isPlaying).toBe(false);
            expect(pauseCallback).toHaveBeenCalled();
        });

        it('should handle stop()', () => {
            const engine = new Engine();
            const stopCallback = vi.fn();
            engine.on('stop', stopCallback);
            
            engine.play('test.mp3');
            engine.updateState({ currentTime: 50 });
            engine.stop();
            
            expect(engine.state.isPlaying).toBe(false);
            expect(engine.state.currentTime).toBe(0);
            expect(stopCallback).toHaveBeenCalled();
        });

        it('should handle seek()', () => {
            const engine = new Engine();
            const seekCallback = vi.fn();
            engine.on('seek', seekCallback);
            
            engine.seek(15.5);
            
            expect(engine.state.currentTime).toBe(15.5);
            expect(seekCallback).toHaveBeenCalledWith(15.5);
        });
    });

    describe('silent methods', () => {
        it('should setSyncState silently (only state_change)', () => {
            const engine = new Engine();
            const stateCallback = vi.fn();
            const playCallback = vi.fn();
            
            engine.on('state_change', stateCallback);
            engine.on('play', playCallback);
            
            engine.setSyncState({ isPlaying: true, currentSrc: 'remote.mp3' });
            
            expect(engine.state.isPlaying).toBe(true);
            expect(engine.state.currentSrc).toBe('remote.mp3');
            expect(stateCallback).toHaveBeenCalled();
            expect(playCallback).not.toHaveBeenCalled();
        });

        it('should stopSilently()', () => {
            const engine = new Engine();
            const stateCallback = vi.fn();
            const pauseCallback = vi.fn();
            
            engine.play('test.mp3');
            engine.on('state_change', stateCallback);
            engine.on('pause', pauseCallback);
            
            engine.stopSilently();
            
            expect(engine.state.isPlaying).toBe(false);
            expect(stateCallback).toHaveBeenCalled();
            expect(pauseCallback).not.toHaveBeenCalled();
        });
    });

    it('should emit ended and error events', () => {
        const engine = new Engine();
        const endedCallback = vi.fn();
        const errorCallback = vi.fn();
        
        engine.on('ended', endedCallback);
        engine.on('error', errorCallback);
        
        const errorObj = { message: 'Failed', code: '404' };
        engine.updateState({ error: errorObj });
        
        engine.emitEnded();
        engine.emitError();
        
        expect(endedCallback).toHaveBeenCalled();
        expect(errorCallback).toHaveBeenCalledWith(errorObj);
    });
});
