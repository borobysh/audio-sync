import { AudioEngineContract, AudioState } from "../types/engine.types";

/**
 * Abstract Driver interface - contract for AudioInstance
 * 
 * This is the minimal contract that AudioInstance expects from any Driver.
 * You can create your own Driver implementation by implementing these methods.
 * 
 * Examples:
 * - BrowserDriver (default) - uses HTMLAudioElement with addEventListener
 * - WebAudioDriver - uses Web Audio API
 * - HowlerDriver - uses Howler.js
 * - MockDriver - for testing
 * - ReactNativeDriver - for mobile apps
 */
export abstract class AbstractDriver {
    protected engine: AudioEngineContract;

    constructor(engine: AudioEngineContract) {
        this.engine = engine;
    }

    /**
     * Play audio from source
     * @param src Optional source URL. If not provided, resume current track.
     */
    abstract play(src?: string): void;

    /**
     * Pause audio playback
     */
    abstract pause(): void;

    /**
     * Stop audio and reset to beginning
     */
    abstract stop(): void;

    /**
     * Seek to specific time position
     * @param time Time in seconds
     */
    abstract seek(time: number): void;

    /**
     * Set volume level
     * @param value Volume (0.0 to 1.0)
     */
    abstract setVolume(value: number): void;

    /**
     * Mute audio
     */
    abstract mute(): void;

    /**
     * Unmute audio
     */
    abstract unmute(): void;

    /**
     * Toggle mute state
     */
    abstract toggleMute(): void;

    /**
     * Pause silently (without triggering events)
     * Used for leadership transfer in sync mode
     */
    abstract pauseSilently(): void;

    /**
     * Seek when audio is ready (after loading)
     * Used for syncing playback position on track change
     */
    abstract seekWhenReady(time: number): void;
}
