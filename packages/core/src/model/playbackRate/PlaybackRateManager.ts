import { EventEmitter } from "../EventEmitter";
import { createLogger } from "../../shared/logger";
import { PlaybackRateConfig, DEFAULT_PLAYBACK_RATE_CONFIG, PlaybackRateEventPayloads } from "../types/playbackRate.types";
import { Driver } from "../Driver";

const log = createLogger('PlaybackRateManager');

/**
 * Callbacks for PlaybackRateManager to interact with AudioInstance
 */
export interface PlaybackRateManagerCallbacks {
    /** Called when playback rate should be broadcast to other tabs */
    onBroadcast?: (type: string, payload: any) => void;
      /** Check if playback rate sync is enabled */
    isSyncEnabled?: () => boolean;
}

/**
 * PlaybackRateManager - Manages playback speed/rate
 * Handles validation, persistence, sync, and events
 */
export class PlaybackRateManager extends EventEmitter<PlaybackRateEventPayloads> {
    private readonly _config: Required<PlaybackRateConfig>;
    private readonly _driver: Driver;
    private readonly _callbacks: PlaybackRateManagerCallbacks;
    private _currentRate: number;
    private _isProcessingRemote: boolean = false;

    constructor(
        driver: Driver,
        config: Partial<PlaybackRateConfig> = {},
        callbacks: PlaybackRateManagerCallbacks = {}
    ) {
        super();
        this._config = { ...DEFAULT_PLAYBACK_RATE_CONFIG, ...config };
        this._driver = driver;
        this._callbacks = callbacks;

        // Load from localStorage if persistence is enabled
        if (this._config.persistToLocalStorage) {
            const savedRate = this._loadFromLocalStorage();
            if (savedRate !== null) {
                this._currentRate = savedRate;
            } else {
                this._currentRate = this._config.default;
            }
        } else {
            this._currentRate = this._config.default;
        }

        // Validate and apply initial rate
        this._currentRate = this._validateAndClamp(this._currentRate);
        this._applyRate(this._currentRate, false);

        log('✅ PlaybackRateManager created', { rate: this._currentRate, config: this._config });
    }

    // ===== Getters =====

    /**
     * Get current playback rate
     */
    public get playbackRate(): number {
        return this._currentRate;
    }

    /**
     * Get configuration
     */
    public get config(): Readonly<Required<PlaybackRateConfig>> {
        return this._config;
    }

    // ===== Public API =====

    /**
     * Set playback rate
     * @param rate Playback rate (will be clamped to min/max)
     * @param broadcast Whether to broadcast to other tabs (default: true)
     */
    public setPlaybackRate(rate: number, broadcast: boolean = true): void {
        const previousRate = this._currentRate;
        const validatedRate = this._validateAndClamp(rate);

        if (validatedRate === this._currentRate) {
            // No change needed
            return;
        }

        this._currentRate = validatedRate;
        this._applyRate(this._currentRate, broadcast);
        this._saveToLocalStorage(this._currentRate);

        // Emit event
        this.emit('playbackRateChange', {
            playbackRate: this._currentRate,
            previousRate
        });

        log('📊 Playback rate changed', { from: previousRate, to: this._currentRate });
    }

    /**
     * Get current playback rate
     */
    public getPlaybackRate(): number {
        return this._currentRate;
    }

    /**
     * Increase playback rate by step
     */
    public increaseRate(): number {
        const newRate = Math.min(
            this._config.max,
            this._currentRate + this._config.step
        );
        this.setPlaybackRate(newRate);
        return this._currentRate;
    }

    /**
     * Decrease playback rate by step
     */
    public decreaseRate(): number {
        const newRate = Math.max(
            this._config.min,
            this._currentRate - this._config.step
        );
        this.setPlaybackRate(newRate);
        return this._currentRate;
    }

    /**
     * Cycle through preset speeds
     * @param presets Array of playback rates to cycle through
     */
    public cyclePlaybackRate(presets: number[]): number {
        if (presets.length === 0) {
            return this._currentRate;
        }

        // Find current rate in presets (with tolerance for floating point)
        const tolerance = 0.01;
        let currentIndex = presets.findIndex(
            p => Math.abs(p - this._currentRate) < tolerance
        );

        // If not found, find closest
        if (currentIndex === -1) {
            currentIndex = presets.reduce((closest, rate, index) => {
                const currentDiff = Math.abs(rate - this._currentRate);
                const closestDiff = Math.abs(presets[closest] - this._currentRate);
                return currentDiff < closestDiff ? index : closest;
            }, 0);
        }

        // Move to next preset (wrap around)
        const nextIndex = (currentIndex + 1) % presets.length;
        const nextRate = presets[nextIndex];

        this.setPlaybackRate(nextRate);
        return this._currentRate;
    }

    /**
     * Reset to default playback rate
     */
    public reset(): void {
        this.setPlaybackRate(this._config.default);
    }

    /**
     * Handle remote playback rate change (from sync)
     */
    public handleRemoteChange(rate: number): void {
        this._isProcessingRemote = true;
        const previousRate = this._currentRate;
        const validatedRate = this._validateAndClamp(rate);

        if (validatedRate !== this._currentRate) {
            this._currentRate = validatedRate;
            this._applyRate(this._currentRate, false); // Don't broadcast back
            this._saveToLocalStorage(this._currentRate);

            // Emit event
            this.emit('playbackRateChange', {
                playbackRate: this._currentRate,
                previousRate
            });

            log('📡 Remote playback rate change', { from: previousRate, to: this._currentRate });
        }

        this._isProcessingRemote = false;
    }

    /**
     * Update playback rate state without applying to driver
     * Useful for remote control followers to update UI before leader applies change
     */
    public setPlaybackRateStateOnly(rate: number): void {
        const previousRate = this._currentRate;
        const validatedRate = this._validateAndClamp(rate);

        if (validatedRate !== this._currentRate) {
            this._currentRate = validatedRate;
            this._saveToLocalStorage(this._currentRate);

            // Emit event (but don't apply to driver)
            this.emit('playbackRateChange', {
                playbackRate: this._currentRate,
                previousRate
            });

            log('📊 Playback rate state updated (no driver change)', { from: previousRate, to: this._currentRate });
        }
    }

    // ===== Private Methods =====

    /**
     * Validate and clamp playback rate to valid range
     */
    private _validateAndClamp(rate: number): number {
        if (typeof rate !== 'number' || !isFinite(rate) || isNaN(rate)) {
            log('⚠️ Invalid playback rate:', rate, 'using default');
            return this._config.default;
        }

        return Math.max(this._config.min, Math.min(this._config.max, rate));
    }

    /**
     * Apply playback rate to driver
     */
    private _applyRate(rate: number, broadcast: boolean): void {
        this._driver.setPlaybackRate(rate);

        // Broadcast to other tabs if enabled, sync is enabled, and not processing remote change
        const shouldBroadcast = broadcast && 
            !this._isProcessingRemote && 
            this._callbacks.onBroadcast &&
            (this._callbacks.isSyncEnabled ? this._callbacks.isSyncEnabled() : true);
        
        if (shouldBroadcast) {
            this._callbacks.onBroadcast('PLAYBACK_RATE_CHANGE', {
                playbackRate: rate
            });
        }
    }

    /**
     * Save playback rate to localStorage
     */
    private _saveToLocalStorage(rate: number): void {
        if (!this._config.persistToLocalStorage) {
            return;
        }

        try {
            localStorage.setItem(this._config.localStorageKey, rate.toString());
        } catch (err) {
            log('⚠️ Failed to save playback rate to localStorage:', err);
        }
    }

    /**
     * Load playback rate from localStorage
     */
    private _loadFromLocalStorage(): number | null {
        if (!this._config.persistToLocalStorage) {
            return null;
        }

        try {
            const saved = localStorage.getItem(this._config.localStorageKey);
            if (saved !== null) {
                const rate = parseFloat(saved);
                if (!isNaN(rate) && isFinite(rate)) {
                    return this._validateAndClamp(rate);
                }
            }
        } catch (err) {
            log('⚠️ Failed to load playback rate from localStorage:', err);
        }

        return null;
    }
}
