/**
 * HTMLMediaElement readyState values.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState
 */
export enum AudioReadyState {
    HAVE_NOTHING = 0,
    HAVE_METADATA = 1,
    HAVE_CURRENT_DATA = 2,
    HAVE_FUTURE_DATA = 3,
    HAVE_ENOUGH_DATA = 4,
}

/**
 * Minimal contract for audio element
 * Designed for dependency injection - allows users to provide custom implementations
 * 
 * Examples:
 * - HTMLAudioElement (default)
 * - Web Audio API wrapper
 * - Third-party library (Howler.js, Tone.js, etc.)
 * - Mock for testing
 * - React Native audio player
 */
export type AudioElementContract = {
    // Required state properties
    src: string;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;

    // Required methods
    play(): Promise<void>;
    pause(): void;

    // Required event handlers (minimal interface, no DOM dependency)
    ontimeupdate: ((this: any, ev: any) => any) | null;
    onplaying: ((this: any, ev: any) => any) | null;
    onpause: ((this: any, ev: any) => any) | null;
    onerror: ((this: any, ev: any) => any) | null;
    onended: ((this: any, ev: any) => any) | null;

    // Optional properties (browser-specific or advanced features)
    readyState?: AudioReadyState;
    oncanplay?: ((this: any, ev: any) => any) | null;
    
    // Optional DOM API methods (only if available, e.g., in browser)
    addEventListener?: (type: string, listener: any) => void;
    removeEventListener?: (type: string, listener: any) => void;
    
    // Optional buffering info (browser-specific)
    buffered?: {
        length: number;
        start(index: number): number;
        end(index: number): number;
    };
}