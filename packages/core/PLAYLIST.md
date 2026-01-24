# 🎵 Playlist Module

Playlist management with cross-tab synchronization, shuffle, and repeat modes.

## 📦 Installation

```typescript
import { AudioInstance } from '@borobysh/audio-sync-core';
import type { Track } from '@borobysh/audio-sync-core';
```

## 🚀 Quick Start

### Basic Usage

```typescript
// Create AudioInstance with playlist enabled
const player = new AudioInstance('my-channel', {
    playlist: {
        autoAdvance: true,         // Auto-play next track
        defaultRepeatMode: 'none', // 'none' | 'all' | 'one'
        defaultShuffle: false,
        syncPlaylist: true         // Sync playlist between tabs
    }
});

const playlist = player.playlist!;

// Add tracks
const tracks: Track[] = [
    { id: '1', src: 'track1.mp3', title: 'Song 1', artist: 'Artist A' },
    { id: '2', src: 'track2.mp3', title: 'Song 2', artist: 'Artist B' },
    { id: '3', src: 'track3.mp3', title: 'Song 3', artist: 'Artist C' },
];

playlist.addMany(tracks);

// Play first track
playlist.playTrack(0);

// Navigate
playlist.next(); // → Song 2
playlist.prev(); // → Song 1

// Shuffle & Repeat
playlist.setShuffle(true);
playlist.setRepeat('all');
```

## 🎯 Core Concepts

### 1. Track Interface

```typescript
interface Track {
    id: string;          // Unique identifier
    src: string;         // Audio file URL
    title?: string;      // Track title
    artist?: string;     // Artist name
    album?: string;      // Album name
    duration?: number;   // Duration in seconds
    coverArt?: string;   // Cover art URL
    metadata?: Record<string, any>; // Custom metadata
}
```

### 2. Playlist State

```typescript
interface PlaylistState {
    tracks: Track[];        // Original track order
    currentIndex: number;   // Current position in queue
    repeatMode: 'none' | 'all' | 'one';
    shuffleEnabled: boolean;
    queue: Track[];         // Actual playback queue (shuffled if enabled)
    queueMap: number[];     // Maps queue index to tracks index
}
```

## 📚 API Reference

### Track Management

```typescript
// Add single track
playlist.add(track, position?: number);

// Add multiple tracks
playlist.addMany(tracks, position?: number);

// Remove track by ID
playlist.remove(trackId: string): boolean;

// Clear all tracks
playlist.clear(): void;

// Move track
playlist.move(fromIndex: number, toIndex: number): void;
```

### Navigation

```typescript
// Play specific track by queue index
playlist.playTrack(queueIndex: number): boolean;

// Next track
playlist.next(): boolean;

// Previous track
playlist.prev(): boolean;

// Current track
const track = playlist.currentTrack; // Track | null
```

### Playback Modes

```typescript
// Repeat modes
playlist.setRepeat('none');  // No repeat
playlist.setRepeat('all');   // Loop entire playlist
playlist.setRepeat('one');   // Repeat current track
playlist.toggleRepeat();      // Cycle through modes

// Shuffle
playlist.setShuffle(true);
playlist.toggleShuffle();
```

### State Access

```typescript
// Get complete state
const state = playlist.state;
console.log(state.tracks);        // All tracks
console.log(state.queue);         // Playback queue
console.log(state.currentIndex);  // Current position
console.log(state.repeatMode);    // Repeat mode
console.log(state.shuffleEnabled); // Shuffle state

// Direct access
const tracks = playlist.playlist.tracks;
const currentTrack = playlist.currentTrack;
```

## 🎧 Events

Listen to playlist events for UI updates:

```typescript
// Track changed
playlist.on('trackChanged', ({ current, previous, currentIndex }) => {
    console.log(`Now playing: ${current?.title}`);
    updateUI(current);
});

// Queue updated
playlist.on('queueUpdated', ({ tracks, queue }) => {
    console.log(`Playlist has ${tracks.length} tracks`);
    renderPlaylist(queue);
});

// Playlist ended
playlist.on('playlistEnded', () => {
    console.log('Playlist finished');
});

// Repeat mode changed
playlist.on('repeatModeChanged', ({ mode }) => {
    console.log(`Repeat: ${mode}`);
    updateRepeatButton(mode);
});

// Shuffle changed
playlist.on('shuffleChanged', ({ enabled }) => {
    console.log(`Shuffle: ${enabled ? 'ON' : 'OFF'}`);
    updateShuffleButton(enabled);
});
```

## 🔄 Auto-Advance

When a track ends, the playlist automatically advances to the next track:

```typescript
// Default behavior (enabled)
const player = new AudioInstance('channel', {
    playlist: {
        autoAdvance: true  // ✅ Auto-play next track
    }
});

// Disable auto-advance
const player = new AudioInstance('channel', {
    playlist: {
        autoAdvance: false  // ❌ Stop when track ends
    }
});

// Or control manually
playlist.setAutoAdvance(false);
```

## 🌐 Cross-Tab Synchronization

Playlist actions are automatically synchronized across all tabs:

```typescript
// Tab 1: Add tracks
playlist.addMany(tracks);

// Tab 2: Playlist automatically updated!
console.log(playlist.state.tracks); // Same tracks

// Tab 1: Change track
playlist.next();

// Tab 2: Current track automatically updates!
console.log(playlist.currentTrack); // Same track
```

### Sync Behavior

| Action | All Tabs |
|--------|----------|
| `add()`, `addMany()` | ✅ Synced |
| `remove()`, `clear()` | ✅ Synced |
| `next()`, `prev()` | ✅ Synced |
| `playTrack()` | ✅ Synced |
| `setShuffle()` | ✅ Synced |
| `setRepeat()` | ✅ Synced |

## 💡 Examples

### Example 1: Music Player

```typescript
const player = new AudioInstance('music-player', {
    singlePlayback: true,
    playlist: {
        autoAdvance: true,
        defaultRepeatMode: 'all'
    }
});

const playlist = player.playlist!;

// Load playlist
playlist.addMany([
    { id: '1', src: 'song1.mp3', title: 'Bohemian Rhapsody', artist: 'Queen' },
    { id: '2', src: 'song2.mp3', title: 'Stairway to Heaven', artist: 'Led Zeppelin' },
    { id: '3', src: 'song3.mp3', title: 'Hotel California', artist: 'Eagles' },
]);

// UI bindings
playlist.on('trackChanged', ({ current }) => {
    document.querySelector('.now-playing').textContent = 
        `${current?.title} - ${current?.artist}`;
});

// Controls
document.querySelector('.btn-prev').onclick = () => playlist.prev();
document.querySelector('.btn-next').onclick = () => playlist.next();
document.querySelector('.btn-shuffle').onclick = () => playlist.toggleShuffle();
document.querySelector('.btn-repeat').onclick = () => playlist.toggleRepeat();

// Start playing
playlist.playTrack(0);
```

### Example 2: Podcast Player

```typescript
const player = new AudioInstance('podcast-player', {
    playlist: {
        autoAdvance: true,
        defaultRepeatMode: 'none' // Don't repeat podcasts
    }
});

const playlist = player.playlist!;

// Load episode queue
const episodes = await fetchPodcastEpisodes();
playlist.addMany(episodes.map(ep => ({
    id: ep.guid,
    src: ep.audioUrl,
    title: ep.title,
    duration: ep.duration,
    metadata: {
        description: ep.description,
        pubDate: ep.pubDate
    }
})));

// Resume from saved position
const savedPosition = localStorage.getItem('podcast-position');
if (savedPosition) {
    playlist.playTrack(parseInt(savedPosition));
}

// Save position on track change
playlist.on('trackChanged', ({ currentIndex }) => {
    localStorage.setItem('podcast-position', currentIndex.toString());
});
```

### Example 3: Dynamic Playlist

```typescript
const player = new AudioInstance('dynamic', {
    playlist: { autoAdvance: true }
});

const playlist = player.playlist!;

// Add initial tracks
playlist.addMany(initialTracks);

// Add recommended tracks when playlist is about to end
playlist.on('trackChanged', async ({ currentIndex }) => {
    const remaining = playlist.state.queue.length - currentIndex;
    
    if (remaining < 3) {
        const recommendations = await fetchRecommendations();
        playlist.addMany(recommendations);
        console.log('Added more tracks!');
    }
});

// Start playing
playlist.playTrack(0);
```

## 🛠️ Advanced Usage

### Seeded Shuffle

```typescript
// Custom shuffle with seed for reproducible order
class CustomPlaylist extends Playlist {
    private _seed: number = Date.now();
    
    setSeed(seed: number) {
        this._seed = seed;
        this.setShuffle(true); // Re-shuffle with new seed
    }
    
    private _shuffleArray(array: number[]): void {
        // Seeded Fisher-Yates shuffle
        let seed = this._seed;
        for (let i = array.length - 1; i > 0; i--) {
            seed = (seed * 9301 + 49297) % 233280;
            const j = Math.floor((seed / 233280) * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}
```

### Smart Shuffle (No Repeats)

```typescript
// Prevent recently played tracks from appearing too soon
class SmartPlaylist extends Playlist {
    private _history: string[] = [];
    private _historySize: number = 10;
    
    public next(): Track | null {
        const next = super.next();
        if (next) {
            this._history.push(next.id);
            if (this._history.length > this._historySize) {
                this._history.shift();
            }
        }
        return next;
    }
    
    private _shuffleArray(array: number[]): void {
        // Fisher-Yates with history awareness
        for (let i = array.length - 1; i > 0; i--) {
            let j;
            let attempts = 0;
            do {
                j = Math.floor(Math.random() * (i + 1));
                attempts++;
            } while (
                attempts < 10 && 
                this._history.includes(this._tracks[array[j]].id)
            );
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}
```

## 🎯 Best Practices

### 1. Always Check for Playlist Existence

```typescript
// Playlist is optional
if (player.playlist) {
    player.playlist.next();
} else {
    console.warn('Playlist not enabled');
}
```

### 2. Handle Empty Playlist

```typescript
const track = playlist.currentTrack;
if (!track) {
    console.log('No track selected');
    return;
}
```

### 3. Use Events for UI Updates

```typescript
// ✅ Good: Reactive
playlist.on('trackChanged', updateUI);

// ❌ Bad: Polling
setInterval(() => updateUI(playlist.currentTrack), 100);
```

### 4. Clean Up Event Listeners

```typescript
const handler = ({ current }) => console.log(current?.title);
playlist.on('trackChanged', handler);

// Later...
playlist.off('trackChanged', handler);
```

## 🐛 Troubleshooting

### Q: Tracks not auto-advancing?
**A:** Check `autoAdvance` config:
```typescript
playlist.setAutoAdvance(true);
```

### Q: Shuffle not working?
**A:** Ensure shuffle is enabled:
```typescript
playlist.setShuffle(true);
console.log(playlist.state.shuffleEnabled); // should be true
```

### Q: Playlist not syncing between tabs?
**A:** Check `syncPlaylist` config:
```typescript
const player = new AudioInstance('channel', {
    playlist: {
        syncPlaylist: true  // Must be true
    }
});
```

### Q: Current track resets after shuffle?
**A:** This is expected. Shuffle maintains the current track but changes queue order.

## 📝 TypeScript Tips

```typescript
// Use strict types
import type { Track, PlaylistState, RepeatMode } from '@borobysh/audio-sync-core';

// Type-safe track creation
const createTrack = (data: Omit<Track, 'id'>): Track => ({
    id: crypto.randomUUID(),
    ...data
});

// Type-safe event handlers
playlist.on('trackChanged', (payload) => {
    // payload is fully typed!
    const { current, previous, currentIndex } = payload;
});
```

## 🔮 Future Features

- [ ] Playlist persistence (save/load)
- [ ] Crossfade between tracks
- [ ] Gapless playback
- [ ] Queue priority system
- [ ] Smart playlists (filters, sorting)
- [ ] Collaborative playlists

---

**Next:** [Media Session API Integration](./MEDIA_SESSION.md)
