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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG: () => AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG,
  AudioInstance: () => AudioInstance,
  DEFAULT_PLAYLIST_CONFIG: () => DEFAULT_PLAYLIST_CONFIG,
  Playlist: () => Playlist,
  PlaylistManager: () => PlaylistManager,
  SyncPresets: () => SyncPresets,
  describeSyncConfig: () => describeSyncConfig,
  validateSyncConfig: () => validateSyncConfig
});
module.exports = __toCommonJS(index_exports);

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

// src/config/sync.config.ts
var AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG = {
  syncPlay: true,
  syncPause: true,
  syncSeek: false,
  syncTrackChange: true,
  singlePlayback: true,
  syncInterval: 1e3,
  leadershipHandshakeTimeout: 100,
  allowRemoteControl: false
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

// src/model/playlist/Playlist.ts
var DEBUG3 = true;
var log2 = (...args) => {
  if (DEBUG3) {
    console.log("[Playlist]", ...args);
  }
};
var Playlist = class extends EventEmitter {
  _tracks = [];
  _currentIndex = -1;
  _repeatMode = "none";
  _shuffleEnabled = false;
  _queue = [];
  _queueMap = [];
  // Maps queue index to tracks index
  constructor(initialTracks = []) {
    super();
    if (initialTracks.length > 0) {
      this.addMany(initialTracks);
    }
  }
  // ===== Getters =====
  /**
   * Get current playlist state
   */
  get state() {
    return {
      tracks: [...this._tracks],
      currentIndex: this._currentIndex,
      repeatMode: this._repeatMode,
      shuffleEnabled: this._shuffleEnabled,
      queue: [...this._queue],
      queueMap: [...this._queueMap]
    };
  }
  /**
   * Get current track
   */
  get currentTrack() {
    if (this._currentIndex < 0 || this._currentIndex >= this._queue.length) {
      return null;
    }
    return this._queue[this._currentIndex];
  }
  /**
   * Get all tracks
   */
  get tracks() {
    return [...this._tracks];
  }
  /**
   * Get queue (shuffled or original)
   */
  get queue() {
    return [...this._queue];
  }
  /**
   * Check if there's a next track
   */
  get hasNext() {
    if (this._repeatMode === "one") return true;
    if (this._repeatMode === "all") return true;
    return this._currentIndex < this._queue.length - 1;
  }
  /**
   * Check if there's a previous track
   */
  get hasPrev() {
    if (this._repeatMode === "one") return true;
    if (this._repeatMode === "all") return true;
    return this._currentIndex > 0;
  }
  // ===== Track Management =====
  /**
   * Add a single track to the playlist
   */
  add(track, position) {
    if (this._tracks.some((t) => t.id === track.id)) {
      log2(`\u26A0\uFE0F Track "${track.title || track.src}" (id: ${track.id}) already exists, skipping`);
      return;
    }
    const actualPosition = position ?? this._tracks.length;
    this._tracks.splice(actualPosition, 0, track);
    this._rebuildQueue();
    log2(`\u2795 Added track "${track.title || track.src}" at position ${actualPosition}`);
    this._emitEvent("queueUpdated", { tracks: this.tracks, queue: this.queue });
  }
  /**
   * Add multiple tracks to the playlist
   */
  addMany(tracks, position) {
    const newTracks = tracks.filter((track) => {
      const exists = this._tracks.some((t) => t.id === track.id);
      if (exists) {
        log2(`\u26A0\uFE0F Track "${track.title || track.src}" (id: ${track.id}) already exists, skipping`);
      }
      return !exists;
    });
    if (newTracks.length === 0) {
      log2(`\u26A0\uFE0F All tracks already exist, nothing to add`);
      return;
    }
    const actualPosition = position ?? this._tracks.length;
    this._tracks.splice(actualPosition, 0, ...newTracks);
    this._rebuildQueue();
    log2(`\u2795 Added ${newTracks.length} tracks at position ${actualPosition}`);
    this._emitEvent("queueUpdated", { tracks: this.tracks, queue: this.queue });
  }
  /**
   * Remove a track by ID
   */
  remove(trackId) {
    const index = this._tracks.findIndex((t) => t.id === trackId);
    if (index === -1) return false;
    const wasCurrentTrack = this._queueMap[this._currentIndex] === index;
    this._tracks.splice(index, 1);
    this._rebuildQueue();
    if (wasCurrentTrack && this._currentIndex >= this._queue.length) {
      this._currentIndex = Math.max(0, this._queue.length - 1);
    }
    log2(`\u2796 Removed track ${trackId}`);
    this._emitEvent("queueUpdated", { tracks: this.tracks, queue: this.queue });
    return true;
  }
  /**
   * Clear all tracks from playlist
   */
  clear() {
    const previousTrack = this.currentTrack;
    this._tracks = [];
    this._queue = [];
    this._queueMap = [];
    this._currentIndex = -1;
    log2("\u{1F5D1}\uFE0F Cleared playlist");
    this._emitEvent("queueUpdated", { tracks: [], queue: [] });
    this._emitEvent("trackChanged", {
      current: null,
      previous: previousTrack,
      currentIndex: -1
    });
  }
  /**
   * Reorder tracks
   */
  move(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this._tracks.length) return;
    if (toIndex < 0 || toIndex >= this._tracks.length) return;
    const [track] = this._tracks.splice(fromIndex, 1);
    this._tracks.splice(toIndex, 0, track);
    this._rebuildQueue();
    log2(`\u{1F500} Moved track from ${fromIndex} to ${toIndex}`);
    this._emitEvent("queueUpdated", { tracks: this.tracks, queue: this.queue });
  }
  // ===== Navigation =====
  /**
   * Jump to a specific track index in the queue
   */
  jumpTo(queueIndex) {
    if (queueIndex < 0 || queueIndex >= this._queue.length) {
      log2(`\u26A0\uFE0F Invalid queue index: ${queueIndex}`);
      return false;
    }
    const previousTrack = this.currentTrack;
    this._currentIndex = queueIndex;
    const currentTrack = this.currentTrack;
    log2(`\u23ED\uFE0F Jumped to index ${queueIndex}: "${currentTrack?.title || currentTrack?.src}"`);
    this._emitEvent("trackChanged", {
      current: currentTrack,
      previous: previousTrack,
      currentIndex: this._currentIndex
    });
    return true;
  }
  /**
   * Move to next track
   */
  next() {
    if (this._queue.length === 0) {
      log2("\u26A0\uFE0F Cannot go next: playlist is empty");
      return null;
    }
    const previousTrack = this.currentTrack;
    if (this._repeatMode === "one") {
      log2("\u{1F502} Repeat one: staying on current track");
      return this.currentTrack;
    }
    const nextIndex = this._currentIndex + 1;
    if (nextIndex >= this._queue.length) {
      if (this._repeatMode === "all") {
        this._currentIndex = 0;
        log2("\u{1F501} Repeat all: looping back to start");
      } else {
        log2("\u{1F3C1} Playlist ended");
        this._emitEvent("playlistEnded", void 0);
        return null;
      }
    } else {
      this._currentIndex = nextIndex;
    }
    const currentTrack = this.currentTrack;
    log2(`\u23ED\uFE0F Next track: "${currentTrack?.title || currentTrack?.src}"`);
    this._emitEvent("trackChanged", {
      current: currentTrack,
      previous: previousTrack,
      currentIndex: this._currentIndex
    });
    return currentTrack;
  }
  /**
   * Move to previous track
   */
  prev() {
    if (this._queue.length === 0) {
      log2("\u26A0\uFE0F Cannot go prev: playlist is empty");
      return null;
    }
    const previousTrack = this.currentTrack;
    if (this._repeatMode === "one") {
      log2("\u{1F502} Repeat one: staying on current track");
      return this.currentTrack;
    }
    const prevIndex = this._currentIndex - 1;
    if (prevIndex < 0) {
      if (this._repeatMode === "all") {
        this._currentIndex = this._queue.length - 1;
        log2("\u{1F501} Repeat all: looping to end");
      } else {
        this._currentIndex = 0;
        log2("\u23EE\uFE0F Already at start");
      }
    } else {
      this._currentIndex = prevIndex;
    }
    const currentTrack = this.currentTrack;
    log2(`\u23EE\uFE0F Previous track: "${currentTrack?.title || currentTrack?.src}"`);
    this._emitEvent("trackChanged", {
      current: currentTrack,
      previous: previousTrack,
      currentIndex: this._currentIndex
    });
    return currentTrack;
  }
  // ===== Playback Modes =====
  /**
   * Set repeat mode
   */
  setRepeat(mode) {
    if (this._repeatMode === mode) return;
    this._repeatMode = mode;
    log2(`\u{1F501} Repeat mode: ${mode}`);
    this._emitEvent("repeatModeChanged", { mode });
  }
  /**
   * Toggle shuffle
   */
  setShuffle(enabled) {
    if (this._shuffleEnabled === enabled) return;
    const currentTrack = this.currentTrack;
    this._shuffleEnabled = enabled;
    this._rebuildQueue();
    if (currentTrack) {
      const newIndex = this._queue.findIndex((t) => t.id === currentTrack.id);
      if (newIndex !== -1) {
        this._currentIndex = newIndex;
      }
    }
    log2(`\u{1F500} Shuffle: ${enabled ? "ON" : "OFF"}`);
    this._emitEvent("shuffleChanged", { enabled });
    this._emitEvent("queueUpdated", { tracks: this.tracks, queue: this.queue });
  }
  /**
   * Toggle repeat mode (none -> all -> one -> none)
   */
  toggleRepeat() {
    const modes = ["none", "all", "one"];
    const currentIndex = modes.indexOf(this._repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    this.setRepeat(nextMode);
    return nextMode;
  }
  // ===== State Management =====
  /**
   * Set complete playlist state (for sync)
   */
  setState(state) {
    const previousTrack = this.currentTrack;
    let trackChanged = false;
    if (state.tracks) {
      this._tracks = [...state.tracks];
    }
    if (typeof state.repeatMode !== "undefined") {
      this._repeatMode = state.repeatMode;
    }
    if (typeof state.shuffleEnabled !== "undefined") {
      this._shuffleEnabled = state.shuffleEnabled;
    }
    this._rebuildQueue();
    if (typeof state.currentIndex !== "undefined") {
      const validIndex = Math.max(-1, Math.min(state.currentIndex, this._queue.length - 1));
      if (this._currentIndex !== validIndex) {
        this._currentIndex = validIndex;
        trackChanged = true;
      }
    }
    log2("\u{1F4E6} State updated");
    this._emitEvent("queueUpdated", { tracks: this.tracks, queue: this.queue });
    if (trackChanged) {
      this._emitEvent("trackChanged", {
        current: this.currentTrack,
        previous: previousTrack,
        currentIndex: this._currentIndex
      });
    }
  }
  // ===== Private Methods =====
  /**
   * Rebuild queue based on shuffle state
   */
  _rebuildQueue() {
    if (this._shuffleEnabled) {
      const indices = this._tracks.map((_, i) => i);
      this._shuffleArray(indices);
      this._queueMap = indices;
      this._queue = indices.map((i) => this._tracks[i]);
    } else {
      this._queueMap = this._tracks.map((_, i) => i);
      this._queue = [...this._tracks];
    }
  }
  /**
   * Fisher-Yates shuffle algorithm
   */
  _shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
};

// src/config/playlist.config.ts
var DEFAULT_PLAYLIST_CONFIG = {
  autoAdvance: true,
  defaultRepeatMode: "none",
  defaultShuffle: false,
  syncPlaylist: true
};

// src/model/playlist/PlaylistManager.ts
var DEBUG4 = true;
var log3 = (...args) => {
  if (DEBUG4) {
    console.log("[PlaylistManager]", ...args);
  }
};
var PlaylistManager = class extends EventEmitter {
  _playlist;
  _config;
  _callbacks;
  _autoAdvanceEnabled = true;
  _isProcessingRemote = false;
  constructor(config = {}, callbacks) {
    super();
    this._config = { ...DEFAULT_PLAYLIST_CONFIG, ...config };
    this._callbacks = callbacks;
    this._playlist = new Playlist();
    this._playlist.setRepeat(this._config.defaultRepeatMode);
    this._playlist.setShuffle(this._config.defaultShuffle);
    this._autoAdvanceEnabled = this._config.autoAdvance;
    this._forwardPlaylistEvents();
    log3("\u2705 PlaylistManager created");
  }
  // ===== Getters =====
  /**
   * Get the underlying Playlist instance
   */
  get playlist() {
    return this._playlist;
  }
  /**
   * Get current track
   */
  get currentTrack() {
    return this._playlist.currentTrack;
  }
  /**
   * Get playlist state
   */
  get state() {
    return this._playlist.state;
  }
  // ===== Track Management =====
  /**
   * Add track and optionally broadcast
   */
  add(track, position) {
    this._playlist.add(track, position);
    if (!this._isProcessingRemote) {
      this._broadcastAction("PLAYLIST_ADD", { track, position });
    }
  }
  /**
   * Add multiple tracks
   */
  addMany(tracks, position) {
    this._playlist.addMany(tracks, position);
    if (!this._isProcessingRemote) {
      this._broadcastAction("PLAYLIST_ADD", { tracks, position });
    }
  }
  /**
   * Remove track by ID
   */
  remove(trackId) {
    const result = this._playlist.remove(trackId);
    if (result && !this._isProcessingRemote) {
      this._broadcastAction("PLAYLIST_REMOVE", { trackId });
    }
    return result;
  }
  /**
   * Clear playlist
   */
  clear() {
    this._playlist.clear();
    if (!this._isProcessingRemote) {
      this._broadcastAction("PLAYLIST_CLEAR", {});
    }
  }
  /**
   * Move track
   */
  move(fromIndex, toIndex) {
    this._playlist.move(fromIndex, toIndex);
    if (!this._isProcessingRemote) {
      this._broadcastAction("PLAYLIST_MOVE", { fromIndex, toIndex });
    }
  }
  // ===== Navigation & Playback =====
  /**
   * Play a specific track by queue index
   */
  playTrack(queueIndex) {
    const success = this._playlist.jumpTo(queueIndex);
    if (success && this._playlist.currentTrack) {
      this._callbacks.onPlayTrack(this._playlist.currentTrack.src);
      if (!this._isProcessingRemote) {
        this._broadcastAction("PLAYLIST_JUMP", { queueIndex });
      }
    }
    return success;
  }
  /**
   * Play next track
   */
  next() {
    const nextTrack = this._playlist.next();
    if (nextTrack) {
      this._callbacks.onPlayTrack(nextTrack.src);
      if (!this._isProcessingRemote) {
        this._broadcastAction("PLAYLIST_NEXT", {});
      }
      return true;
    }
    return false;
  }
  /**
   * Play previous track
   */
  prev() {
    const prevTrack = this._playlist.prev();
    if (prevTrack) {
      this._callbacks.onPlayTrack(prevTrack.src);
      if (!this._isProcessingRemote) {
        this._broadcastAction("PLAYLIST_PREV", {});
      }
      return true;
    }
    return false;
  }
  // ===== Modes =====
  /**
   * Set repeat mode
   */
  setRepeat(mode) {
    this._playlist.setRepeat(mode);
    if (!this._isProcessingRemote) {
      this._broadcastAction("PLAYLIST_REPEAT", { mode });
    }
  }
  /**
   * Toggle repeat mode
   */
  toggleRepeat() {
    const newMode = this._playlist.toggleRepeat();
    if (!this._isProcessingRemote) {
      this._broadcastAction("PLAYLIST_REPEAT", { mode: newMode });
    }
  }
  /**
   * Set shuffle
   */
  setShuffle(enabled) {
    this._playlist.setShuffle(enabled);
    if (!this._isProcessingRemote) {
      this._broadcastAction("PLAYLIST_SHUFFLE", { enabled });
    }
  }
  /**
   * Toggle shuffle
   */
  toggleShuffle() {
    this.setShuffle(!this._playlist.state.shuffleEnabled);
  }
  // ===== Auto-Advance =====
  /**
   * Handle track ended event from AudioInstance
   * Called automatically when a track finishes playing
   */
  onTrackEnded() {
    if (!this._autoAdvanceEnabled) {
      log3("\u23F9\uFE0F Auto-advance disabled, stopping");
      return;
    }
    log3("\u{1F504} Track ended, auto-advancing...");
    this.next();
  }
  /**
   * Enable/disable auto-advance
   */
  setAutoAdvance(enabled) {
    this._autoAdvanceEnabled = enabled;
    log3(`\u{1F504} Auto-advance: ${enabled ? "ON" : "OFF"}`);
  }
  // ===== Sync Handling =====
  /**
   * Handle remote playlist action from other tabs
   */
  handleRemoteAction(type, payload) {
    this._isProcessingRemote = true;
    try {
      switch (type) {
        case "PLAYLIST_ADD":
          if (payload.tracks) {
            this._playlist.addMany(payload.tracks, payload.position);
          } else if (payload.track) {
            this._playlist.add(payload.track, payload.position);
          }
          break;
        case "PLAYLIST_REMOVE":
          this._playlist.remove(payload.trackId);
          break;
        case "PLAYLIST_CLEAR":
          this._playlist.clear();
          break;
        case "PLAYLIST_MOVE":
          this._playlist.move(payload.fromIndex, payload.toIndex);
          break;
        case "PLAYLIST_JUMP":
          this.playTrack(payload.queueIndex);
          break;
        case "PLAYLIST_NEXT":
          this.next();
          break;
        case "PLAYLIST_PREV":
          this.prev();
          break;
        case "PLAYLIST_SHUFFLE":
          this._playlist.setShuffle(payload.enabled);
          break;
        case "PLAYLIST_REPEAT":
          this._playlist.setRepeat(payload.mode);
          break;
        case "PLAYLIST_STATE_UPDATE":
          this._playlist.setState(payload);
          break;
      }
    } finally {
      this._isProcessingRemote = false;
    }
  }
  // ===== Private Methods =====
  /**
   * Broadcast playlist action to other tabs
   */
  _broadcastAction(type, payload) {
    if (this._config.syncPlaylist && this._callbacks.onBroadcast) {
      this._callbacks.onBroadcast(type, payload);
    }
  }
  /**
   * Forward all events from Playlist to PlaylistManager subscribers
   */
  _forwardPlaylistEvents() {
    this._playlist.on("trackChanged", (data) => this._emitEvent("trackChanged", data));
    this._playlist.on("queueUpdated", (data) => this._emitEvent("queueUpdated", data));
    this._playlist.on("playlistEnded", (data) => this._emitEvent("playlistEnded", data));
    this._playlist.on("repeatModeChanged", (data) => this._emitEvent("repeatModeChanged", data));
    this._playlist.on("shuffleChanged", (data) => this._emitEvent("shuffleChanged", data));
  }
};

// src/model/types/syncConfig.types.ts
var SyncPresets = {
  /**
   * Each tab is completely independent
   */
  INDEPENDENT: {
    syncPlay: false,
    syncPause: false,
    syncSeek: false,
    syncTrackChange: false,
    singlePlayback: false,
    syncInterval: 0,
    // No periodic sync needed
    allowRemoteControl: false
  },
  /**
   * All tabs play the same content in sync
   */
  SYNCHRONIZED: {
    syncPlay: true,
    syncPause: true,
    syncSeek: true,
    syncTrackChange: true,
    singlePlayback: false,
    syncInterval: 1e3,
    allowRemoteControl: false
  },
  /**
   * One tab plays, others control (like Spotify Connect)
   * Followers can control playback but must manually claim leadership to play audio
   */
  REMOTE_CONTROL: {
    syncPlay: true,
    syncPause: true,
    syncSeek: true,
    syncTrackChange: true,
    singlePlayback: true,
    syncInterval: 1e3,
    allowRemoteControl: true
    // Followers can control without becoming leaders
  },
  /**
   * Simple play/pause sync - each tab becomes leader when it plays/pauses
   * No track or seek synchronization
   */
  PLAY_PAUSE_SYNC: {
    syncPlay: true,
    syncPause: true,
    syncSeek: false,
    syncTrackChange: false,
    singlePlayback: false,
    syncInterval: 0,
    allowRemoteControl: false
  },
  /**
   * Synced playback but independent tracks
   */
  SYNCED_PLAYBACK_INDEPENDENT_TRACKS: {
    syncPlay: true,
    syncPause: true,
    syncSeek: false,
    syncTrackChange: false,
    singlePlayback: false,
    syncInterval: 0,
    allowRemoteControl: false
  }
};
function validateSyncConfig(config) {
  const warnings = [];
  if (config.singlePlayback === true && config.syncPlay === false) {
    warnings.push(
      "\u26A0\uFE0F singlePlayback: true + syncPlay: false - Only leader plays, but play events are not synced. This may cause confusion."
    );
  }
  if (config.singlePlayback === false && config.syncPlay === false && config.syncPause === false && config.syncSeek === false && config.syncTrackChange === false) {
    warnings.push(
      "\u26A0\uFE0F All tabs play but nothing is synced - Consider using singlePlayback: true or enabling some sync options."
    );
  }
  if (config.syncTrackChange === true && config.syncPlay === false) {
    warnings.push(
      "\u26A0\uFE0F syncTrackChange: true + syncPlay: false - Tracks sync but play state does not. This may cause unexpected behavior."
    );
  }
  if (config.singlePlayback === true && config.syncInterval === 0) {
    warnings.push(
      "\u{1F4A1} singlePlayback: true + syncInterval: 0 - Consider enabling periodic sync for better follower state tracking."
    );
  }
  return {
    valid: warnings.length === 0,
    warnings
  };
}
function describeSyncConfig(config) {
  const features = [];
  if (config.singlePlayback) {
    features.push("\u{1F3B5} Only leader tab plays audio");
  } else {
    features.push("\u{1F50A} All tabs play audio simultaneously");
  }
  if (config.syncTrackChange) {
    features.push("\u{1F3B5} Tracks sync across tabs");
  } else {
    features.push("\u{1F3B5} Each tab plays independent tracks");
  }
  if (config.syncPlay && config.syncPause) {
    features.push("\u23EF\uFE0F Play/pause syncs");
  }
  if (config.syncSeek) {
    features.push("\u23E9 Seek/time syncs");
  } else {
    features.push("\u23E9 Each tab can seek independently");
  }
  return features.join("\n");
}

// src/model/AudioInstance.ts
var DEBUG5 = true;
var AUTHOR_LIB_TAG = "[borobysh/audio-sync]";
var log4 = (instanceId, ...args) => {
  if (DEBUG5) {
    console.log(`[Sync:${instanceId.slice(0, 4)}]`, ...args);
  }
};
var AudioInstance = class extends EventEmitter {
  _engine;
  _driver;
  _coordinator;
  _playbackSyncHandler;
  _playlistManager;
  _config;
  _instanceId;
  _syncIntervalId = null;
  constructor(channelName = "audio_sync_v1", config = {}) {
    super();
    this._instanceId = Math.random().toString(36).substring(2, 11);
    this._config = { ...AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG, ...config };
    this._validateConfig();
    this._engine = new Engine();
    this._driver = new Driver(this._engine);
    this._playbackSyncHandler = new PlaybackSyncHandler(
      this._instanceId,
      this._config,
      this._driver,
      this._engine
    );
    this._coordinator = new SyncCoordinator(
      this._instanceId,
      channelName,
      this._config,
      {
        onRemoteEvent: (type, payload, timestamp) => this._handleRemoteEvent(type, payload, timestamp),
        onLeadershipChange: (isLeader) => {
          log4(this._instanceId, isLeader ? "\u{1F451} Became leader" : "\u{1F451}\u27A1\uFE0F Giving up leadership");
          this._emitEvent("leaderChange", { isLeader });
          if (!isLeader && this._config.singlePlayback && this._engine.state.isPlaying) {
            log4(this._instanceId, `\u{1F507} Stopping real playback (lost leadership)`);
            this._driver.pauseSilently();
          }
        },
        onSyncRequest: () => {
          if (this._coordinator.isLeader) {
            this._broadcastState("STATE_UPDATE");
          }
        }
      }
    );
    this._playlistManager = config.playlist !== void 0 ? new PlaylistManager(
      config.playlist,
      {
        onPlayTrack: (src) => this.play(src),
        onBroadcast: (type, payload) => this._coordinator.broadcast(type, payload)
      }
    ) : null;
    this._initCoreListeners();
    this._initPeriodicSync();
    if (this._playlistManager) {
      this._initPlaylistListeners();
    }
    log4(this._instanceId, "\u{1F680} Instance created, sending SYNC_REQUEST");
    this._coordinator.broadcast("SYNC_REQUEST", {});
  }
  // --- Accessors ---
  get engine() {
    return this._engine;
  }
  get driver() {
    return this._driver;
  }
  get playlist() {
    return this._playlistManager;
  }
  get instanceId() {
    return this._instanceId;
  }
  get state() {
    return {
      ...this._engine.state,
      isLeader: this._coordinator.isLeader
    };
  }
  get isLeader() {
    return this._coordinator.isLeader;
  }
  // --- Private Methods ---
  // Delegate to PlaybackSyncHandler
  _isSyncAllowed(type) {
    return this._playbackSyncHandler.isSyncAllowed(type);
  }
  _validateConfig() {
    const validation = validateSyncConfig(this._config);
    if (validation.warnings.length > 0) {
      console.warn(`${AUTHOR_LIB_TAG} Configuration warnings:`);
      validation.warnings.forEach((w) => console.warn(w));
    }
    console.log(`${AUTHOR_LIB_TAG} Current configuration:`);
    console.log(describeSyncConfig(this._config));
  }
  _initCoreListeners() {
    let previousSrc = null;
    this._engine.on("state_change", () => {
      const state = this.state;
      this.emit(state);
      this._emitEvent("timeUpdate", { currentTime: state.currentTime, duration: state.duration });
      if (state.currentSrc !== previousSrc) {
        this._emitEvent("trackChange", { src: state.currentSrc, previousSrc });
        previousSrc = state.currentSrc;
      }
    });
    const broadcastLocalAction = (type) => {
      if (this._coordinator.isProcessingRemoteEvent || !this._isSyncAllowed(type)) return;
      this._coordinator.setLeader(true);
      this._broadcastState(type);
    };
    this._engine.on("play", () => {
      broadcastLocalAction("PLAY");
      this._emitEvent("play", { src: this._engine.state.currentSrc });
    });
    this._engine.on("pause", () => {
      broadcastLocalAction("PAUSE");
      this._emitEvent("pause", void 0);
    });
    this._engine.on("stop", () => this._emitEvent("stop", void 0));
    this._engine.on("seek", () => {
      broadcastLocalAction("STATE_UPDATE");
      this._emitEvent("seek", { time: this._engine.state.currentTime });
    });
    this._engine.on("ended", () => {
      this._emitEvent("ended", void 0);
      if (this._playlistManager) {
        this._playlistManager.onTrackEnded();
      }
    });
    this._engine.on("error", () => {
      const error = this._engine.state.error;
      if (error) this._emitEvent("error", error);
    });
    this._engine.on("buffering", ({ isBuffering }) => {
      this._emitEvent("buffering", { isBuffering });
    });
    this._engine.on("buffer_progress", ({ bufferedSeconds }) => {
      this._emitEvent("bufferProgress", { bufferedSeconds });
    });
  }
  _initPlaylistListeners() {
    if (!this._playlistManager) return;
    this._playlistManager.on("trackChanged", (data) => this._emitEvent("playlistTrackChanged", data));
    this._playlistManager.on("queueUpdated", (data) => this._emitEvent("playlistQueueUpdated", data));
    this._playlistManager.on("playlistEnded", (data) => this._emitEvent("playlistEnded", data));
    this._playlistManager.on("repeatModeChanged", (data) => this._emitEvent("playlistRepeatModeChanged", data));
    this._playlistManager.on("shuffleChanged", (data) => this._emitEvent("playlistShuffleChanged", data));
  }
  _broadcastState(type) {
    this._coordinator.broadcast(type, {
      ...this._engine.state,
      isLeader: true
    });
  }
  _initPeriodicSync() {
    if (this._config.syncInterval <= 0) return;
    this._syncIntervalId = setInterval(() => {
      if (this._coordinator.isLeader && this._engine.state.isPlaying) {
        this._broadcastState("STATE_UPDATE");
      }
    }, this._config.syncInterval);
  }
  _stopPeriodicSync() {
    if (this._syncIntervalId) {
      clearInterval(this._syncIntervalId);
      this._syncIntervalId = null;
    }
  }
  /**
   * Route remote events to appropriate handlers
   */
  _handleRemoteEvent(type, payload, timestamp) {
    if (this._playlistManager && type.startsWith("PLAYLIST_")) {
      this._playlistManager.handleRemoteAction(type, payload);
      return;
    }
    this._playbackSyncHandler.handleRemoteEvent(type, payload, timestamp);
  }
  _executeAction(action) {
    switch (action.action) {
      case "play":
        this._driver.play(action.src);
        break;
      case "pause":
        this._driver.pause();
        break;
      case "seek":
        if (typeof action.seekTime === "number") this._driver.seek(action.seekTime);
        break;
      case "stop":
        this._driver.stop();
        break;
    }
  }
  // --- Public API ---
  /**
   * Manually claim leadership on this tab.
   * Useful in remote control mode where followers control playback without auto-leadership.
   */
  becomeLeader() {
    if (this._config.singlePlayback) {
      this._coordinator.claimLeadership({ action: "play" }, (a) => {
        log4(this._instanceId, "\u{1F451} Manually became leader");
      });
    }
  }
  play(src) {
    if (this._config.singlePlayback) {
      if (this._config.allowRemoteControl && !this._coordinator.isLeader) {
        if (src) {
          this._engine.setSyncState({ currentSrc: src, isPlaying: true });
        } else {
          this._engine.setSyncState({ isPlaying: true });
        }
        this._broadcastState("PLAY");
      } else {
        this._coordinator.claimLeadership({ action: "play", src }, (a) => this._executeAction(a));
      }
    } else {
      this._driver.play(src);
    }
  }
  pause() {
    if (this._config.singlePlayback) {
      if (this._config.allowRemoteControl && !this._coordinator.isLeader) {
        this._engine.setSyncState({ isPlaying: false });
        this._broadcastState("PAUSE");
      } else {
        this._coordinator.claimLeadership({ action: "pause" }, (a) => this._executeAction(a));
      }
    } else {
      this._driver.pause();
    }
  }
  seek(time) {
    if (this._config.singlePlayback) {
      if (this._config.allowRemoteControl && !this._coordinator.isLeader) {
        this._engine.setSyncState({ currentTime: time });
        this._broadcastState("STATE_UPDATE");
      } else {
        this._coordinator.claimLeadership({ action: "seek", seekTime: time }, (a) => this._executeAction(a));
      }
    } else {
      this._driver.seek(time);
    }
  }
  setVolume(value) {
    this._driver.setVolume(value);
  }
  stop() {
    if (this._config.singlePlayback) {
      this._coordinator.claimLeadership({ action: "stop" }, (a) => this._executeAction(a));
    } else {
      this._driver.stop();
    }
  }
  mute() {
    this._driver.mute();
  }
  unmute() {
    this._driver.unmute();
  }
  toggleMute() {
    this._driver.toggleMute();
  }
  destroy() {
    this._stopPeriodicSync();
    this._coordinator.close();
    this._driver.stop();
    this._engine.setSyncState(DEFAULT_PLAYER_STATE);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG,
  AudioInstance,
  DEFAULT_PLAYLIST_CONFIG,
  Playlist,
  PlaylistManager,
  SyncPresets,
  describeSyncConfig,
  validateSyncConfig
});
