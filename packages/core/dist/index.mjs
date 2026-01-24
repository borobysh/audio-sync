import {
  AbstractDriver,
  DEFAULT_PLAYER_STATE,
  Driver,
  Engine,
  EventEmitter,
  PlaybackSyncHandler,
  SyncCoordinator,
  createLogger
} from "./chunk-ZN6YASYK.mjs";

// src/model/playlist/Playlist.ts
var log = createLogger("Playlist");
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
      log(`\u26A0\uFE0F Track "${track.title || track.src}" (id: ${track.id}) already exists, skipping`);
      return;
    }
    const actualPosition = position ?? this._tracks.length;
    this._tracks.splice(actualPosition, 0, track);
    this._rebuildQueue();
    log(`\u2795 Added track "${track.title || track.src}" at position ${actualPosition}`);
    this._emitEvent("queueUpdated", { tracks: this.tracks, queue: this.queue });
  }
  /**
   * Add multiple tracks to the playlist
   */
  addMany(tracks, position) {
    const newTracks = tracks.filter((track) => {
      const exists = this._tracks.some((t) => t.id === track.id);
      if (exists) {
        log(`\u26A0\uFE0F Track "${track.title || track.src}" (id: ${track.id}) already exists, skipping`);
      }
      return !exists;
    });
    if (newTracks.length === 0) {
      log(`\u26A0\uFE0F All tracks already exist, nothing to add`);
      return;
    }
    const actualPosition = position ?? this._tracks.length;
    this._tracks.splice(actualPosition, 0, ...newTracks);
    this._rebuildQueue();
    log(`\u2795 Added ${newTracks.length} tracks at position ${actualPosition}`);
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
    log(`\u2796 Removed track ${trackId}`);
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
    log("\u{1F5D1}\uFE0F Cleared playlist");
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
    log(`\u{1F500} Moved track from ${fromIndex} to ${toIndex}`);
    this._emitEvent("queueUpdated", { tracks: this.tracks, queue: this.queue });
  }
  // ===== Navigation =====
  /**
   * Jump to a specific track index in the queue
   */
  jumpTo(queueIndex) {
    if (queueIndex < 0 || queueIndex >= this._queue.length) {
      log(`\u26A0\uFE0F Invalid queue index: ${queueIndex}`);
      return false;
    }
    const previousTrack = this.currentTrack;
    this._currentIndex = queueIndex;
    const currentTrack = this.currentTrack;
    log(`\u23ED\uFE0F Jumped to index ${queueIndex}: "${currentTrack?.title || currentTrack?.src}"`);
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
      log("\u26A0\uFE0F Cannot go next: playlist is empty");
      return null;
    }
    const previousTrack = this.currentTrack;
    if (this._repeatMode === "one") {
      log("\u{1F502} Repeat one: staying on current track");
      return this.currentTrack;
    }
    const nextIndex = this._currentIndex + 1;
    if (nextIndex >= this._queue.length) {
      if (this._repeatMode === "all") {
        this._currentIndex = 0;
        log("\u{1F501} Repeat all: looping back to start");
      } else {
        log("\u{1F3C1} Playlist ended");
        this._emitEvent("playlistEnded", void 0);
        return null;
      }
    } else {
      this._currentIndex = nextIndex;
    }
    const currentTrack = this.currentTrack;
    log(`\u23ED\uFE0F Next track: "${currentTrack?.title || currentTrack?.src}"`);
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
      log("\u26A0\uFE0F Cannot go prev: playlist is empty");
      return null;
    }
    const previousTrack = this.currentTrack;
    if (this._repeatMode === "one") {
      log("\u{1F502} Repeat one: staying on current track");
      return this.currentTrack;
    }
    const prevIndex = this._currentIndex - 1;
    if (prevIndex < 0) {
      if (this._repeatMode === "all") {
        this._currentIndex = this._queue.length - 1;
        log("\u{1F501} Repeat all: looping to end");
      } else {
        this._currentIndex = 0;
        log("\u23EE\uFE0F Already at start");
      }
    } else {
      this._currentIndex = prevIndex;
    }
    const currentTrack = this.currentTrack;
    log(`\u23EE\uFE0F Previous track: "${currentTrack?.title || currentTrack?.src}"`);
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
    log(`\u{1F501} Repeat mode: ${mode}`);
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
    log(`\u{1F500} Shuffle: ${enabled ? "ON" : "OFF"}`);
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
    log("\u{1F4E6} State updated");
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
var log2 = createLogger("PlaylistManager");
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
    log2("\u2705 PlaylistManager created");
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
      log2("\u23F9\uFE0F Auto-advance disabled, stopping");
      return;
    }
    log2("\u{1F504} Track ended, auto-advancing...");
    this.next();
  }
  /**
   * Enable/disable auto-advance
   */
  setAutoAdvance(enabled) {
    this._autoAdvanceEnabled = enabled;
    log2(`\u{1F504} Auto-advance: ${enabled ? "ON" : "OFF"}`);
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

// src/config/syncConfig.ts
var AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG = {
  syncPlay: true,
  syncPause: true,
  syncSeek: false,
  syncTrackChange: true,
  singlePlayback: true,
  syncInterval: 1e3,
  leadershipHandshakeTimeout: 100,
  allowRemoteControl: false,
  autoClaimLeadershipIfNone: true
};
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
    allowRemoteControl: false,
    autoClaimLeadershipIfNone: false
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
    allowRemoteControl: false,
    autoClaimLeadershipIfNone: false
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
    allowRemoteControl: true,
    autoClaimLeadershipIfNone: true
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
    allowRemoteControl: false,
    autoClaimLeadershipIfNone: false
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
    allowRemoteControl: false,
    autoClaimLeadershipIfNone: false
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

// src/model/mediaSession/AbstractMediaSession.ts
var AbstractMediaSession = class {
  config;
  callbacks;
  isActive = false;
  constructor(config, callbacks) {
    this.config = this._mergeWithDefaults(config);
    this.callbacks = callbacks;
  }
  /**
   * Check if Media Session is currently active
   */
  isMediaSessionActive() {
    return this.isActive;
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return this.config;
  }
  /**
   * Merge user config with defaults
   */
  _mergeWithDefaults(config) {
    return {
      enabled: config.enabled ?? true,
      seekStep: config.seekStep ?? 10,
      updateInterval: config.updateInterval ?? 1e3,
      actions: config.actions,
      artwork: {
        defaultUrl: config.artwork?.defaultUrl,
        sizes: config.artwork?.sizes ?? [96, 128, 192, 256, 384, 512]
      }
    };
  }
};

// src/model/mediaSession/BrowserMediaSession.ts
var BrowserMediaSession = class extends AbstractMediaSession {
  _log;
  _updateIntervalId = null;
  _registeredActions = /* @__PURE__ */ new Set();
  constructor(config, callbacks) {
    super(config, callbacks);
    this._log = createLogger("MediaSession");
    if (!this.isSupported()) {
      this._log("\u26A0\uFE0F Media Session API not supported in this browser");
    }
  }
  /**
   * Check if Media Session API is supported
   */
  isSupported() {
    return typeof navigator !== "undefined" && "mediaSession" in navigator;
  }
  /**
   * Activate Media Session and register action handlers
   */
  activate() {
    if (!this.isSupported() || !this.config.enabled) {
      return;
    }
    if (this.isActive) {
      this._log("\u26A0\uFE0F Already active");
      return;
    }
    this._log("\u2705 Activating Media Session");
    this.isActive = true;
    this._registerActionHandlers();
    if (this.config.updateInterval > 0) {
      this._startPositionUpdates();
    }
  }
  /**
   * Deactivate Media Session and unregister handlers
   */
  deactivate() {
    if (!this.isSupported() || !this.isActive) {
      return;
    }
    this._log("\u{1F507} Deactivating Media Session");
    this.isActive = false;
    this._unregisterActionHandlers();
    this._stopPositionUpdates();
    this.clear();
  }
  /**
   * Update metadata for currently playing track
   */
  updateMetadata(metadata) {
    if (!this.isSupported() || !this.config.enabled) {
      return;
    }
    try {
      const artwork = this._prepareArtwork(metadata.artwork);
      if ("MediaMetadata" in window) {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: metadata.title || "Unknown Title",
          artist: metadata.artist || "Unknown Artist",
          album: metadata.album || "",
          artwork
        });
        this._log("\u{1F4DD} Metadata updated:", metadata.title, "-", metadata.artist);
      }
    } catch (error) {
      this._log("\u274C Failed to update metadata:", error);
    }
  }
  /**
   * Update playback state
   */
  setPlaybackState(state) {
    if (!this.isSupported() || !this.config.enabled) {
      return;
    }
    try {
      navigator.mediaSession.playbackState = state;
      this._log("\u25B6\uFE0F Playback state:", state);
    } catch (error) {
      this._log("\u274C Failed to set playback state:", error);
    }
  }
  /**
   * Update position state (current time, duration, playback rate)
   */
  setPositionState(state) {
    if (!this.isSupported() || !this.config.enabled) {
      return;
    }
    try {
      const duration = typeof state.duration === "number" && isFinite(state.duration) && state.duration > 0 ? state.duration : void 0;
      const position = typeof state.position === "number" && isFinite(state.position) && state.position >= 0 ? Math.min(state.position, duration || Infinity) : void 0;
      const playbackRate = typeof state.playbackRate === "number" && isFinite(state.playbackRate) && state.playbackRate > 0 ? state.playbackRate : 1;
      if (duration !== void 0 && position !== void 0) {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position
        });
      }
    } catch (error) {
    }
  }
  /**
   * Set custom action handler
   */
  setActionHandler(action, handler) {
    if (!this.isSupported() || !this.config.enabled) {
      return;
    }
    try {
      navigator.mediaSession.setActionHandler(action, handler);
      if (handler) {
        this._registeredActions.add(action);
        this._log("\u{1F3AE} Action handler registered:", action);
      } else {
        this._registeredActions.delete(action);
        this._log("\u{1F3AE} Action handler unregistered:", action);
      }
    } catch (error) {
      this._log("\u274C Failed to set action handler:", action, error);
    }
  }
  /**
   * Clear all metadata and reset state
   */
  clear() {
    if (!this.isSupported()) {
      return;
    }
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      this._log("\u{1F9F9} Metadata cleared");
    } catch (error) {
      this._log("\u274C Failed to clear metadata:", error);
    }
  }
  /**
   * Destroy and cleanup resources
   */
  destroy() {
    this._log("\u{1F4A5} Destroying Media Session");
    this.deactivate();
  }
  // --- Private Methods ---
  /**
   * Register default action handlers based on config
   */
  _registerActionHandlers() {
    const actionsToRegister = this.config.actions || this._getDefaultActions();
    for (const action of actionsToRegister) {
      const handler = this._getActionHandler(action);
      if (handler) {
        this.setActionHandler(action, handler);
      }
    }
  }
  /**
   * Unregister all action handlers
   */
  _unregisterActionHandlers() {
    for (const action of this._registeredActions) {
      this.setActionHandler(action, null);
    }
    this._registeredActions.clear();
  }
  /**
   * Get default actions to register
   */
  _getDefaultActions() {
    const actions = ["play", "pause"];
    if (this.callbacks.onPreviousTrack) {
      actions.push("previoustrack");
    }
    if (this.callbacks.onNextTrack) {
      actions.push("nexttrack");
    }
    if (this.callbacks.onSeekBackward) {
      actions.push("seekbackward");
    }
    if (this.callbacks.onSeekForward) {
      actions.push("seekforward");
    }
    if (this.callbacks.onSeekTo) {
      actions.push("seekto");
    }
    if (this.callbacks.onStop) {
      actions.push("stop");
    }
    return actions;
  }
  /**
   * Get action handler for specific action
   */
  _getActionHandler(action) {
    switch (action) {
      case "play":
        return () => {
          this._log("\u{1F3AE} Action: play");
          this.callbacks.onPlay();
        };
      case "pause":
        return () => {
          this._log("\u{1F3AE} Action: pause");
          this.callbacks.onPause();
        };
      case "stop":
        return this.callbacks.onStop ? () => {
          this._log("\u{1F3AE} Action: stop");
          this.callbacks.onStop();
        } : null;
      case "previoustrack":
        return this.callbacks.onPreviousTrack ? () => {
          this._log("\u{1F3AE} Action: previoustrack");
          this.callbacks.onPreviousTrack();
        } : null;
      case "nexttrack":
        return this.callbacks.onNextTrack ? () => {
          this._log("\u{1F3AE} Action: nexttrack");
          this.callbacks.onNextTrack();
        } : null;
      case "seekbackward":
        return this.callbacks.onSeekBackward ? (details) => {
          const seekOffset = details?.seekOffset || this.config.seekStep;
          this._log("\u{1F3AE} Action: seekbackward", seekOffset);
          this.callbacks.onSeekBackward(seekOffset);
        } : null;
      case "seekforward":
        return this.callbacks.onSeekForward ? (details) => {
          const seekOffset = details?.seekOffset || this.config.seekStep;
          this._log("\u{1F3AE} Action: seekforward", seekOffset);
          this.callbacks.onSeekForward(seekOffset);
        } : null;
      case "seekto":
        return this.callbacks.onSeekTo ? (details) => {
          if (details?.seekTime !== void 0) {
            this._log("\u{1F3AE} Action: seekto", details.seekTime);
            this.callbacks.onSeekTo(details.seekTime, details.fastSeek);
          }
        } : null;
      default:
        return null;
    }
  }
  /**
   * Prepare artwork array with proper sizes
   */
  _prepareArtwork(artwork) {
    if (!artwork || artwork.length === 0) {
      if (this.config.artwork.defaultUrl) {
        return this._generateArtworkSizes(this.config.artwork.defaultUrl);
      }
      return [];
    }
    if (Array.isArray(artwork) && artwork.length > 0) {
      return artwork;
    }
    return [];
  }
  /**
   * Generate artwork array with multiple sizes
   */
  _generateArtworkSizes(url) {
    const sizes = this.config.artwork.sizes || [96, 128, 192, 256, 384, 512];
    return sizes.map((size) => ({
      src: url,
      sizes: `${size}x${size}`,
      type: this._guessImageType(url)
    }));
  }
  /**
   * Guess image MIME type from URL
   */
  _guessImageType(url) {
    const ext = url.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "png":
        return "image/png";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "webp":
        return "image/webp";
      case "gif":
        return "image/gif";
      case "svg":
        return "image/svg+xml";
      default:
        return "image/jpeg";
    }
  }
  /**
   * Start periodic position state updates
   */
  _startPositionUpdates() {
    if (this._updateIntervalId) {
      return;
    }
  }
  /**
   * Stop periodic position state updates
   */
  _stopPositionUpdates() {
    if (this._updateIntervalId) {
      clearInterval(this._updateIntervalId);
      this._updateIntervalId = null;
    }
  }
};

// src/model/mediaSession/MediaSessionManager.ts
var MediaSessionManager = class {
  _mediaSession;
  _log;
  _isLeader = false;
  _currentState = {};
  constructor(config, callbacks, mediaSessionImpl) {
    this._log = createLogger("MediaSessionManager");
    if (mediaSessionImpl) {
      this._mediaSession = mediaSessionImpl;
    } else {
      this._mediaSession = new BrowserMediaSession(config, callbacks);
    }
    if (!this._mediaSession.isSupported()) {
      this._log("\u26A0\uFE0F Media Session API not supported - graceful degradation");
    } else {
      this._log("\u2705 Media Session Manager initialized");
    }
  }
  /**
   * Handle leadership change
   * Only leader should control Media Session to avoid conflicts
   */
  onLeadershipChange(isLeader) {
    this._isLeader = isLeader;
    if (isLeader) {
      this._log("\u{1F451} Became leader - activating Media Session");
      this._mediaSession.activate();
      if (this._currentState.currentSrc) {
        this._updateFromState(this._currentState);
      }
    } else {
      this._log("\u{1F465} Lost leadership - deactivating Media Session");
      this._mediaSession.deactivate();
    }
  }
  /**
   * Handle state updates from AudioInstance
   */
  onStateUpdate(state) {
    this._currentState = { ...this._currentState, ...state };
    if (!this._isLeader || !this._mediaSession.isSupported()) {
      return;
    }
    this._updateFromState(state);
  }
  /**
   * Handle track change
   */
  onTrackChange(metadata) {
    if (!this._isLeader || !this._mediaSession.isSupported()) {
      return;
    }
    this._log("\u{1F3B5} Track changed:", metadata.title);
    this._mediaSession.updateMetadata(metadata);
  }
  /**
   * Handle playback state change
   */
  onPlaybackStateChange(isPlaying) {
    if (!this._isLeader || !this._mediaSession.isSupported()) {
      return;
    }
    const state = isPlaying ? "playing" : "paused";
    this._mediaSession.setPlaybackState(state);
  }
  /**
   * Update position state
   */
  updatePositionState(currentTime, duration, playbackRate = 1) {
    if (!this._isLeader || !this._mediaSession.isSupported()) {
      return;
    }
    this._mediaSession.setPositionState({
      position: currentTime,
      duration,
      playbackRate
    });
  }
  /**
   * Check if Media Session is supported
   */
  isSupported() {
    return this._mediaSession.isSupported();
  }
  /**
   * Check if Media Session is active
   */
  isActive() {
    return this._mediaSession.isMediaSessionActive();
  }
  /**
   * Get Media Session instance (for advanced usage)
   */
  getMediaSession() {
    return this._mediaSession;
  }
  /**
   * Destroy and cleanup
   */
  destroy() {
    this._log("\u{1F4A5} Destroying Media Session Manager");
    this._mediaSession.destroy();
  }
  // --- Private Methods ---
  /**
   * Update Media Session from state
   */
  _updateFromState(state) {
    if (state.isPlaying !== void 0) {
      this.onPlaybackStateChange(state.isPlaying);
    }
    if (state.currentTime !== void 0 && state.duration !== void 0) {
      this.updatePositionState(
        state.currentTime,
        state.duration,
        1
      );
    }
  }
};

// src/model/AudioInstance.ts
var AUTHOR_LIB_TAG = "[borobysh/audio-sync]";
var AudioInstance = class extends EventEmitter {
  _engine;
  _driver;
  _coordinator;
  _playbackSyncHandler;
  _playlistManager;
  _mediaSessionManager;
  _config;
  _instanceId;
  _log;
  _syncIntervalId = null;
  constructor(channelName = "audio_sync_v1", config = {}) {
    super();
    this._instanceId = Math.random().toString(36).substring(2, 11);
    this._config = { ...AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG, ...config };
    this._log = createLogger("Sync", this._instanceId);
    this._validateConfig();
    this._engine = new Engine();
    if (config.driver) {
      this._driver = config.driver;
    } else if (config.audioElement) {
      this._driver = new Driver(this._engine, config.audioElement);
    } else {
      this._driver = new Driver(this._engine);
    }
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
          this._log(isLeader ? "\u{1F451} Became leader" : "\u{1F451}\u27A1\uFE0F Giving up leadership");
          this._emitEvent("leaderChange", { isLeader });
          if (this._mediaSessionManager) {
            this._mediaSessionManager.onLeadershipChange(isLeader);
          }
          if (!isLeader && this._config.singlePlayback && this._engine.state.isPlaying) {
            this._log("\u{1F507} Stopping real playback (lost leadership)");
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
    this._mediaSessionManager = this._initMediaSession(config);
    this._initCoreListeners();
    this._initPeriodicSync();
    if (this._playlistManager) {
      this._initPlaylistListeners();
    }
    if (this._mediaSessionManager) {
      this._initMediaSessionListeners();
    }
    this._log("\u{1F680} Instance created, sending SYNC_REQUEST");
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
  get mediaSession() {
    return this._mediaSessionManager;
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
  _initMediaSession(config) {
    if (config.mediaSession?.enabled === false) {
      return null;
    }
    const mediaSessionConfig = {
      enabled: true,
      seekStep: 10,
      updateInterval: 1e3,
      ...config.mediaSession
    };
    const callbacks = {
      onPlay: () => {
        this._log("\u{1F3AE} Media Session: play");
        this.play();
      },
      onPause: () => {
        this._log("\u{1F3AE} Media Session: pause");
        this.pause();
      },
      onStop: () => {
        this._log("\u{1F3AE} Media Session: stop");
        this.stop();
      },
      onSeekBackward: (seekOffset) => {
        const offset = seekOffset || mediaSessionConfig.seekStep;
        const newTime = Math.max(0, this._engine.state.currentTime - offset);
        this._log("\u{1F3AE} Media Session: seekbackward", offset, "seconds");
        this.seek(newTime);
      },
      onSeekForward: (seekOffset) => {
        const offset = seekOffset || mediaSessionConfig.seekStep;
        const newTime = Math.min(
          this._engine.state.duration || Infinity,
          this._engine.state.currentTime + offset
        );
        this._log("\u{1F3AE} Media Session: seekforward", offset, "seconds");
        this.seek(newTime);
      },
      onSeekTo: (seekTime) => {
        this._log("\u{1F3AE} Media Session: seekto", seekTime);
        this.seek(seekTime);
      },
      onPreviousTrack: this._playlistManager ? () => {
        this._log("\u{1F3AE} Media Session: previoustrack");
        this._playlistManager.prev();
      } : void 0,
      onNextTrack: this._playlistManager ? () => {
        this._log("\u{1F3AE} Media Session: nexttrack");
        this._playlistManager.next();
      } : void 0
    };
    return new MediaSessionManager(
      mediaSessionConfig,
      callbacks,
      config.mediaSessionImpl
    );
  }
  _initMediaSessionListeners() {
    if (!this._mediaSessionManager) return;
    this._engine.on("state_change", () => {
      this._mediaSessionManager.onStateUpdate(this.state);
    });
    this.on("trackChange", ({ src }) => {
      const metadata = {
        title: src || "Unknown Track",
        artist: "Unknown Artist"
      };
      if (this._playlistManager) {
        const currentTrack = this._playlistManager.currentTrack;
        if (currentTrack) {
          metadata.title = currentTrack.title || currentTrack.src;
          metadata.artist = currentTrack.artist;
          metadata.album = currentTrack.album;
          if (currentTrack.coverArt) {
            metadata.artwork = [
              { src: currentTrack.coverArt, sizes: "512x512", type: "image/jpeg" }
            ];
          }
        }
      }
      this._mediaSessionManager.onTrackChange(metadata);
    });
    this.on("play", () => {
      this._mediaSessionManager.onPlaybackStateChange(true);
    });
    this.on("pause", () => {
      this._mediaSessionManager.onPlaybackStateChange(false);
    });
    this.on("stop", () => {
      this._mediaSessionManager.onPlaybackStateChange(false);
    });
  }
  _broadcastState(type, isRemoteCommand = false, customData) {
    this._coordinator.broadcast(type, {
      ...this._engine.state,
      isLeader: !isRemoteCommand,
      // Remote commands don't claim leadership
      isRemoteCommand,
      customData
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
    const isRemoteCommand = payload.isRemoteCommand === true;
    if (this._coordinator.isLeader && isRemoteCommand) {
      this._handleRemoteControlCommand(type, payload);
      return;
    }
    this._playbackSyncHandler.handleRemoteEvent(type, payload, timestamp);
  }
  /**
   * Handle remote control commands sent by followers
   * Only executed on leader
   */
  _handleRemoteControlCommand(type, payload) {
    this._log("\u{1F3AE} Received remote control command:", type, payload.currentSrc || "");
    switch (type) {
      case "PLAY":
        if (payload.currentSrc && payload.currentSrc !== this._engine.state.currentSrc) {
          this._driver.play(payload.currentSrc);
        } else {
          this._driver.play();
        }
        break;
      case "PAUSE":
        this._driver.pause();
        break;
      case "STATE_UPDATE":
        if (typeof payload.currentTime === "number" && isFinite(payload.currentTime)) {
          this._driver.seek(payload.currentTime);
        }
        break;
    }
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
  // --- Private Helpers ---
  /**
   * Execute action with remote control logic:
   * - If we're the leader: claim leadership and execute
   * - If remote control enabled: send command or auto-claim if no leader
   * - Otherwise: claim leadership and execute
   */
  _executeWithRemoteControlLogic(action, eventType, onRemoteCommand) {
    const isRemoteControlFollower = this._config.allowRemoteControl && !this._coordinator.isLeader;
    if (!isRemoteControlFollower) {
      this._coordinator.claimLeadership(action, (a) => this._executeAction(a));
      return;
    }
    if (!this._config.autoClaimLeadershipIfNone) {
      onRemoteCommand();
      this._broadcastState(eventType, true);
      return;
    }
    this._coordinator.checkForActiveLeader((hasLeader) => {
      if (hasLeader) {
        this._log(`\u{1F4E1} Sending remote ${eventType} command to leader`);
        onRemoteCommand();
        this._broadcastState(eventType, true);
      } else {
        this._log("\u{1F451} No leader found, auto-claiming leadership");
        this._coordinator.claimLeadership(action, (a) => this._executeAction(a));
      }
    });
  }
  // --- Public API ---
  /**
   * Manually claim leadership on this tab.
   * Useful in remote control mode where followers control playback without auto-leadership.
   */
  becomeLeader() {
    if (this._config.singlePlayback) {
      this._coordinator.claimLeadership({ action: "play" }, () => {
        this._log("\u{1F451} Manually became leader");
      });
    }
  }
  play(src) {
    if (!this._config.singlePlayback) {
      this._driver.play(src);
      return;
    }
    this._executeWithRemoteControlLogic(
      { action: "play", src },
      "PLAY",
      () => {
        if (src) {
          this._engine.setSyncState({ currentSrc: src, isPlaying: true });
        } else {
          this._engine.setSyncState({ isPlaying: true });
        }
      }
    );
  }
  pause() {
    if (!this._config.singlePlayback) {
      this._driver.pause();
      return;
    }
    this._executeWithRemoteControlLogic(
      { action: "pause" },
      "PAUSE",
      () => {
        this._engine.setSyncState({ isPlaying: false });
      }
    );
  }
  seek(time) {
    if (!this._config.singlePlayback) {
      this._driver.seek(time);
      return;
    }
    this._executeWithRemoteControlLogic(
      { action: "seek", seekTime: time },
      "STATE_UPDATE",
      () => {
        this._engine.setSyncState({ currentTime: time });
      }
    );
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
    if (this._mediaSessionManager) {
      this._mediaSessionManager.destroy();
    }
  }
};
export {
  AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG,
  AbstractDriver,
  AbstractMediaSession,
  AudioInstance,
  BrowserMediaSession,
  DEFAULT_PLAYLIST_CONFIG,
  Driver,
  MediaSessionManager,
  Playlist,
  PlaylistManager,
  SyncPresets,
  describeSyncConfig,
  validateSyncConfig
};
