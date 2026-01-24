# Playlist API Reference

The Playlist API provides powerful playlist management with shuffle, repeat modes, and event-driven architecture.

## PlaylistManager

`PlaylistManager` is integrated with `AudioInstance` and handles auto-advance, synchronization, and playback coordination.

### Accessing PlaylistManager

```typescript
import { AudioInstance } from '@borobysh/audio-sync-core';

const player = new AudioInstance('app', {
  playlist: {
    autoAdvance: true,
    defaultRepeatMode: 'all'
  }
});

const playlist = player.playlist; // PlaylistManager instance
```

## Track Interface

```typescript
interface Track {
  id: string;            // Unique identifier (required)
  src: string;           // Audio source URL (required)
  title?: string;        // Track title
  artist?: string;       // Artist name
  album?: string;        // Album name
  duration?: number;     // Duration in seconds
  coverArt?: string;     // Cover art URL
  metadata?: Record<string, any>; // Additional metadata
}
```

## Properties

### `state`

```typescript
readonly state: PlaylistState
```

Current playlist state.

```typescript
interface PlaylistState {
  tracks: Track[];           // All tracks (original order)
  currentIndex: number;      // Current index in queue
  repeatMode: RepeatMode;    // Current repeat mode
  shuffleEnabled: boolean;   // Is shuffle enabled
  queue: Track[];           // Playback queue (shuffled if shuffle is on)
  queueMap: number[];       // Maps queue index to tracks index
}
```

### `currentTrack`

```typescript
readonly currentTrack: Track | null
```

Currently playing track, or `null` if none.

## Methods

### Track Management

#### `add()`

```typescript
add(track: Track, position?: number): void
```

Add a single track to the playlist.

**Parameters:**
- `track`: Track to add
- `position` (optional): Insert position (default: end of playlist)

**Example:**

```typescript
playlist.add({
  id: '123',
  src: 'https://example.com/song.mp3',
  title: 'My Song',
  artist: 'Artist Name'
});

// Add at specific position
playlist.add(track, 2); // Insert at index 2
```

#### `addMany()`

```typescript
addMany(tracks: Track[], position?: number): void
```

Add multiple tracks at once.

**Parameters:**
- `tracks`: Array of tracks to add
- `position` (optional): Insert position

**Example:**

```typescript
const tracks = [
  { id: '1', src: 'song1.mp3', title: 'Song 1' },
  { id: '2', src: 'song2.mp3', title: 'Song 2' },
  { id: '3', src: 'song3.mp3', title: 'Song 3' }
];

playlist.addMany(tracks);
```

#### `remove()`

```typescript
remove(trackId: string): boolean
```

Remove a track by ID.

**Parameters:**
- `trackId`: ID of track to remove

**Returns:** `true` if track was removed, `false` if not found

**Example:**

```typescript
const removed = playlist.remove('123');
if (removed) {
  console.log('Track removed');
}
```

#### `clear()`

```typescript
clear(): void
```

Remove all tracks from the playlist.

**Example:**

```typescript
playlist.clear();
```

#### `move()`

```typescript
move(fromIndex: number, toIndex: number): void
```

Move a track from one position to another.

**Parameters:**
- `fromIndex`: Current index in queue
- `toIndex`: Target index in queue

**Example:**

```typescript
// Move track from index 0 to index 3
playlist.move(0, 3);
```

### Navigation

#### `playTrack()`

```typescript
playTrack(queueIndex: number): boolean
```

Play a specific track by its index in the queue.

**Parameters:**
- `queueIndex`: Index in the playback queue

**Returns:** `true` if successful

**Example:**

```typescript
// Play first track
playlist.playTrack(0);

// Play third track
playlist.playTrack(2);
```

#### `next()`

```typescript
next(): boolean
```

Play the next track in the queue.

**Returns:** `true` if there is a next track

**Example:**

```typescript
if (playlist.next()) {
  console.log('Playing next track');
} else {
  console.log('No next track available');
}
```

#### `prev()`

```typescript
prev(): boolean
```

Play the previous track in the queue.

**Returns:** `true` if there is a previous track

**Example:**

```typescript
if (playlist.prev()) {
  console.log('Playing previous track');
}
```

### Playback Modes

#### `setRepeat()`

```typescript
setRepeat(mode: RepeatMode): void
```

Set repeat mode.

**Parameters:**
- `mode`: `'none'`, `'all'`, or `'one'`

**Modes:**
- `'none'`: No repeat (stop at end of playlist)
- `'all'`: Repeat entire playlist
- `'one'`: Repeat current track

**Example:**

```typescript
playlist.setRepeat('all');  // Repeat all tracks
playlist.setRepeat('one');  // Repeat current track
playlist.setRepeat('none'); // No repeat
```

#### `toggleRepeat()`

```typescript
toggleRepeat(): RepeatMode
```

Cycle through repeat modes: none → all → one → none.

**Returns:** New repeat mode

**Example:**

```typescript
const newMode = playlist.toggleRepeat();
console.log('Repeat mode:', newMode);
```

#### `setShuffle()`

```typescript
setShuffle(enabled: boolean): void
```

Enable or disable shuffle.

**Parameters:**
- `enabled`: `true` to enable shuffle, `false` to disable

**Example:**

```typescript
playlist.setShuffle(true);  // Enable shuffle
playlist.setShuffle(false); // Disable shuffle
```

#### `toggleShuffle()`

```typescript
toggleShuffle(): void
```

Toggle shuffle on/off.

**Example:**

```typescript
playlist.toggleShuffle();
```

#### `setAutoAdvance()`

```typescript
setAutoAdvance(enabled: boolean): void
```

Enable or disable auto-advance to next track.

**Parameters:**
- `enabled`: `true` to auto-play next track when current ends

**Example:**

```typescript
playlist.setAutoAdvance(true);  // Auto-play next
playlist.setAutoAdvance(false); // Stop after current
```

### Events

#### `on()`

```typescript
on<T extends PlaylistEventType>(
  event: T,
  callback: (data: PlaylistEventPayloads[T]) => void
): () => void
```

Subscribe to playlist events.

**Available Events:**

| Event | Data Type | Description |
|-------|-----------|-------------|
| `trackChanged` | `{ current: Track \| null; previous: Track \| null; currentIndex: number }` | Current track changed |
| `queueUpdated` | `{ tracks: Track[]; queue: Track[] }` | Queue was updated |
| `playlistEnded` | `undefined` | Reached end of playlist (no repeat) |
| `repeatModeChanged` | `{ mode: RepeatMode }` | Repeat mode changed |
| `shuffleChanged` | `{ enabled: boolean }` | Shuffle state changed |

**Example:**

```typescript
// Track changed
playlist.on('trackChanged', ({ current, previous }) => {
  console.log('Now playing:', current?.title);
  console.log('Was playing:', previous?.title);
});

// Queue updated (tracks added/removed/moved)
playlist.on('queueUpdated', ({ tracks, queue }) => {
  console.log('Playlist now has', tracks.length, 'tracks');
  updatePlaylistUI(queue);
});

// Playlist ended
playlist.on('playlistEnded', () => {
  console.log('Reached end of playlist');
  showReplayButton();
});

// Repeat mode changed
playlist.on('repeatModeChanged', ({ mode }) => {
  console.log('Repeat mode:', mode);
  updateRepeatButton(mode);
});

// Shuffle changed
playlist.on('shuffleChanged', ({ enabled }) => {
  console.log('Shuffle:', enabled ? 'ON' : 'OFF');
  updateShuffleButton(enabled);
});
```

## Complete Examples

### Basic Playlist

```typescript
import { AudioInstance, Track } from '@borobysh/audio-sync-core';

const player = new AudioInstance('music-app', {
  playlist: {
    autoAdvance: true,
    defaultRepeatMode: 'all'
  }
});

const playlist = player.playlist!;

// Add tracks
const tracks: Track[] = [
  { id: '1', src: 'song1.mp3', title: 'Song 1', artist: 'Artist A' },
  { id: '2', src: 'song2.mp3', title: 'Song 2', artist: 'Artist B' },
  { id: '3', src: 'song3.mp3', title: 'Song 3', artist: 'Artist C' }
];

playlist.addMany(tracks);

// Play first track
playlist.playTrack(0);

// Navigate
document.getElementById('next')?.addEventListener('click', () => {
  playlist.next();
});

document.getElementById('prev')?.addEventListener('click', () => {
  playlist.prev();
});

// Controls
document.getElementById('shuffle')?.addEventListener('click', () => {
  playlist.toggleShuffle();
});

document.getElementById('repeat')?.addEventListener('click', () => {
  playlist.toggleRepeat();
});
```

### Advanced Playlist UI

```typescript
import { AudioInstance, Track } from '@borobysh/audio-sync-core';

// Initialize
const player = new AudioInstance('music-player', {
  playlist: { autoAdvance: true }
});

const playlist = player.playlist!;

// UI Update Functions
function updateNowPlaying(track: Track | null) {
  const titleEl = document.getElementById('now-playing-title');
  const artistEl = document.getElementById('now-playing-artist');
  
  if (track) {
    titleEl.textContent = track.title || 'Unknown';
    artistEl.textContent = track.artist || 'Unknown Artist';
  } else {
    titleEl.textContent = 'No track playing';
    artistEl.textContent = '';
  }
}

function renderPlaylist(tracks: Track[], currentIndex: number) {
  const container = document.getElementById('playlist');
  container.innerHTML = '';
  
  tracks.forEach((track, index) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    if (index === currentIndex) {
      item.classList.add('active');
    }
    
    item.innerHTML = `
      <div class="track-number">${index + 1}</div>
      <div class="track-info">
        <div class="track-title">${track.title || 'Unknown'}</div>
        <div class="track-artist">${track.artist || 'Unknown Artist'}</div>
      </div>
    `;
    
    item.addEventListener('click', () => playlist.playTrack(index));
    container.appendChild(item);
  });
}

// Event Listeners
playlist.on('trackChanged', ({ current }) => {
  updateNowPlaying(current);
  renderPlaylist(playlist.state.queue, playlist.state.currentIndex);
});

playlist.on('queueUpdated', () => {
  renderPlaylist(playlist.state.queue, playlist.state.currentIndex);
});

playlist.on('shuffleChanged', ({ enabled }) => {
  document.getElementById('shuffle-btn')?.classList.toggle('active', enabled);
});

playlist.on('repeatModeChanged', ({ mode }) => {
  const btn = document.getElementById('repeat-btn');
  btn.textContent = mode === 'none' ? '🔁' : mode === 'all' ? '🔁 All' : '🔂 One';
});

// Load tracks
const tracks: Track[] = [...]; // Your tracks
playlist.addMany(tracks);

// Start playing
playlist.playTrack(0);
```

### Dynamic Playlist Management

```typescript
import { AudioInstance, Track } from '@borobysh/audio-sync-core';

const player = new AudioInstance('dynamic-player', {
  playlist: { autoAdvance: true }
});

const playlist = player.playlist!;

// Add tracks progressively
async function loadMoreTracks() {
  const newTracks = await fetchTracksFromAPI();
  playlist.addMany(newTracks);
}

// Remove finished tracks
playlist.on('trackChanged', ({ previous }) => {
  if (previous && shouldRemoveAfterPlaying(previous)) {
    playlist.remove(previous.id);
  }
});

// Reorder playlist
function moveTrackUp(trackId: string) {
  const state = playlist.state;
  const index = state.queue.findIndex(t => t.id === trackId);
  if (index > 0) {
    playlist.move(index, index - 1);
  }
}

// Smart shuffle (keep current track)
function smartShuffle() {
  const currentTrack = playlist.currentTrack;
  playlist.setShuffle(true);
  
  if (currentTrack) {
    // Re-select current track after shuffle
    const newIndex = playlist.state.queue.findIndex(t => t.id === currentTrack.id);
    if (newIndex >= 0) {
      playlist.playTrack(newIndex);
    }
  }
}
```

## See Also

- [AudioInstance API](./AudioInstance.md)
- [Configuration Guide](./configuration.md)
- [Playlist Management Guide](../guides/playlist-management.md)
- [Event Handling Guide](../guides/event-handling.md)
