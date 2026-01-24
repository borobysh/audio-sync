export type AudioError = {
    message: string;
    code: string | null;
} | null;

export type AudioState = {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    currentSrc: string | null;
    volume: number;
    muted: boolean;
    error: AudioError;
}

export type EngineEventType =
    | 'state_change'
    | 'play'
    | 'pause'
    | 'stop'
    | 'seek'
    | 'ended'
    | 'error';

export interface AudioEngineContract {
    state: AudioState;
    on(event: EngineEventType, callback: Function): () => void;
    updateState(patch: Partial<AudioState>): void;
    play(src?: string): void;
    pause(): void;
    stop(): void;
    seek(time: number): void;
    setSyncState?(patch: Partial<AudioState>): void;
    stopSilently?(): void;
}
