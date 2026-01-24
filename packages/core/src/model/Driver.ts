import { AudioElementContract, AudioReadyState } from "./types/driver.types";
import { AudioEngineContract, AudioState, EngineEventType } from "./types/engine.types";
import { Engine } from "./Engine";
import { createLogger } from "../shared/logger";
import { AbstractDriver } from "./drivers/AbstractDriver";

const logDriver = createLogger('Driver');

/**
 * Default Driver implementation for browser environment (HTMLAudioElement)
 * 
 * This driver is specifically designed for HTMLAudioElement and uses:
 * - addEventListener for advanced events (buffering, loading, etc.)
 * - buffered API for tracking buffer progress
 * 
 * For custom implementations (Web Audio API, Howler.js, React Native, etc.):
 * - Extend AbstractDriver
 * - Implement all required methods
 * - Pass your custom driver to AudioInstance config
 */
export class Driver extends AbstractDriver {
    private audio: AudioElementContract;
    private _isSilentOperation: boolean = false;

    constructor(engine?: AudioEngineContract, audioElement?: AudioElementContract) {
        super(engine || new Engine());
        this.audio = audioElement || (new Audio() as AudioElementContract);

        this._initEngineListeners();
        this._initAudioListeners();
    }

    /**
     * Check if currently in a silent operation (pause/stop triggered by sync, not user)
     */
    public get isSilentOperation(): boolean {
        return this._isSilentOperation;
    }

    private _initEngineListeners() {
        this.engine.on('play', ({ src }: { src: string }) => {
            logDriver('🎵 Engine play event', {
                src: src?.slice(-30),
                currentSrc: this.audio.src?.slice(-30),
                engineCurrentTime: this.engine.state.currentTime
            });

            const isSourceChanging = src && this.audio.src !== src;

            if (isSourceChanging) {
                logDriver('🔄 Changing audio source');
                // Handle AbortError when changing source during playback
                try {
                    this.audio.src = src;
                    this.engine.updateState({ error: null });
                } catch (err: any) {
                    // Ignore AbortError when changing source
                    if (err.name !== 'AbortError') {
                        logDriver('❌ Error setting src:', err.name);
                        this.engine.updateState({
                            error: {
                                message: err.message,
                                code: err.name
                            },
                        });
                    }
                }
            }

            logDriver('▶️ Calling audio.play()');
            this.audio.play().then(() => {
                // After playback starts, sync time from engine state
                // This is important when follower becomes leader - 
                // we need to start from the synced position
                const engineTime = this.engine.state.currentTime;
                const audioDiff = Math.abs(this.audio.currentTime - engineTime);

                if (audioDiff > 0.5 && engineTime > 0 && isFinite(engineTime)) {
                    logDriver('⏱️ Syncing audio.currentTime to engine state', {
                        audioTime: this.audio.currentTime,
                        engineTime
                    });
                    try {
                        this.audio.currentTime = engineTime;
                    } catch (err) {
                        logDriver('⚠️ Failed to sync currentTime:', err);
                    }
                }
            }).catch((err: Error) => {
                // Ignore AbortError - it happens when source changes during play
                if (err.name !== 'AbortError') {
                    logDriver('❌ Play error:', err.name, err.message);
                    this.engine.updateState({
                        error: {
                            message: err.message,
                            code: err.name
                        },
                    });
                } else {
                    logDriver('⚠️ AbortError (ignored)');
                }
            });
        });

        this.engine.on('pause', () => {
            logDriver('⏸️ Engine pause event, calling audio.pause()');
            this.audio.pause();
        });

        this.engine.on('stop', () => {
            logDriver('⏹️ Engine stop event, calling audio.pause() and resetting time');
            this.audio.pause();
            if (this.audio.readyState === undefined || this.audio.readyState >= AudioReadyState.HAVE_METADATA) {
                try {
                    this.audio.currentTime = 0;
                } catch (err) {
                    logDriver('⚠️ Failed to reset currentTime:', err);
                }
            }
        });

        this.engine.on('seek', (time: number) => {
            logDriver('⏱️ Engine seek event', { time, readyState: this.audio.readyState });
            // Validate time to prevent non-finite values
            if (typeof time === 'number' && isFinite(time) && time >= 0) {
                // Also check if audio is ready to prevent errors during loading
                if (this.audio.readyState === undefined || this.audio.readyState >= AudioReadyState.HAVE_CURRENT_DATA) {
                    try {
                        this.audio.currentTime = time;
                        logDriver('✅ Set currentTime to', time);
                    } catch (err) {
                        logDriver('⚠️ Failed to set currentTime:', err);
                    }
                } else {
                    logDriver('⏭️ Audio not ready, skipping seek');
                }
            } else {
                logDriver('⏭️ Invalid time, skipping seek');
            }
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
            logDriver('🔊 Audio onplaying event');
            this.engine.updateState({ isPlaying: true, error: null });
        };

        this.audio.onpause = () => {
            logDriver('🔇 Audio onpause event', { isSilentOperation: this._isSilentOperation });
            // Don't update state if this is a silent operation (e.g., leadership transfer)
            // The state is already updated by stopSilently()
            if (!this._isSilentOperation) {
                this.engine.updateState({ isPlaying: false });
            }
        };

        this.audio.onerror = () => {
            logDriver('❌ Audio onerror event');
            this.engine.updateState({
                error: {
                    message: 'Failed to load audio source',
                    code: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                },
            });
            (this.engine as any).emitError?.();
        };

        this.audio.onended = () => {
            logDriver('🏁 Audio onended event');
            // First update state, then emit ended event
            this.engine.updateState({ isPlaying: false });
            // Emit ended event
            (this.engine as any).emitEnded?.();
        };

        if (this.audio.addEventListener) {
            this.audio.addEventListener('waiting', () => {
                logDriver('🔄 Audio waiting (buffering started)');
                (this.engine as any).setBuffering?.(true);
            });

            this.audio.addEventListener('canplay', () => {
                logDriver('✅ Audio canplay (buffering ended)');
                (this.engine as any).setBuffering?.(false);
            });

            this.audio.addEventListener('canplaythrough', () => {
                logDriver('✅ Audio canplaythrough (fully buffered)');
                (this.engine as any).setBuffering?.(false);
            });

            this.audio.addEventListener('progress', () => {
                // Calculate how many seconds are buffered from current position
                if (this.audio.buffered && this.audio.buffered.length > 0) {
                    try {
                        const currentTime = this.audio.currentTime;
                        let bufferedSeconds = 0;

                        // Find the buffered range that contains current time
                        for (let i = 0; i < this.audio.buffered.length; i++) {
                            const start = this.audio.buffered.start(i);
                            const end = this.audio.buffered.end(i);

                            if (currentTime >= start && currentTime <= end) {
                                bufferedSeconds = end - currentTime;
                                break;
                            }
                        }

                        (this.engine as any).setBufferProgress?.(bufferedSeconds);
                    } catch (err) {
                        // Ignore errors (can happen during source changes)
                    }
                }
            });

            this.audio.addEventListener('loadstart', () => {
                logDriver('📥 Audio loadstart (starting to load)');
                (this.engine as any).setBuffering?.(true);
            });

            this.audio.addEventListener('loadedmetadata', () => {
                logDriver('📊 Audio loadedmetadata');
            });

            this.audio.addEventListener('loadeddata', () => {
                logDriver('📦 Audio loadeddata');
            });
        }
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

    /**
     * Pauses audio without triggering engine events.
     * Used when leadership is transferred to another tab to prevent
     * broadcasting a PAUSE event back.
     */
    public pauseSilently() {
        logDriver('🔇 pauseSilently called');
        this._isSilentOperation = true;
        this.audio.pause();

        if (this.engine.stopSilently) {
            this.engine.stopSilently();
        }

        setTimeout(() => {
            this._isSilentOperation = false;
        }, 50);
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

    /**
     * Stops playback and resets time to 0.
     */
    public stop() {
        this.engine.stop();
    }

    /**
     * Mutes audio output (sets volume to 0 without changing the volume state).
     */
    public mute() {
        logDriver('🔇 Muting audio');
        this.audio.muted = true;
        this.engine.updateState({ muted: true });
    }

    /**
     * Unmutes audio output.
     */
    public unmute() {
        logDriver('🔊 Unmuting audio');
        this.audio.muted = false;
        this.engine.updateState({ muted: false });
    }

    /**
     * Toggles mute state.
     */
    public toggleMute() {
        if (this.audio.muted) {
            this.unmute();
        } else {
            this.mute();
        }
    }

    /**
     * Attempts to set currentTime, retrying if audio is not ready yet.
     * Useful for syncing time after source changes.
     */
    public seekWhenReady(time: number, maxRetries: number = 10): void {
        if (typeof time !== 'number' || !isFinite(time) || time < 0) {
            return;
        }

        const trySeek = (attempt: number = 0) => {
            if (attempt >= maxRetries) {
                return;
            }

            if (this.audio.readyState === undefined || this.audio.readyState >= 2) {
                try {
                    this.audio.currentTime = time;
                } catch (err) {
                    // If it fails, try again after a short delay
                    if (attempt < maxRetries - 1) {
                        setTimeout(() => trySeek(attempt + 1), 50);
                    }
                }
            } else {
                // Audio not ready yet, wait and try again
                setTimeout(() => trySeek(attempt + 1), 50);
            }
        };

        trySeek();
    }

    /**
     * Set playback rate (speed)
     * @param rate Playback rate (0.25 to 4.0)
     */
    public setPlaybackRate(rate: number): void {
        if (typeof rate !== 'number' || !isFinite(rate)) {
            logDriver('⚠️ Invalid playback rate:', rate);
            return;
        }

        // Clamp to valid range (HTMLAudioElement supports 0.25 - 4.0)
        const clampedRate = Math.max(0.25, Math.min(4.0, rate));
        
        try {
            this.audio.playbackRate = clampedRate;
            // Preserve pitch by default (HTML5 audio does this automatically)
            if ('preservesPitch' in this.audio) {
                (this.audio as any).preservesPitch = true;
            }
            this.engine.updateState({ playbackRate: clampedRate });
            logDriver('✅ Set playback rate to', clampedRate);
        } catch (err) {
            logDriver('⚠️ Failed to set playback rate:', err);
        }
    }
}