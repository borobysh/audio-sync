# Getting Started with Audio Sync Core

This guide will help you get up and running with Audio Sync Core in minutes.

## Installation

Install the package using your preferred package manager:

```bash
# npm
npm install @borobysh/audio-sync-core

# yarn
yarn add @borobysh/audio-sync-core

# pnpm
pnpm add @borobysh/audio-sync-core
```

## Quick Start

### 1. Basic Audio Player

Create a simple synchronized audio player:

```typescript
import { AudioInstance } from '@borobysh/audio-sync-core';

// Create an instance with a unique channel name
const player = new AudioInstance('my-music-app');

// Play audio
player.play('https://example.com/song.mp3');

// Subscribe to state changes
player.subscribe((state) => {
  console.log('Player state:', state);
});
```

### 2. Control Playback

```typescript
// Play/pause
player.play();
player.pause();
player.stop();

// Seek to specific time (in seconds)
player.seek(60);

// Volume control (0.0 - 1.0)
player.setVolume(0.8);
player.mute();
player.unmute();
```

### 3. Listen to Events

```typescript
// Listen to specific events
player.on('play', ({ src }) => {
  console.log('Started playing:', src);
});

player.on('pause', () => {
  console.log('Playback paused');
});

player.on('timeUpdate', ({ currentTime, duration }) => {
  console.log(`Progress: ${currentTime}s / ${duration}s`);
});

player.on('ended', () => {
  console.log('Track ended');
});

player.on('leaderChange', ({ isLeader }) => {
  console.log('Leadership changed:', isLeader);
});
```

### 4. Access Player State

```typescript
const state = player.state;

console.log(state.isPlaying);     // boolean
console.log(state.currentTime);   // number (seconds)
console.log(state.duration);      // number (seconds)
console.log(state.volume);        // number (0.0 - 1.0)
console.log(state.muted);         // boolean
console.log(state.currentSrc);    // string | null
console.log(state.isLeader);      // boolean
```

## Configuration Options

Customize the behavior with configuration options:

```typescript
const player = new AudioInstance('my-channel', {
  // Sync options
  syncPlay: true,           // Sync play events (default: true)
  syncPause: true,          // Sync pause events (default: true)
  syncSeek: true,           // Sync seek operations (default: true)
  syncTrackChange: true,    // Sync track changes (default: true)
  singlePlayback: false,    // Only leader plays audio (default: true)
  syncInterval: 1000,       // Periodic sync in ms (default: 1000)
  
  // Leadership handshake
  leadershipHandshakeTimeout: 100  // Timeout in ms (default: 100)
});
```

## Understanding Synchronization Modes

### Single Playback Mode (`singlePlayback: true`)

Only the leader tab plays actual audio, followers track the state silently.

**Use when:**
- You want to prevent audio from multiple tabs playing simultaneously
- Saving bandwidth is important
- You have a traditional single-player experience

```typescript
const player = new AudioInstance('app', {
  singlePlayback: true
});
```

### Multi-Tab Playback Mode (`singlePlayback: false`)

All tabs play audio simultaneously, perfectly synchronized.

**Use when:**
- You want consistent audio across all tabs
- Users might use different tabs for different purposes
- You need redundancy in playback

```typescript
const player = new AudioInstance('app', {
  singlePlayback: false
});
```

## Working with Playlists

Enable playlist support in your configuration:

```typescript
import { AudioInstance, Track } from '@borobysh/audio-sync-core';

const player = new AudioInstance('music-app', {
  playlist: {
    autoAdvance: true,         // Auto-play next track
    defaultRepeatMode: 'all',  // Repeat all tracks
    syncPlaylist: false        // Don't sync playlist changes
  }
});

// Define tracks
const tracks: Track[] = [
  {
    id: '1',
    src: 'https://example.com/track1.mp3',
    title: 'Track One',
    artist: 'Artist Name',
    album: 'Album Name',
    duration: 180
  },
  {
    id: '2',
    src: 'https://example.com/track2.mp3',
    title: 'Track Two',
    artist: 'Artist Name'
  }
];

// Add tracks to playlist
player.playlist?.addMany(tracks);

// Control playlist
player.playlist?.next();
player.playlist?.prev();
player.playlist?.playTrack(0); // Play first track

// Playlist modes
player.playlist?.toggleShuffle();
player.playlist?.setRepeat('one'); // 'none', 'all', 'one'

// Listen to playlist events
player.playlist?.on('trackChanged', ({ current, previous }) => {
  console.log('Track changed from', previous?.title, 'to', current?.title);
});
```

## Cleanup

Don't forget to cleanup when done:

```typescript
// Destroy the instance when component unmounts
player.destroy();
```

## Next Steps

- [AudioInstance API Reference](./api/AudioInstance.md)
- [Playlist API Reference](./api/Playlist.md)
- [Configuration Options](./api/configuration.md)
- [Event Handling Guide](./guides/event-handling.md)
- [Synchronization Deep Dive](./guides/synchronization.md)

## Common Patterns

### React Hook

```typescript
import { useEffect, useState } from 'react';
import { AudioInstance } from '@borobysh/audio-sync-core';

function useAudioPlayer(channelName: string) {
  const [player] = useState(() => new AudioInstance(channelName));
  const [state, setState] = useState(player.state);

  useEffect(() => {
    const unsubscribe = player.subscribe(setState);
    return () => {
      unsubscribe();
      player.destroy();
    };
  }, [player]);

  return { player, state };
}
```

### Vue Composable

```typescript
import { ref, onUnmounted } from 'vue';
import { AudioInstance } from '@borobysh/audio-sync-core';

export function useAudioPlayer(channelName: string) {
  const player = new AudioInstance(channelName);
  const state = ref(player.state);

  player.subscribe((newState) => {
    state.value = newState;
  });

  onUnmounted(() => {
    player.destroy();
  });

  return { player, state };
}
```

### Svelte Store

```typescript
import { readable } from 'svelte/store';
import { AudioInstance } from '@borobysh/audio-sync-core';

export function createAudioStore(channelName: string) {
  const player = new AudioInstance(channelName);

  const state = readable(player.state, (set) => {
    const unsubscribe = player.subscribe(set);
    return () => {
      unsubscribe();
      player.destroy();
    };
  });

  return { player, state };
}
```
