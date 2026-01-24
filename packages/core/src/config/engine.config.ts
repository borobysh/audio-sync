import { AudioState } from "../model/types/engine.types";

export const DEFAULT_PLAYER_STATE: AudioState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    currentSrc: null,
    volume: 1,
    muted: false,
    error: null,
    isBuffering: false,
    bufferedSeconds: 0,
};
