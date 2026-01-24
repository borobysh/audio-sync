"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/internals/index.ts
var internals_exports = {};
__export(internals_exports, {
  AudioReadyState: () => AudioReadyState,
  DEFAULT_PLAYER_STATE: () => DEFAULT_PLAYER_STATE,
  Driver: () => Driver,
  Engine: () => Engine,
  EventEmitter: () => EventEmitter,
  LatencyCompensator: () => LatencyCompensator,
  PlaybackSyncHandler: () => PlaybackSyncHandler,
  SyncCoordinator: () => SyncCoordinator
});
module.exports = __toCommonJS(internals_exports);

// src/model/types/driver.types.ts
var AudioReadyState = /* @__PURE__ */ ((AudioReadyState2) => {
  AudioReadyState2[AudioReadyState2["HAVE_NOTHING"] = 0] = "HAVE_NOTHING";
  AudioReadyState2[AudioReadyState2["HAVE_METADATA"] = 1] = "HAVE_METADATA";
  AudioReadyState2[AudioReadyState2["HAVE_CURRENT_DATA"] = 2] = "HAVE_CURRENT_DATA";
  AudioReadyState2[AudioReadyState2["HAVE_FUTURE_DATA"] = 3] = "HAVE_FUTURE_DATA";
  AudioReadyState2[AudioReadyState2["HAVE_ENOUGH_DATA"] = 4] = "HAVE_ENOUGH_DATA";
  return AudioReadyState2;
})(AudioReadyState || {});

// src/config/engine.config.ts
var DEFAULT_PLAYER_STATE = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  currentSrc: null,
  volume: 1,
  muted: false,
  error: null,
  isBuffering: false,
  bufferedSeconds: 0
};

// src/model/Engine.ts
var Engine = class {
  _state = { ...DEFAULT_PLAYER_STATE };
  _subscribers = /* @__PURE__ */ new Map();
  /**
   * Subscribe engine on events
   */
  on(event, callback) {
    if (!this._subscribers.has(event)) {
      this._subscribers.set(event, /* @__PURE__ */ new Set());
    }
    this._subscribers.get(event)?.add(callback);
    return () => this._subscribers.get(event)?.delete(callback);
  }
  /**
   * Notify handlers
   */
  emit(event, data) {
    this._subscribers.get(event)?.forEach((cb) => cb(data || this._state));
    if (event !== "state_change") {
      this._subscribers.get("state_change")?.forEach((cb) => cb(this._state));
    }
  }
  updateState(patch) {
    this._state = { ...this._state, ...patch };
    this.emit("state_change");
  }
  play(src) {
    if (src && src !== this._state.currentSrc) {
      this._state.currentSrc = src;
      this._state.currentTime = 0;
      this._state.duration = 0;
    }
    this._state.isPlaying = true;
    this.emit("play", { src: this._state.currentSrc });
  }
  pause() {
    this._state.isPlaying = false;
    this.emit("pause");
  }
  stop() {
    this._state.isPlaying = false;
    this._state.currentTime = 0;
    this.emit("stop");
  }
  seek(time) {
    this._state.currentTime = time;
    this.emit("seek", time);
  }
  /**
   * Silently update play state without triggering audio playback.
   * Used by followers to track leader's state without playing audio.
   */
  setSyncState(patch) {
    this._state = { ...this._state, ...patch };
    this.emit("state_change");
  }
  /**
   * Silently stop playback state without triggering audio pause.
   * Used when leadership is transferred to another tab.
   */
  stopSilently() {
    this._state.isPlaying = false;
    this.emit("state_change");
  }
  /**
   * Emit ended event when track finishes.
   * Called by Driver when audio ends.
   */
  emitEnded() {
    this.emit("ended");
  }
  /**
   * Emit error event.
   * Called by Driver when an error occurs.
   */
  emitError() {
    this.emit("error", this._state.error);
  }
  /**
   * Update buffering state.
   * Called by Driver when audio starts/stops buffering.
   */
  setBuffering(isBuffering) {
    if (this._state.isBuffering !== isBuffering) {
      this._state.isBuffering = isBuffering;
      this.emit("buffering", { isBuffering });
      this.emit("state_change");
    }
  }
  /**
   * Update buffer progress.
   * Called by Driver when buffer data changes.
   */
  setBufferProgress(bufferedSeconds) {
    this._state.bufferedSeconds = bufferedSeconds;
    this.emit("buffer_progress", { bufferedSeconds });
  }
  get state() {
    return { ...this._state };
  }
};

// src/model/Driver.ts
var DEBUG = true;
var logDriver = (...args) => {
  if (DEBUG) {
    console.log("[Driver]", ...args);
  }
};
var Driver = class {
  audio;
  engine;
  _isSilentOperation = false;
  constructor(engine, audioElement) {
    this.engine = engine || new Engine();
    this.audio = audioElement || new Audio();
    this._initEngineListeners();
    this._initAudioListeners();
  }
  /**
   * Check if currently in a silent operation (pause/stop triggered by sync, not user)
   */
  get isSilentOperation() {
    return this._isSilentOperation;
  }
  _initEngineListeners() {
    this.engine.on("play", ({ src }) => {
      logDriver("\u{1F3B5} Engine play event", {
        src: src?.slice(-30),
        currentSrc: this.audio.src?.slice(-30),
        engineCurrentTime: this.engine.state.currentTime
      });
      const isSourceChanging = src && this.audio.src !== src;
      if (isSourceChanging) {
        logDriver("\u{1F504} Changing audio source");
        try {
          this.audio.src = src;
          this.engine.updateState({ error: null });
        } catch (err) {
          if (err.name !== "AbortError") {
            logDriver("\u274C Error setting src:", err.name);
            this.engine.updateState({
              error: {
                message: err.message,
                code: err.name
              }
            });
          }
        }
      }
      logDriver("\u25B6\uFE0F Calling audio.play()");
      this.audio.play().then(() => {
        const engineTime = this.engine.state.currentTime;
        const audioDiff = Math.abs(this.audio.currentTime - engineTime);
        if (audioDiff > 0.5 && engineTime > 0 && isFinite(engineTime)) {
          logDriver("\u23F1\uFE0F Syncing audio.currentTime to engine state", {
            audioTime: this.audio.currentTime,
            engineTime
          });
          try {
            this.audio.currentTime = engineTime;
          } catch (err) {
            logDriver("\u26A0\uFE0F Failed to sync currentTime:", err);
          }
        }
      }).catch((err) => {
        if (err.name !== "AbortError") {
          logDriver("\u274C Play error:", err.name, err.message);
          this.engine.updateState({
            error: {
              message: err.message,
              code: err.name
            }
          });
        } else {
          logDriver("\u26A0\uFE0F AbortError (ignored)");
        }
      });
    });
    this.engine.on("pause", () => {
      logDriver("\u23F8\uFE0F Engine pause event, calling audio.pause()");
      this.audio.pause();
    });
    this.engine.on("stop", () => {
      logDriver("\u23F9\uFE0F Engine stop event, calling audio.pause() and resetting time");
      this.audio.pause();
      if (this.audio.readyState === void 0 || this.audio.readyState >= 1 /* HAVE_METADATA */) {
        try {
          this.audio.currentTime = 0;
        } catch (err) {
          logDriver("\u26A0\uFE0F Failed to reset currentTime:", err);
        }
      }
    });
    this.engine.on("seek", (time) => {
      logDriver("\u23F1\uFE0F Engine seek event", { time, readyState: this.audio.readyState });
      if (typeof time === "number" && isFinite(time) && time >= 0) {
        if (this.audio.readyState === void 0 || this.audio.readyState >= 2 /* HAVE_CURRENT_DATA */) {
          try {
            this.audio.currentTime = time;
            logDriver("\u2705 Set currentTime to", time);
          } catch (err) {
            logDriver("\u26A0\uFE0F Failed to set currentTime:", err);
          }
        } else {
          logDriver("\u23ED\uFE0F Audio not ready, skipping seek");
        }
      } else {
        logDriver("\u23ED\uFE0F Invalid time, skipping seek");
      }
    });
  }
  _initAudioListeners() {
    this.audio.ontimeupdate = () => {
      this.engine.updateState({
        currentTime: this.audio.currentTime,
        duration: this.audio.duration || 0
      });
    };
    this.audio.onplaying = () => {
      logDriver("\u{1F50A} Audio onplaying event");
      this.engine.updateState({ isPlaying: true, error: null });
    };
    this.audio.onpause = () => {
      logDriver("\u{1F507} Audio onpause event", { isSilentOperation: this._isSilentOperation });
      if (!this._isSilentOperation) {
        this.engine.updateState({ isPlaying: false });
      }
    };
    this.audio.onerror = () => {
      logDriver("\u274C Audio onerror event");
      this.engine.updateState({
        error: {
          message: "Failed to load audio source",
          code: "MEDIA_ERR_SRC_NOT_SUPPORTED"
        }
      });
      this.engine.emitError?.();
    };
    this.audio.onended = () => {
      logDriver("\u{1F3C1} Audio onended event");
      this.engine.updateState({ isPlaying: false });
      this.engine.emitEnded?.();
    };
    this.audio.addEventListener("waiting", () => {
      logDriver("\u{1F504} Audio waiting (buffering started)");
      this.engine.setBuffering?.(true);
    });
    this.audio.addEventListener("canplay", () => {
      logDriver("\u2705 Audio canplay (buffering ended)");
      this.engine.setBuffering?.(false);
    });
    this.audio.addEventListener("canplaythrough", () => {
      logDriver("\u2705 Audio canplaythrough (fully buffered)");
      this.engine.setBuffering?.(false);
    });
    this.audio.addEventListener("progress", () => {
      if (this.audio.buffered && this.audio.buffered.length > 0) {
        try {
          const currentTime = this.audio.currentTime;
          let bufferedSeconds = 0;
          for (let i = 0; i < this.audio.buffered.length; i++) {
            const start = this.audio.buffered.start(i);
            const end = this.audio.buffered.end(i);
            if (currentTime >= start && currentTime <= end) {
              bufferedSeconds = end - currentTime;
              break;
            }
          }
          this.engine.setBufferProgress?.(bufferedSeconds);
        } catch (err) {
        }
      }
    });
    this.audio.addEventListener("loadstart", () => {
      logDriver("\u{1F4E5} Audio loadstart (starting to load)");
      this.engine.setBuffering?.(true);
    });
    this.audio.addEventListener("loadedmetadata", () => {
      logDriver("\u{1F4CA} Audio loadedmetadata");
    });
    this.audio.addEventListener("loadeddata", () => {
      logDriver("\u{1F4E6} Audio loadeddata");
    });
  }
  on(event, callback) {
    return this.engine.on(event, callback);
  }
  play(src) {
    this.engine.play(src);
  }
  pause() {
    this.engine.pause();
  }
  /**
   * Pauses audio without triggering engine events.
   * Used when leadership is transferred to another tab to prevent
   * broadcasting a PAUSE event back.
   */
  pauseSilently() {
    logDriver("\u{1F507} pauseSilently called");
    this._isSilentOperation = true;
    this.audio.pause();
    if (this.engine.stopSilently) {
      this.engine.stopSilently();
    }
    setTimeout(() => {
      this._isSilentOperation = false;
    }, 50);
  }
  seek(time) {
    this.engine.seek(time);
  }
  get state() {
    return this.engine.state;
  }
  setVolume(value) {
    const volume = Math.max(0, Math.min(1, value));
    this.audio.volume = volume;
    this.engine.updateState({ volume });
  }
  /**
   * Stops playback and resets time to 0.
   */
  stop() {
    this.engine.stop();
  }
  /**
   * Mutes audio output (sets volume to 0 without changing the volume state).
   */
  mute() {
    logDriver("\u{1F507} Muting audio");
    this.audio.muted = true;
    this.engine.updateState({ muted: true });
  }
  /**
   * Unmutes audio output.
   */
  unmute() {
    logDriver("\u{1F50A} Unmuting audio");
    this.audio.muted = false;
    this.engine.updateState({ muted: false });
  }
  /**
   * Toggles mute state.
   */
  toggleMute() {
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
  seekWhenReady(time, maxRetries = 10) {
    if (typeof time !== "number" || !isFinite(time) || time < 0) {
      return;
    }
    const trySeek = (attempt = 0) => {
      if (attempt >= maxRetries) {
        return;
      }
      if (this.audio.readyState === void 0 || this.audio.readyState >= 2) {
        try {
          this.audio.currentTime = time;
        } catch (err) {
          if (attempt < maxRetries - 1) {
            setTimeout(() => trySeek(attempt + 1), 50);
          }
        }
      } else {
        setTimeout(() => trySeek(attempt + 1), 50);
      }
    };
    trySeek();
  }
};

// src/model/EventEmitter.ts
var EventEmitter = class {
  _stateSubscribers = /* @__PURE__ */ new Set();
  _eventSubscribers = /* @__PURE__ */ new Map();
  /**
   * Subscribe to all state changes (legacy API, for backwards compatibility)
   */
  subscribe(callback) {
    this._stateSubscribers.add(callback);
    return () => this._stateSubscribers.delete(callback);
  }
  /**
   * Subscribe to a specific event type
   */
  on(event, callback) {
    if (!this._eventSubscribers.has(event)) {
      this._eventSubscribers.set(event, /* @__PURE__ */ new Set());
    }
    this._eventSubscribers.get(event).add(callback);
    return () => this._eventSubscribers.get(event)?.delete(callback);
  }
  /**
   * Unsubscribe from a specific event type
   */
  off(event, callback) {
    this._eventSubscribers.get(event)?.delete(callback);
  }
  /**
   * Emit state change (for legacy subscribe API)
   */
  emit(state) {
    this._stateSubscribers.forEach((cb) => cb(state));
    if ("stateChange" in {}) {
      this._emitEvent("stateChange", state);
    }
  }
  /**
   * Emit a specific event
   */
  _emitEvent(event, data) {
    this._eventSubscribers.get(event)?.forEach((cb) => cb(data));
  }
};

// src/model/sync/SyncCoordinator.ts
var SyncCoordinator = class {
  _channel;
  _instanceId;
  _config;
  _events;
  _isLeader = false;
  _isClaimingLeadership = false;
  _pendingAction = null;
  _handshakeTimeoutId = null;
  _isProcessingRemoteEvent = false;
  constructor(instanceId, channelName, config, events) {
    this._instanceId = instanceId;
    this._channel = new BroadcastChannel(channelName);
    this._config = config;
    this._events = events;
    this._initBroadcastListeners();
  }
  get isLeader() {
    return this._isLeader;
  }
  setLeader(value) {
    if (this._isLeader !== value) {
      this._isLeader = value;
      this._events.onLeadershipChange(value);
    }
  }
  get isProcessingRemoteEvent() {
    return this._isProcessingRemoteEvent;
  }
  /**
   * Sends a message to the broadcast channel.
   */
  broadcast(type, payload) {
    const event = {
      type,
      payload,
      timestamp: Date.now(),
      instanceId: this._instanceId
    };
    this._channel.postMessage(event);
  }
  /**
   * Initiates the leadership handshake.
   */
  claimLeadership(action, onExecute) {
    if (this._isLeader && !this._config.singlePlayback) {
      onExecute(action);
      return;
    }
    if (this._isClaimingLeadership) {
      this._pendingAction = action;
      return;
    }
    if (this._isLeader) {
      onExecute(action);
      return;
    }
    this._isClaimingLeadership = true;
    this._pendingAction = action;
    this.broadcast("LEADERSHIP_CLAIM", {
      action: action.action,
      src: action.src,
      seekTime: action.seekTime,
      isLeader: true
    });
    this._handshakeTimeoutId = setTimeout(() => {
      this._completeLeadershipHandshake(onExecute);
    }, this._config.leadershipHandshakeTimeout);
  }
  _completeLeadershipHandshake(onExecute) {
    if (!this._isClaimingLeadership) {
      return;
    }
    if (this._handshakeTimeoutId) {
      clearTimeout(this._handshakeTimeoutId);
      this._handshakeTimeoutId = null;
    }
    this.setLeader(true);
    this._isClaimingLeadership = false;
    if (this._pendingAction) {
      const action = this._pendingAction;
      this._pendingAction = null;
      onExecute(action);
    }
  }
  _initBroadcastListeners() {
    this._channel.onmessage = (event) => {
      const { type, payload, timestamp, instanceId } = event.data;
      if (instanceId === this._instanceId) {
        return;
      }
      this._isProcessingRemoteEvent = true;
      try {
        if (type === "LEADERSHIP_CLAIM") {
          this._handleLeadershipClaim(instanceId || "");
          return;
        }
        if (type === "LEADERSHIP_ACK") {
          return;
        }
        if (type === "SYNC_REQUEST") {
          this._events.onSyncRequest();
          return;
        }
        if (["PLAY", "PAUSE", "STATE_UPDATE"].includes(type) && payload.isLeader) {
          if (this._isLeader) {
            this.setLeader(false);
          }
        }
        this._events.onRemoteEvent(type, payload, timestamp);
      } finally {
        this._isProcessingRemoteEvent = false;
      }
    };
  }
  _handleLeadershipClaim(claimerId) {
    if (this._isClaimingLeadership) {
      if (this._handshakeTimeoutId) {
        clearTimeout(this._handshakeTimeoutId);
        this._handshakeTimeoutId = null;
      }
      this._isClaimingLeadership = false;
      this._pendingAction = null;
    }
    if (this._isLeader) {
      this.setLeader(false);
    }
    this.broadcast("LEADERSHIP_ACK", {});
  }
  close() {
    if (this._handshakeTimeoutId) {
      clearTimeout(this._handshakeTimeoutId);
    }
    this._channel.close();
  }
};

// src/model/sync/LatencyCompensator.ts
var LatencyCompensator = class {
  /**
   * Calculates latency-adjusted playback time.
   * If playing, adds latency compensation. Otherwise returns raw time or fallback.
   */
  static calculateAdjustedTime(currentTime, isPlaying, latencySeconds, fallback = 0) {
    const isValidTime = typeof currentTime === "number" && isFinite(currentTime);
    if (!isValidTime) {
      return fallback;
    }
    return isPlaying ? currentTime + latencySeconds : currentTime;
  }
  /**
   * Calculates the difference between local time and remote adjusted time.
   * Returns the difference in seconds.
   */
  static getDiff(localTime, remoteTime, isPlaying, latencySeconds) {
    const adjustedRemoteTime = isPlaying ? remoteTime + latencySeconds : remoteTime;
    return Math.abs(localTime - adjustedRemoteTime);
  }
};

// src/model/sync/PlaybackSyncHandler.ts
var DEBUG2 = true;
var log = (instanceId, ...args) => {
  if (DEBUG2) {
    console.log(`[PlaybackSync:${instanceId.slice(0, 4)}]`, ...args);
  }
};
var PlaybackSyncHandler = class {
  _instanceId;
  _config;
  _driver;
  _engine;
  constructor(instanceId, config, driver, engine) {
    this._instanceId = instanceId;
    this._config = config;
    this._driver = driver;
    this._engine = engine;
  }
  /**
   * Check if a sync event should be processed based on config
   */
  isSyncAllowed(type) {
    switch (type) {
      case "PLAY":
        return this._config.syncPlay;
      case "PAUSE":
        return this._config.syncPause;
      case "STATE_UPDATE":
        return this._config.syncSeek || this._config.syncTrackChange;
      // System events are always allowed
      case "SYNC_REQUEST":
      case "LEADERSHIP_CLAIM":
      case "LEADERSHIP_ACK":
        return true;
      default:
        return false;
    }
  }
  /**
   * Handle remote playback event
   */
  handleRemoteEvent(type, payload, timestamp) {
    if (!this.isSyncAllowed(type)) {
      return;
    }
    const latency = (Date.now() - timestamp) / 1e3;
    switch (type) {
      case "PLAY":
        this._handlePlay(payload, latency);
        break;
      case "PAUSE":
        this._handlePause();
        break;
      case "STATE_UPDATE":
        this._handleStateUpdate(payload, timestamp, latency);
        break;
    }
  }
  /**
   * Handle PLAY event from remote
   */
  _handlePlay(payload, latency) {
    const adjustedTime = LatencyCompensator.calculateAdjustedTime(
      payload.currentTime,
      payload.isPlaying,
      latency,
      0
    );
    if (this._config.singlePlayback) {
      this._engine.setSyncState({
        isPlaying: false,
        currentSrc: this._config.syncTrackChange ? payload.currentSrc || null : this._engine.state.currentSrc,
        duration: this._config.syncTrackChange ? payload.duration || 0 : this._engine.state.duration,
        currentTime: this._config.syncSeek ? isFinite(adjustedTime) ? adjustedTime : 0 : this._engine.state.currentTime
      });
    } else {
      const isSourceChanging = payload.currentSrc && payload.currentSrc !== this._engine.state.currentSrc;
      if (isSourceChanging && !this._config.syncTrackChange) {
        if (this._config.syncSeek) {
          this._syncTime(payload, Date.now() - latency * 1e3);
        }
        if (this._engine.state.currentSrc) {
          this._driver.play();
        }
      } else if (isSourceChanging && this._config.syncTrackChange) {
        log(this._instanceId, "\u{1F3B5} Playing new track:", payload.currentSrc);
        this._driver.play(payload.currentSrc || void 0);
        if (this._config.syncSeek && isFinite(adjustedTime) && adjustedTime >= 0) {
          this._driver.seekWhenReady(adjustedTime);
        }
      } else {
        if (this._config.syncSeek) {
          this._syncTime(payload, Date.now() - latency * 1e3);
        }
        this._driver.play();
      }
    }
  }
  /**
   * Handle PAUSE event from remote
   */
  _handlePause() {
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
  _handleStateUpdate(payload, timestamp, latency) {
    const isTrackChanging = payload.currentSrc !== this._engine.state.currentSrc;
    if (isTrackChanging && !this._config.syncTrackChange || !isTrackChanging && !this._config.syncSeek) {
      return;
    }
    const stateAdjustedTime = LatencyCompensator.calculateAdjustedTime(
      payload.currentTime,
      payload.isPlaying,
      latency,
      this._engine.state.currentTime
    );
    if (this._config.singlePlayback) {
      this._engine.setSyncState({
        isPlaying: payload.isPlaying ?? this._engine.state.isPlaying,
        currentSrc: payload.currentSrc ?? this._engine.state.currentSrc,
        currentTime: isFinite(stateAdjustedTime) ? stateAdjustedTime : this._engine.state.currentTime,
        duration: payload.duration ?? this._engine.state.duration
      });
    } else {
      if (this._config.syncSeek) {
        this._syncTime(payload, timestamp);
      }
      if (payload.isPlaying && !this._engine.state.isPlaying) {
        if (isTrackChanging && this._config.syncTrackChange) {
          log(this._instanceId, "\u25B6\uFE0F Remote started new track:", payload.currentSrc);
          this._driver.play(payload.currentSrc || void 0);
        } else if (!isTrackChanging) {
          this._driver.play();
        }
      } else if (!payload.isPlaying && this._engine.state.isPlaying) {
        log(this._instanceId, "\u23F8\uFE0F Remote paused");
        this._driver.pause();
      } else if (isTrackChanging && payload.isPlaying && this._config.syncTrackChange) {
        log(this._instanceId, "\u{1F504} Remote changed track:", payload.currentSrc);
        this._driver.play(payload.currentSrc || void 0);
      }
    }
  }
  /**
   * Sync time position with latency compensation
   */
  _syncTime(payload, sentAt) {
    if (typeof payload.currentTime !== "number" || !isFinite(payload.currentTime)) {
      return;
    }
    const latency = (Date.now() - sentAt) / 1e3;
    const adjustedTime = LatencyCompensator.calculateAdjustedTime(
      payload.currentTime,
      payload.isPlaying,
      latency
    );
    if (!isFinite(adjustedTime) || adjustedTime < 0) {
      return;
    }
    const diff = Math.abs(this._engine.state.currentTime - adjustedTime);
    if (diff > 0.3) {
      log(this._instanceId, `\u23F1\uFE0F Seeking to ${adjustedTime.toFixed(2)}s (diff=${diff.toFixed(2)}s)`);
      this._driver.seek(adjustedTime);
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AudioReadyState,
  DEFAULT_PLAYER_STATE,
  Driver,
  Engine,
  EventEmitter,
  LatencyCompensator,
  PlaybackSyncHandler,
  SyncCoordinator
});
