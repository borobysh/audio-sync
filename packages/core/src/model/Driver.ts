import { AudioElementContract } from "./types/driver.types";
import { AudioEngineContract, AudioState, EngineEventType } from "./types/engine.types";
import { Engine } from "./Engine";

export class Driver {
    private audio: AudioElementContract;
    private engine: AudioEngineContract;

    constructor(engine?: AudioEngineContract, audioElement?: AudioElementContract) {
        this.engine = engine || new Engine();
        this.audio = audioElement || (new Audio() as AudioElementContract);

        this._initEngineListeners();
        this._initAudioListeners();
    }

    private _initEngineListeners() {
        this.engine.on('play', ({ src }: { src: string }) => {
            if (src && this.audio.src !== src) {
                this.audio.src = src;
            }

            this.audio.play().catch((err: Error) => {
                this.engine.updateState({
                    error: {
                        message: err.message,
                        code: err.name
                    },
                });
            });
        });

        this.engine.on('pause', () => {
            this.audio.pause();
        });

        this.engine.on('seek', (time: number) => {
            this.audio.currentTime = time;
        });
    }

    private _initAudioListeners() {
        this.audio.ontimeupdate = () => {
            this.engine.updateState({
                currentTime: this.audio.currentTime,
                duration: this.audio.duration || 0
            });
        };

        this.audio.onplaying = () => {
            this.engine.updateState({ isPlaying: true, error: null });
        };

        this.audio.onpause = () => {
            this.engine.updateState({ isPlaying: false });
        };

        this.audio.onerror = () => {
            this.engine.updateState({
                error: {
                    message: 'Failed to load audio source',
                    code: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                },
            });
        };

        this.audio.onended = () => {
            this.engine.updateState({ isPlaying: false });
        };
    }

    public on(event: EngineEventType, callback: Function) {
        return this.engine.on(event, callback);
    }

    public play(src?: string) {
        this.engine.play(src);
    }

    public pause() {
        this.engine.pause();
    }

    public seek(time: number) {
        this.engine.seek(time);
    }

    public get state(): AudioState {
        return this.engine.state;
    }

    public setVolume(value: number) {
        const volume = Math.max(0, Math.min(1, value));
        this.audio.volume = volume;
        this.engine.updateState({ volume });
    }
}