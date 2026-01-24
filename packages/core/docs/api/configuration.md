# Configuration Reference

Complete reference for all configuration options in Audio Sync Core.

## AudioInstanceConfig

Main configuration object passed to `AudioInstance` constructor.

```typescript
interface AudioInstanceConfig extends SyncConfig {
  playlist?: Partial<PlaylistConfig>;
}
```

## SyncConfig

Synchronization behavior configuration.

```typescript
interface SyncConfig {
  syncPlay?: boolean;
  syncPause?: boolean;
  syncSeek?: boolean;
  syncTrackChange?: boolean;
  singlePlayback?: boolean;
  syncInterval?: number;
  leadershipHandshakeTimeout?: number;
}
```

### `syncPlay`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Synchronize play events across tabs

When `true`, playing audio in one tab will trigger play in all other tabs (or update their state in single playback mode).

```typescript
const player = new AudioInstance('app', {
  syncPlay: true // Play events are synchronized
});
```

### `syncPause`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Synchronize pause events across tabs

When `true`, pausing in one tab will pause all other tabs.

```typescript
const player = new AudioInstance('app', {
  syncPause: true // Pause events are synchronized
});
```

### `syncSeek`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Synchronize seek operations across tabs

When `true`, seeking to a specific time in one tab will seek all other tabs to the same position.

```typescript
const player = new AudioInstance('app', {
  syncSeek: true // Seek operations are synchronized
});
```

### `syncTrackChange`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Synchronize track changes across tabs

When `true`, changing the audio source in one tab will change it in all other tabs.

```typescript
const player = new AudioInstance('app', {
  syncTrackChange: true // Track changes are synchronized
});
```

### `singlePlayback`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Whether only the leader tab plays audio

**When `true` (Single Playback Mode):**
- Only the leader tab plays actual audio
- Follower tabs track state but play silently
- Saves bandwidth and prevents multiple audio streams
- Good for traditional player experience

**When `false` (Multi-Tab Playback Mode):**
- All tabs play audio simultaneously
- Audio is synchronized across all tabs
- Provides redundancy if one tab is closed
- Good for consistent experience across tabs

```typescript
// Single playback - only leader plays
const player1 = new AudioInstance('app', {
  singlePlayback: true
});

// Multi-tab playback - all tabs play
const player2 = new AudioInstance('app', {
  singlePlayback: false
});
```

### `syncInterval`

- **Type:** `number`
- **Default:** `1000` (1 second)
- **Description:** Interval in milliseconds for periodic state sync from leader

The leader broadcasts its current state at this interval to keep followers synchronized. Lower values provide tighter sync but increase network traffic.

- `0`: Disable periodic sync (only sync on explicit actions)
- `500`: Sync every 0.5 seconds (tighter sync, more traffic)
- `1000`: Sync every second (default, good balance)
- `2000`: Sync every 2 seconds (looser sync, less traffic)

```typescript
const player = new AudioInstance('app', {
  syncInterval: 1000 // Sync every second
});
```

### `leadershipHandshakeTimeout`

- **Type:** `number`
- **Default:** `100` (100ms)
- **Description:** Timeout in milliseconds for leadership handshake

When a tab claims leadership, it waits this long for acknowledgment from other tabs before assuming leadership. Lower values mean faster response but higher chance of conflicts.

```typescript
const player = new AudioInstance('app', {
  leadershipHandshakeTimeout: 100 // Wait 100ms
});
```

## PlaylistConfig

Playlist behavior configuration.

```typescript
interface PlaylistConfig {
  autoAdvance?: boolean;
  defaultRepeatMode?: RepeatMode;
  defaultShuffle?: boolean;
  syncPlaylist?: boolean;
}
```

### `autoAdvance`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Automatically play next track when current track ends

When `true`, the playlist automatically advances to the next track. When `false`, playback stops at the end of each track.

```typescript
const player = new AudioInstance('app', {
  playlist: {
    autoAdvance: true // Auto-play next track
  }
});
```

### `defaultRepeatMode`

- **Type:** `'none' | 'all' | 'one'`
- **Default:** `'none'`
- **Description:** Initial repeat mode

**Modes:**
- `'none'`: No repeat, stop at end of playlist
- `'all'`: Repeat entire playlist
- `'one'`: Repeat current track

```typescript
const player = new AudioInstance('app', {
  playlist: {
    defaultRepeatMode: 'all' // Start with repeat all
  }
});
```

### `defaultShuffle`

- **Type:** `boolean`
- **Default:** `false`
- **Description:** Start with shuffle enabled

When `true`, playlist starts in shuffle mode.

```typescript
const player = new AudioInstance('app', {
  playlist: {
    defaultShuffle: true // Start with shuffle on
  }
});
```

### `syncPlaylist`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Synchronize playlist changes across tabs

When `true`, adding/removing/reordering tracks in one tab will update all other tabs.

**Note:** Duplicate protection is built-in, so tracks won't be duplicated across tabs even with sync enabled.

```typescript
const player = new AudioInstance('app', {
  playlist: {
    syncPlaylist: true // Sync playlist across tabs
  }
});
```

## Default Configurations

### Default Sync Config

```typescript
const AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG = {
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: true,
  singlePlayback: true,
  syncInterval: 1000,
  leadershipHandshakeTimeout: 100
};
```

### Default Playlist Config

```typescript
const DEFAULT_PLAYLIST_CONFIG = {
  autoAdvance: true,
  defaultRepeatMode: 'none',
  defaultShuffle: false,
  syncPlaylist: true
};
```

## Configuration Presets

### Preset: Traditional Music Player

Single playback, full sync, repeat all.

```typescript
const player = new AudioInstance('music-app', {
  singlePlayback: true,
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: true,
  playlist: {
    autoAdvance: true,
    defaultRepeatMode: 'all',
    syncPlaylist: false
  }
});
```

### Preset: Multi-Tab Radio

All tabs play, no seek sync, no playlist.

```typescript
const player = new AudioInstance('radio-app', {
  singlePlayback: false,
  syncPlay: true,
  syncPause: true,
  syncSeek: false,
  syncTrackChange: true,
  syncInterval: 2000
});
```

### Preset: Podcast Player

Single playback, full sync, no repeat, remember position.

```typescript
const player = new AudioInstance('podcast-app', {
  singlePlayback: true,
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: true,
  playlist: {
    autoAdvance: true,
    defaultRepeatMode: 'none',
    syncPlaylist: true
  }
});
```

### Preset: Independent Playlists

No sync, each tab has its own playlist.

```typescript
const player = new AudioInstance('independent-app', {
  syncPlay: false,
  syncPause: false,
  syncSeek: false,
  syncTrackChange: false,
  singlePlayback: false,
  playlist: {
    autoAdvance: true,
    syncPlaylist: false
  }
});
```

### Preset: Collaborative Playlist

Full sync including playlist, single playback.

```typescript
const player = new AudioInstance('collaborative-app', {
  singlePlayback: true,
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: true,
  playlist: {
    autoAdvance: true,
    defaultRepeatMode: 'all',
    syncPlaylist: true // Playlist syncs across tabs
  }
});
```

## Configuration Tips

### Performance Optimization

```typescript
// Reduce sync frequency for better performance
const player = new AudioInstance('app', {
  syncInterval: 2000 // Sync every 2 seconds instead of 1
});
```

### Tight Synchronization

```typescript
// Increase sync frequency for tighter sync
const player = new AudioInstance('app', {
  syncInterval: 500, // Sync twice per second
  leadershipHandshakeTimeout: 50 // Faster handshake
});
```

### Bandwidth Conservation

```typescript
// Use single playback to save bandwidth
const player = new AudioInstance('app', {
  singlePlayback: true,
  syncInterval: 2000 // Less frequent updates
});
```

### Maximum Reliability

```typescript
// Multi-tab playback with fast sync
const player = new AudioInstance('app', {
  singlePlayback: false, // Redundant playback
  syncInterval: 500, // Frequent sync
  syncSeek: true,
  syncPlay: true,
  syncPause: true
});
```

## Dynamic Configuration

While you can't change configuration after creating an instance, you can adjust some behaviors dynamically:

```typescript
const player = new AudioInstance('app');

// Dynamic playlist settings
player.playlist?.setAutoAdvance(false);
player.playlist?.setRepeat('one');
player.playlist?.setShuffle(true);

// Note: Sync settings cannot be changed after initialization
// You would need to destroy and recreate the instance
```

## See Also

- [AudioInstance API](./AudioInstance.md)
- [Playlist API](./Playlist.md)
- [Getting Started](../getting-started.md)
- [Synchronization Guide](../guides/synchronization.md)
