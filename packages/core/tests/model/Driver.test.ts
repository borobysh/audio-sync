import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Driver } from '../../src/model/Driver';
import { Engine } from '../../src/model/Engine';
import { AudioReadyState } from '../../src/model/types/driver.types';

// Mock AudioElementContract
class MockAudio {
    public src: string = '';
    public currentTime: number = 0;
    public duration: number = 0;
    public volume: number = 1;
    public muted: boolean = false;
    public readyState: number = AudioReadyState.HAVE_NOTHING;

    public ontimeupdate: any = null;
    public onplaying: any = null;
    public onpause: any = null;
    public onerror: any = null;
    public onended: any = null;

    public play = vi.fn().mockResolvedValue(undefined);
    public pause = vi.fn();
    public addEventListener = vi.fn();
}

describe('Driver', () => {
    let engine: Engine;
    let audio: MockAudio;
    let driver: Driver;

    beforeEach(() => {
        engine = new Engine();
        audio = new MockAudio();
        // @ts-ignore
        driver = new Driver(engine, audio);
    });

    describe('Engine to Audio synchronization', () => {
        it('should call audio.play() when engine emits play', async () => {
            engine.play('test.mp3');
            expect(audio.src).toBe('test.mp3');
            expect(audio.play).toHaveBeenCalled();
        });

        it('should call audio.pause() when engine emits pause', () => {
            engine.pause();
            expect(audio.pause).toHaveBeenCalled();
        });

        it('should call audio.pause() and reset time when engine emits stop', () => {
            audio.readyState = AudioReadyState.HAVE_METADATA;
            engine.stop();
            expect(audio.pause).toHaveBeenCalled();
            expect(audio.currentTime).toBe(0);
        });

        it('should call audio.currentTime when engine emits seek and audio is ready', () => {
            audio.readyState = AudioReadyState.HAVE_CURRENT_DATA;
            engine.seek(42);
            expect(audio.currentTime).toBe(42);
        });

        it('should not call audio.currentTime when engine emits seek and audio is not ready', () => {
            audio.readyState = AudioReadyState.HAVE_NOTHING;
            engine.seek(42);
            expect(audio.currentTime).toBe(0); // Still 0
        });
    });

    describe('Audio to Engine synchronization', () => {
        it('should update engine time on audio.ontimeupdate', () => {
            audio.currentTime = 15;
            audio.duration = 100;
            if (audio.ontimeupdate) {
                audio.ontimeupdate();
            }

            expect(engine.state.currentTime).toBe(15);
            expect(engine.state.duration).toBe(100);
        });

        it('should update engine playing state on audio.onplaying', () => {
            if (audio.onplaying) {
                audio.onplaying();
            }
            expect(engine.state.isPlaying).toBe(true);
        });

        it('should update engine playing state on audio.onpause', () => {
            engine.play('test.mp3');
            if (audio.onpause) {
                audio.onpause();
            }
            expect(engine.state.isPlaying).toBe(false);
        });

        it('should set error on audio.onerror', () => {
            if (audio.onerror) {
                audio.onerror();
            }
            expect(engine.state.error).not.toBeNull();
            expect(engine.state.error?.code).toBe('MEDIA_ERR_SRC_NOT_SUPPORTED');
        });
    });

    describe('Public Methods', () => {
        it('should set volume on audio and engine', () => {
            driver.setVolume(0.5);
            expect(audio.volume).toBe(0.5);
            expect(engine.state.volume).toBe(0.5);
        });

        it('should handle mute/unmute', () => {
            driver.mute();
            expect(audio.muted).toBe(true);
            expect(engine.state.muted).toBe(true);

            driver.unmute();
            expect(audio.muted).toBe(false);
            expect(engine.state.muted).toBe(false);
        });

        it('should handle pauseSilently', () => {
            vi.useFakeTimers();
            driver.pauseSilently();
            expect(driver.isSilentOperation).toBe(true);
            expect(audio.pause).toHaveBeenCalled();
            expect(engine.state.isPlaying).toBe(false);

            vi.advanceTimersByTime(50);
            expect(driver.isSilentOperation).toBe(false);
            vi.useRealTimers();
        });
    });
});
