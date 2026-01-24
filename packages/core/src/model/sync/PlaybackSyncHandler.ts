import { SyncConfig, AudioEvent, SyncCoreState } from "../types/syncCore.types";
import { AudioState } from "../types/engine.types";
import { LatencyCompensator } from "./LatencyCompensator";
import { Driver } from "../Driver";
import { Engine } from "../Engine";
import { createLogger } from "../../shared/logger";

/**
 * PlaybackSyncHandler - Handles synchronization of playback actions
 * 
 * Responsibilities:
 * - Determine if sync events should be processed
 * - Handle remote playback events (PLAY, PAUSE, STATE_UPDATE)
 * - Sync time/seek operations with latency compensation
 * - Coordinate with Driver and Engine
 */
export class PlaybackSyncHandler {
    private readonly _instanceId: string;
    private readonly _config: Required<SyncConfig>;
    private readonly _driver: Driver;
    private readonly _engine: Engine;
    private readonly _log: ReturnType<typeof createLogger>;

    constructor(
        instanceId: string,
        config: Required<SyncConfig>,
        driver: Driver,
        engine: Engine
    ) {
        this._instanceId = instanceId;
        this._config = config;
        this._driver = driver;
        this._engine = engine;
        this._log = createLogger('PlaybackSync', instanceId);
    }

    /**
     * Check if a sync event should be processed based on config
     */
    public isSyncAllowed(type: AudioEvent['type']): boolean {
        switch (type) {
            case 'PLAY': 
                return this._config.syncPlay;
            case 'PAUSE': 
                return this._config.syncPause;
            case 'STOP':
                return this._config.syncPause; // Stop is similar to pause, use syncPause setting
            case 'STATE_UPDATE': 
                return this._config.syncSeek || this._config.syncTrackChange;
            // System events are always allowed
            case 'SYNC_REQUEST':
            case 'LEADERSHIP_CLAIM':
            case 'LEADERSHIP_ACK':
                return true;
            default: 
                return false;
        }
    }

    /**
     * Handle remote playback event
     */
    public handleRemoteEvent(
        type: AudioEvent['type'],
        payload: Partial<SyncCoreState>,
        timestamp: number
    ): void {
        if (!this.isSyncAllowed(type)) {
            return;
        }

        const latency = (Date.now() - timestamp) / 1000;

        switch (type) {
            case 'PLAY':
                this._handlePlay(payload, latency);
                break;

            case 'PAUSE':
                this._handlePause();
                break;

            case 'STATE_UPDATE':
                this._handleStateUpdate(payload, timestamp, latency);
                break;
        }
    }

    /**
     * Handle PLAY event from remote
     */
    private _handlePlay(payload: Partial<SyncCoreState>, latency: number): void {
        const adjustedTime = LatencyCompensator.calculateAdjustedTime(
            payload.currentTime,
            payload.isPlaying,
            latency,
            0
        );

        if (this._config.singlePlayback) {
            // Single playback mode - only track state, don't play audio
            this._engine.setSyncState({
                isPlaying: false,
                currentSrc: this._config.syncTrackChange 
                    ? (payload.currentSrc || null) 
                    : this._engine.state.currentSrc,
                duration: this._config.syncTrackChange 
                    ? (payload.duration || 0) 
                    : this._engine.state.duration,
                currentTime: this._config.syncSeek 
                    ? (isFinite(adjustedTime) ? adjustedTime : 0) 
                    : this._engine.state.currentTime
            });
        } else {
            // Multi-tab playback mode - actually play audio
            const isSourceChanging = payload.currentSrc && 
                payload.currentSrc !== this._engine.state.currentSrc;
            
            if (isSourceChanging && !this._config.syncTrackChange) {
                // Track is changing but we don't sync tracks
                // Just sync time/play state for current track
                if (this._config.syncSeek) {
                    this._syncTime(payload, Date.now() - latency * 1000);
                }
                if (this._engine.state.currentSrc) {
                    this._driver.play();
                }
            } else if (isSourceChanging && this._config.syncTrackChange) {
                // Track is changing and we sync tracks
                this._log('🎵 Playing new track:', payload.currentSrc);
                this._driver.play(payload.currentSrc || undefined);
                if (this._config.syncSeek && isFinite(adjustedTime) && adjustedTime >= 0) {
                    this._driver.seekWhenReady(adjustedTime);
                }
            } else {
                // Same track, just sync time/play state
                if (this._config.syncSeek) {
                    this._syncTime(payload, Date.now() - latency * 1000);
                }
                this._driver.play();
            }
        }
    }

    /**
     * Handle STOP event from remote
     */
    private _handleStop(): void {
        if (this._config.singlePlayback) {
            // In single playback mode, only leader plays
            // Just update state to reflect stop
            this._engine.setSyncState({ isPlaying: false, currentTime: 0 });
        } else {
            // Multi-tab playback - actually stop audio
            this._log('⏹️ Remote stop');
            this._driver.stop();
        }
    }

    /**
     * Handle PAUSE event from remote
     */
    private _handlePause(): void {
        if (this._config.singlePlayback) {
            if (this._config.syncPause) {
                this._engine.setSyncState({ isPlaying: false });
            }
        } else {
            this._driver.pause();
        }
    }

    /**
     * Handle STATE_UPDATE event from remote (periodic sync from leader)
     */
    private _handleStateUpdate(
        payload: Partial<SyncCoreState>,
        timestamp: number,
        latency: number
    ): void {
        const isTrackChanging = payload.currentSrc !== this._engine.state.currentSrc;
        
        // Skip if we're not syncing the relevant aspect
        if ((isTrackChanging && !this._config.syncTrackChange) || 
            (!isTrackChanging && !this._config.syncSeek)) {
            return;
        }

        const stateAdjustedTime = LatencyCompensator.calculateAdjustedTime(
            payload.currentTime,
            payload.isPlaying,
            latency,
            this._engine.state.currentTime
        );

        if (this._config.singlePlayback) {
            // Single playback - just track state
            this._engine.setSyncState({
                isPlaying: payload.isPlaying ?? this._engine.state.isPlaying,
                currentSrc: payload.currentSrc ?? this._engine.state.currentSrc,
                currentTime: isFinite(stateAdjustedTime) 
                    ? stateAdjustedTime 
                    : this._engine.state.currentTime,
                duration: payload.duration ?? this._engine.state.duration
            });
        } else {
            // Multi-tab playback - actually play audio
            if (this._config.syncSeek) {
                this._syncTime(payload, timestamp);
            }
            
            if (payload.isPlaying && !this._engine.state.isPlaying) {
                // Remote started playing
                if (isTrackChanging && this._config.syncTrackChange) {
                    this._log('▶️ Remote started new track:', payload.currentSrc);
                    this._driver.play(payload.currentSrc || undefined);
                } else if (!isTrackChanging) {
                    this._driver.play();
                }
            } else if (!payload.isPlaying && this._engine.state.isPlaying) {
                // Remote paused
                this._log('⏸️ Remote paused');
                this._driver.pause();
            } else if (isTrackChanging && payload.isPlaying && this._config.syncTrackChange) {
                // Remote changed track while playing
                this._log('🔄 Remote changed track:', payload.currentSrc);
                this._driver.play(payload.currentSrc || undefined);
            }
        }
    }

    /**
     * Sync time position with latency compensation
     */
    private _syncTime(payload: Partial<AudioState>, sentAt: number): void {
        if (typeof payload.currentTime !== 'number' || !isFinite(payload.currentTime)) {
            return;
        }

        const latency = (Date.now() - sentAt) / 1000;
        const adjustedTime = LatencyCompensator.calculateAdjustedTime(
            payload.currentTime,
            payload.isPlaying,
            latency
        );

        if (!isFinite(adjustedTime) || adjustedTime < 0) {
            return;
        }

        const diff = Math.abs(this._engine.state.currentTime - adjustedTime);

        // 300ms threshold prevents micro-stutters during playback
        if (diff > 0.3) {
            this._log(`⏱️ Seeking to ${adjustedTime.toFixed(2)}s (diff=${diff.toFixed(2)}s)`);
            this._driver.seek(adjustedTime);
        }
    }
}
