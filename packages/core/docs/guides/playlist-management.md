# Playlist Management Guide

Complete guide to managing playlists with Audio Sync Core.

## Overview

Audio Sync Core provides powerful playlist capabilities with shuffle, repeat modes, and optional synchronization across tabs.

## Basic Playlist Setup

```typescript
import { AudioInstance, Track } from '@borobysh/audio-sync-core';

const player = new AudioInstance('my-app', {
  playlist: {
    autoAdvance: true,         // Auto-play next track
    defaultRepeatMode: 'all',  // Repeat all tracks
    syncPlaylist: false        // Each tab has independent playlist
  }
});

// Add tracks
const tracks: Track[] = [
  { id: '1', src: 'song1.mp3', title: 'Song 1', artist: 'Artist A' },
  { id: '2', src: 'song2.mp3', title: 'Song 2', artist: 'Artist B' },
  { id: '3', src: 'song3.mp3', title: 'Song 3', artist: 'Artist C' }
];

player.playlist?.addMany(tracks);
player.playlist?.playTrack(0);
```

## Understanding `syncPlaylist`

### `syncPlaylist: false` (Independent Playlists)

Each tab maintains its own playlist. Changes in one tab don't affect others.

**Use Cases:**
- Different users/sessions with different playlists
- Testing different playlists in different tabs
- User can have different playlist per tab

**Behavior:**

| Action on Tab 1 | Tab 2 Playlist | Tab 2 Playback |
|-----------------|----------------|----------------|
| Add track | ❌ Not added | No change |
| Remove track | ❌ Not removed | No change |
| Next track | ❌ Stays same | Synced if `syncPlay: true` |
| Shuffle ON | ❌ Stays OFF | No change |

```typescript
// Tab 1
const player1 = new AudioInstance('app', {
  playlist: { syncPlaylist: false }
});
player1.playlist?.addMany([track1, track2, track3]);
player1.playlist?.playTrack(0); // Plays track1

// Tab 2 (opened later)
// Has its own empty playlist
player2.playlist?.addMany([trackA, trackB]);
player2.playlist?.playTrack(0); // Plays trackA

// ✅ Each tab has its own playlist
// ✅ Playback can still be synchronized if syncPlay: true
```

### `syncPlaylist: true` (Synchronized Playlists)

All tabs share the same playlist. Any change propagates to all tabs.

**Use Cases:**
- Collaborative listening (multiple users controlling same playlist)
- Same user across multiple devices/tabs
- Consistent playlist across all tabs

**Behavior:**

| Action on Tab 1 | Tab 2 Playlist | Tab 2 Playback |
|-----------------|----------------|----------------|
| Add track | ✅ Also added | No change* |
| Remove track | ✅ Also removed | May skip if removed |
| Next track | ✅ Also advances | ✅ Plays same track |
| Shuffle ON | ✅ Also shuffles | Queue reordered |

*Playback changes only if `syncTrackChange: true`

```typescript
// Tab 1
const player1 = new AudioInstance('app', {
  playlist: { syncPlaylist: true }
});
player1.playlist?.addMany([track1, track2, track3]);
player1.playlist?.playTrack(0);

// Tab 2 (opened later)
// Automatically has same playlist: [track1, track2, track3]

// User adds track on Tab 1
player1.playlist?.add(track4);
// → Tab 2 playlist now has [track1, track2, track3, track4]

// User clicks next on Tab 1
player1.playlist?.next();
// → Tab 1 plays track2
// → Tab 2 playlist also advances to track2
// → Tab 2 plays track2 IF syncTrackChange: true
```

## Playlist Synchronization Events

When `syncPlaylist: true`, these actions broadcast:

### Track Management

```typescript
// Add track - broadcasts PLAYLIST_ADD
player.playlist?.add({
  id: '4',
  src: 'song4.mp3',
  title: 'New Song'
});
// → All tabs add this track

// Remove track - broadcasts PLAYLIST_REMOVE
player.playlist?.remove('4');
// → All tabs remove this track

// Clear playlist - broadcasts PLAYLIST_CLEAR
player.playlist?.clear();
// → All tabs clear their playlist
```

### Navigation

```typescript
// Play specific track - broadcasts PLAYLIST_JUMP
player.playlist?.playTrack(2);
// → All tabs update currentIndex to 2
// → All tabs play track 2 if syncTrackChange: true

// Next track - broadcasts PLAYLIST_NEXT
player.playlist?.next();
// → All tabs advance to next track

// Previous track - broadcasts PLAYLIST_PREV
player.playlist?.prev();
// → All tabs go to previous track
```

### Modes

```typescript
// Shuffle - broadcasts PLAYLIST_SHUFFLE
player.playlist?.setShuffle(true);
// → All tabs enable shuffle and regenerate queue

// Repeat - broadcasts PLAYLIST_REPEAT
player.playlist?.setRepeat('one');
// → All tabs set repeat mode to 'one'
```

## Combining Sync Settings

### Scenario 1: Independent Playlists, Synced Playback

```typescript
const player = new AudioInstance('app', {
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: false,  // ❌ Tracks don't sync
  playlist: {
    syncPlaylist: false    // ❌ Playlists don't sync
  }
});

// Result:
// - Each tab has its own playlist
// - But play/pause/seek are synchronized
// - Perfect for: Testing, different playlists per user
```

### Scenario 2: Synced Playlists, Independent Playback

```typescript
const player = new AudioInstance('app', {
  syncPlay: false,
  syncPause: false,
  syncSeek: false,
  syncTrackChange: false,
  playlist: {
    syncPlaylist: true     // ✅ Playlists sync
  }
});

// Result:
// - All tabs have same playlist
// - But each tab can play independently
// - Perfect for: Remote control scenario
```

### Scenario 3: Fully Synchronized

```typescript
const player = new AudioInstance('app', {
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: true,   // ✅ Tracks sync
  playlist: {
    syncPlaylist: true     // ✅ Playlists sync
  }
});

// Result:
// - Everything is synchronized
// - All tabs always in perfect sync
// - Perfect for: Collaborative listening, same user multi-tab
```

### Scenario 4: Remote Control (Like Spotify)

```typescript
// Leader tab (plays audio)
const leader = new AudioInstance('app', {
  singlePlayback: true,    // Only this tab plays
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: true,
  playlist: {
    syncPlaylist: true
  }
});

// Follower tab (controls only)
// Same configuration, but it won't become leader
// unless user interacts

// Result:
// - Leader plays audio
// - Follower can control playback
// - Follower sees same playlist
// - Like Spotify's "Connect" feature
```

## Playlist Events

Listen to playlist changes:

```typescript
// Track changed
player.playlist?.on('trackChanged', ({ current, previous }) => {
  console.log('Now playing:', current?.title);
});

// Queue updated (add/remove/move)
player.playlist?.on('queueUpdated', ({ tracks, queue }) => {
  console.log('Playlist updated, now has', tracks.length, 'tracks');
  updatePlaylistUI(queue);
});

// Shuffle changed
player.playlist?.on('shuffleChanged', ({ enabled }) => {
  console.log('Shuffle:', enabled ? 'ON' : 'OFF');
});

// Repeat mode changed
player.playlist?.on('repeatModeChanged', ({ mode }) => {
  console.log('Repeat:', mode);
});
```

## Duplicate Protection

Audio Sync Core automatically prevents duplicate tracks:

```typescript
const track = { id: '1', src: 'song.mp3', title: 'Song' };

player.playlist?.add(track);
player.playlist?.add(track); // ❌ Skipped (already exists)

// Even with syncPlaylist: true, duplicates are prevented
```

## Best Practices

### 1. Choose the Right Mode

- **Independent playlists** (`syncPlaylist: false`): When each user/session needs their own playlist
- **Synced playlists** (`syncPlaylist: true`): When all tabs should share the same playlist

### 2. Handle Sync Events

```typescript
if (playlist) {
  playlist.on('trackChanged', updateNowPlaying);
  playlist.on('queueUpdated', renderPlaylist);
  playlist.on('shuffleChanged', updateShuffleButton);
}
```

### 3. Provide Visual Feedback

```typescript
player.on('leaderChange', ({ isLeader }) => {
  if (isLeader) {
    showBadge('👑 Playing');
  } else {
    showBadge('👥 Following');
  }
});
```

### 4. Consider Performance

```typescript
// For large playlists, consider pagination
const chunkSize = 50;
for (let i = 0; i < tracks.length; i += chunkSize) {
  const chunk = tracks.slice(i, i + chunkSize);
  player.playlist?.addMany(chunk);
  await sleep(10); // Give UI time to update
}
```

## Troubleshooting

### Playlists Not Syncing

```typescript
// ❌ Problem: syncPlaylist is false
playlist: { syncPlaylist: false }

// ✅ Solution: Enable sync
playlist: { syncPlaylist: true }
```

### Duplicate Tracks

Duplicates are automatically prevented by ID. If you see duplicates:

```typescript
// ❌ Problem: Tracks have different IDs
{ id: '1', src: 'song.mp3' }
{ id: '2', src: 'song.mp3' } // Same song, different ID

// ✅ Solution: Use consistent IDs
{ id: 'song-unique-id', src: 'song.mp3' }
```

### Playlist Out of Sync

```typescript
// Clear and reload on all tabs
player.playlist?.clear();
player.playlist?.addMany(freshTracks);
```

## See Also

- [Playlist API Reference](../api/Playlist.md)
- [Configuration Guide](../api/configuration.md)
- [Synchronization Guide](./synchronization.md)
- [Event Handling Guide](./event-handling.md)
