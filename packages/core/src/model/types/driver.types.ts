export type AudioElementContract = {
    // state
    src: string;
    currentTime: number;
    duration: number;
    volume: number;

    // methods
    play(): Promise<void>;
    pause(): void;

    // handler events
    ontimeupdate: ((this: any, ev: Event) => any) | null;
    onplaying: ((this: any, ev: Event) => any) | null;
    onpause: ((this: any, ev: Event) => any) | null;
    onerror: ((this: any, ev: Event) => any) | null;
    onended: ((this: any, ev: Event) => any) | null;
}