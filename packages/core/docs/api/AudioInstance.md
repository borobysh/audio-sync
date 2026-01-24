# AudioInstance API Reference

`AudioInstance` is the main class for creating synchronized audio players.

## Constructor

```typescript
new AudioInstance(channelName?: string, config?: AudioInstanceConfig)
```

### Parameters

- **`channelName`** (optional): `string` - Unique channel name for BroadcastChannel. All instances with the same channel name will be synchronized. Default: `'audio_sync_v1'`
- **`config`** (optional): `AudioInstanceConfig` - Configuration options

### Example

```typescript
import { AudioInstance } from '@borobysh/audio-sync-core';

const player = new AudioInstance('my-app-channel', {
  singlePlayback: false,
  syncSeek: true,
  playlist: {
    autoAdvance: true,
    defaultRepeatMode: 'all'
  }
});
```

## Properties

### `state`

```typescript
readonly state: SyncCoreState
```

Current state of the audio player.

**SyncCoreState Interface:**

```typescript
interface SyncCoreState {
  isPlaying: boolean;        // Is audio currently playing
  currentTime: number;       // Current playback time in seconds
  duration: number;          // Total duration in seconds
  volume: number;            // Volume (0.0 - 1.0)
  muted: boolean;            // Is audio muted
  currentSrc: string | null; // Current audio source URL
  isLeader: boolean;         // Is this tab the leader
  error: AudioError | null;  // Current error, if any
}
```

### `instanceId`

```typescript
readonly instanceId: string
```

Unique identifier for this instance.

### `isLeader`

```typescript
readonly isLeader: boolean
```

Whether this instance is the current leader. Equivalent to `state.isLeader`.

### `playlist`

```typescript
readonly playlist: PlaylistManager | null
```

Playlist manager instance if playlist is enabled, otherwise `null`.

## Methods

### Playback Control

#### `play()`

```typescript
play(src?: string): void
```

Start or resume playback.

**Parameters:**
- `src` (optional): Audio source URL. If provided, switches to this track first.

**Example:**

```typescript
// Resume playback
player.play();

// Play a new track
player.play('https://example.com/song.mp3');
```

#### `pause()`

```typescript
pause(): void
```

Pause playback.

**Example:**

```typescript
player.pause();
```

#### `stop()`

```typescript
stop(): void
```

Stop playback and reset current time to 0.

**Example:**

```typescript
player.stop();
```

#### `seek()`

```typescript
seek(time: number): void
```

Seek to a specific time position.

**Parameters:**
- `time`: Time in seconds

**Example:**

```typescript
// Seek to 1 minute
player.seek(60);

// Seek to 50% of duration
player.seek(player.state.duration * 0.5);
```

### Volume Control

#### `setVolume()`

```typescript
setVolume(value: number): void
```

Set volume level.

**Parameters:**
- `value`: Volume level (0.0 - 1.0)

**Example:**

```typescript
player.setVolume(0.8); // 80% volume
player.setVolume(0);   // Silent
player.setVolume(1);   // Max volume
```

#### `mute()`

```typescript
mute(): void
```

Mute audio.

**Example:**

```typescript
player.mute();
```

#### `unmute()`

```typescript
unmute(): void
```

Unmute audio.

**Example:**

```typescript
player.unmute();
```

#### `toggleMute()`

```typescript
toggleMute(): void
```

Toggle mute state.

**Example:**

```typescript
player.toggleMute();
```

### Event Handling

#### `subscribe()`

```typescript
subscribe(callback: (state: SyncCoreState) => void): () => void
```

Subscribe to all state changes. Returns an unsubscribe function.

**Parameters:**
- `callback`: Function called on every state change

**Returns:** Unsubscribe function

**Example:**

```typescript
const unsubscribe = player.subscribe((state) => {
  console.log('State updated:', state);
  updateUI(state);
});

// Later, unsubscribe
unsubscribe();
```

#### `on()`

```typescript
on<T extends AudioInstanceEventType>(
  event: T,
  callback: (data: AudioInstanceEventData[T]) => void
): () => void
```

Subscribe to a specific event. Returns an unsubscribe function.

**Available Events:**

| Event | Data Type | Description |
|-------|-----------|-------------|
| `stateChange` | `SyncCoreState` | Any state change |
| `play` | `{ src: string \| null }` | Playback started |
| `pause` | `void` | Playback paused |
| `stop` | `void` | Playback stopped |
| `ended` | `void` | Track ended |
| `timeUpdate` | `{ currentTime: number; duration: number }` | Time updated |
| `seek` | `{ time: number }` | User seeked |
| `trackChange` | `{ src: string \| null; previousSrc: string \| null }` | Track changed |
| `volumeChange` | `{ volume: number; muted: boolean }` | Volume changed |
| `leaderChange` | `{ isLeader: boolean }` | Leadership changed |
| `error` | `{ message: string; code: string \| null }` | Error occurred |
| `playlistTrackChanged` | `{ current: Track \| null; previous: Track \| null }` | Playlist track changed |
| `playlistQueueUpdated` | `{ tracks: Track[]; queue: Track[] }` | Playlist queue updated |
| `playlistEnded` | `undefined` | Playlist ended |

**Example:**

```typescript
// Listen to play events
player.on('play', ({ src }) => {
  console.log('Started playing:', src);
});

// Listen to time updates
player.on('timeUpdate', ({ currentTime, duration }) => {
  updateProgressBar(currentTime / duration);
});

// Listen to errors
player.on('error', ({ message, code }) => {
  console.error('Player error:', message, code);
});

// Unsubscribe
const unsubscribe = player.on('pause', () => {
  console.log('Paused');
});
unsubscribe();
```

#### `off()`

```typescript
off<T extends AudioInstanceEventType>(
  event: T,
  callback: (data: AudioInstanceEventData[T]) => void
): void
```

Unsubscribe from a specific event.

**Example:**

```typescript
const handlePlay = ({ src }) => console.log('Playing:', src);

player.on('play', handlePlay);
player.off('play', handlePlay); // Unsubscribe
```

### Lifecycle

#### `destroy()`

```typescript
destroy(): void
```

Clean up the instance, stop playback, and close all connections.

**Important:** Always call `destroy()` when you're done with the instance to prevent memory leaks.

**Example:**

```typescript
// When component unmounts
player.destroy();
```

## Configuration

### AudioInstanceConfig

```typescript
interface AudioInstanceConfig extends SyncConfig {
  playlist?: Partial<PlaylistConfig>;
}
```

### SyncConfig

```typescript
interface SyncConfig {
  syncPlay?: boolean;           // Sync play events (default: true)
  syncPause?: boolean;          // Sync pause events (default: true)
  syncSeek?: boolean;           // Sync seek operations (default: true)
  syncTrackChange?: boolean;    // Sync track changes (default: true)
  singlePlayback?: boolean;     // Only leader plays audio (default: true)
  syncInterval?: number;        // Periodic sync interval in ms (default: 1000)
  leadershipHandshakeTimeout?: number; // Leadership timeout in ms (default: 100)
}
```

### PlaylistConfig

```typescript
interface PlaylistConfig {
  autoAdvance: boolean;         // Auto-play next track (default: true)
  defaultRepeatMode: RepeatMode; // 'none', 'all', or 'one' (default: 'none')
  defaultShuffle: boolean;      // Start with shuffle (default: false)
  syncPlaylist: boolean;        // Sync playlist changes (default: true)
}
```

## Examples

### Basic Player

```typescript
const player = new AudioInstance('music-app');

player.play('https://example.com/song.mp3');

player.on('play', () => {
  console.log('Playing');
});

player.on('pause', () => {
  console.log('Paused');
});

// Cleanup
player.destroy();
```

### Full-Featured Player

```typescript
const player = new AudioInstance('advanced-player', {
  singlePlayback: false,
  syncSeek: true,
  syncInterval: 500,
  playlist: {
    autoAdvance: true,
    defaultRepeatMode: 'all',
    syncPlaylist: false
  }
});

// State subscription
player.subscribe((state) => {
  document.getElementById('time').textContent = 
    `${state.currentTime.toFixed(1)}s / ${state.duration.toFixed(1)}s`;
  document.getElementById('volume').value = state.volume * 100;
});

// Event handlers
player.on('leaderChange', ({ isLeader }) => {
  document.body.classList.toggle('is-leader', isLeader);
});

player.on('error', ({ message }) => {
  alert('Player error: ' + message);
});

// Playlist
const tracks = [
  { id: '1', src: 'song1.mp3', title: 'Song 1' },
  { id: '2', src: 'song2.mp3', title: 'Song 2' }
];

player.playlist?.addMany(tracks);
player.playlist?.playTrack(0);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  player.destroy();
});
```

## See Also

- [Playlist API](./Playlist.md)
- [Configuration Guide](./configuration.md)
- [Event Handling](../guides/event-handling.md)
- [Synchronization Guide](../guides/synchronization.md)
