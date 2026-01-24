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

export type AudioElementContract = {
    // state
    src: string;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
    readyState?: AudioReadyState;

    // methods
    play(): Promise<void>;
    pause(): void;

    // handler events
    ontimeupdate: ((this: any, ev: Event) => any) | null;
    onplaying: ((this: any, ev: Event) => any) | null;
    onpause: ((this: any, ev: Event) => any) | null;
    onerror: ((this: any, ev: Event) => any) | null;
    onended: ((this: any, ev: Event) => any) | null;
    oncanplay?: ((this: any, ev: Event) => any) | null;
    addEventListener?(type: string, listener: EventListener): void;
}