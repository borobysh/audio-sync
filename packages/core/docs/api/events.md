# Events API Reference

Complete reference for all events in Audio Sync Core.

## Event System

Audio Sync Core uses a type-safe event system based on the `EventEmitter` class.

### Subscribing to Events

```typescript
// Method 1: subscribe() - listen to all state changes
const unsubscribe = player.subscribe((state) => {
  console.log('State changed:', state);
});

// Method 2: on() - listen to specific events
const unsubscribe = player.on('play', ({ src }) => {
  console.log('Started playing:', src);
});

// Unsubscribe when done
unsubscribe();
```

## AudioInstance Events

### `stateChange`

Fired whenever any part of the state changes.

**Data Type:** `SyncCoreState`

```typescript
player.on('stateChange', (state) => {
  console.log('State:', state);
});
```

### `play`

Fired when playback starts.

**Data Type:** `{ src: string | null }`

```typescript
player.on('play', ({ src }) => {
  console.log('Playing:', src);
  updatePlayButton('pause');
});
```

### `pause`

Fired when playback is paused.

**Data Type:** `void`

```typescript
player.on('pause', () => {
  console.log('Paused');
  updatePlayButton('play');
});
```

### `stop`

Fired when playback is stopped.

**Data Type:** `void`

```typescript
player.on('stop', () => {
  console.log('Stopped');
  resetUI();
});
```

### `ended`

Fired when the current track ends naturally.

**Data Type:** `void`

```typescript
player.on('ended', () => {
  console.log('Track ended');
  showNextTrackButton();
});
```

### `timeUpdate`

Fired periodically during playback (typically every 200-250ms).

**Data Type:** `{ currentTime: number; duration: number }`

```typescript
player.on('timeUpdate', ({ currentTime, duration }) => {
  const progress = (currentTime / duration) * 100;
  updateProgressBar(progress);
  updateTimeDisplay(currentTime, duration);
});
```

### `seek`

Fired when seeking to a new time position.

**Data Type:** `{ time: number }`

```typescript
player.on('seek', ({ time }) => {
  console.log('Seeked to:', time);
  flashProgressBar();
});
```

### `trackChange`

Fired when the audio source changes.

**Data Type:** `{ src: string | null; previousSrc: string | null }`

```typescript
player.on('trackChange', ({ src, previousSrc }) => {
  console.log('Track changed from', previousSrc, 'to', src);
  updateNowPlaying(src);
  resetProgress();
});
```

### `volumeChange`

Fired when volume or mute state changes.

**Data Type:** `{ volume: number; muted: boolean }`

```typescript
player.on('volumeChange', ({ volume, muted }) => {
  console.log('Volume:', volume, 'Muted:', muted);
  updateVolumeSlider(volume);
  updateMuteButton(muted);
});
```

### `leaderChange`

Fired when leadership changes (this tab becomes leader or loses leadership).

**Data Type:** `{ isLeader: boolean }`

```typescript
player.on('leaderChange', ({ isLeader }) => {
  if (isLeader) {
    console.log('👑 This tab is now the leader');
    showLeaderBadge();
  } else {
    console.log('👥 This tab is following');
    hideLeaderBadge();
  }
});
```

### `error`

Fired when an error occurs.

**Data Type:** `{ message: string; code: string | null }`

```typescript
player.on('error', ({ message, code }) => {
  console.error('Player error:', message, code);
  showErrorNotification(message);
});
```

## Playlist Events

Playlist events are available when playlist is enabled.

### `playlistTrackChanged`

Fired when the current playlist track changes.

**Data Type:** `{ current: Track | null; previous: Track | null; currentIndex: number }`

```typescript
player.on('playlistTrackChanged', ({ current, previous, currentIndex }) => {
  console.log('Track changed in playlist');
  console.log('Now playing:', current?.title);
  console.log('Track index:', currentIndex);
  updateNowPlaying(current);
  highlightTrackInList(currentIndex);
});
```

### `playlistQueueUpdated`

Fired when the playlist queue changes (tracks added/removed/reordered).

**Data Type:** `{ tracks: Track[]; queue: Track[] }`

```typescript
player.on('playlistQueueUpdated', ({ tracks, queue }) => {
  console.log('Playlist updated');
  console.log('Total tracks:', tracks.length);
  renderPlaylist(queue);
});
```

### `playlistEnded`

Fired when the playlist reaches the end (with repeat mode 'none').

**Data Type:** `undefined`

```typescript
player.on('playlistEnded', () => {
  console.log('Playlist finished');
  showReplayButton();
});
```

### `playlistRepeatModeChanged`

Fired when the repeat mode changes.

**Data Type:** `{ mode: RepeatMode }`

```typescript
player.on('playlistRepeatModeChanged', ({ mode }) => {
  console.log('Repeat mode:', mode);
  updateRepeatButton(mode);
});
```

### `playlistShuffleChanged`

Fired when shuffle is enabled or disabled.

**Data Type:** `{ enabled: boolean }`

```typescript
player.on('playlistShuffleChanged', ({ enabled }) => {
  console.log('Shuffle:', enabled ? 'ON' : 'OFF');
  updateShuffleButton(enabled);
});
```

## Event Patterns

### UI Updates

```typescript
// Update play/pause button
player.on('play', () => updateButton('pause'));
player.on('pause', () => updateButton('play'));

// Update progress bar
player.on('timeUpdate', ({ currentTime, duration }) => {
  progressBar.value = (currentTime / duration) * 100;
  timeDisplay.textContent = formatTime(currentTime, duration);
});

// Update track info
player.on('trackChange', ({ src }) => {
  trackTitle.textContent = getTrackTitle(src);
});
```

### Analytics

```typescript
// Track playback events
player.on('play', ({ src }) => {
  analytics.track('audio_play', { source: src });
});

player.on('ended', () => {
  analytics.track('audio_completed');
});

// Track errors
player.on('error', ({ message, code }) => {
  analytics.track('audio_error', { message, code });
});
```

### State Persistence

```typescript
// Save state to localStorage
player.on('timeUpdate', ({ currentTime }) => {
  if (currentTime % 5 === 0) { // Every 5 seconds
    localStorage.setItem('lastPosition', String(currentTime));
  }
});

player.on('trackChange', ({ src }) => {
  localStorage.setItem('lastTrack', src || '');
});

// Restore on load
const lastTrack = localStorage.getItem('lastTrack');
const lastPosition = parseFloat(localStorage.getItem('lastPosition') || '0');

if (lastTrack) {
  player.play(lastTrack);
  player.seek(lastPosition);
}
```

### Keyboard Shortcuts

```typescript
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (player.state.isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }
  
  if (e.code === 'ArrowLeft') {
    player.seek(Math.max(0, player.state.currentTime - 10));
  }
  
  if (e.code === 'ArrowRight') {
    player.seek(Math.min(player.state.duration, player.state.currentTime + 10));
  }
});
```

### Notifications

```typescript
// Show notification when track changes
player.on('trackChange', ({ src }) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Now Playing', {
      body: getTrackTitle(src),
      icon: '/icon.png'
    });
  }
});
```

### Auto-Save Progress

```typescript
let saveTimeout: ReturnType<typeof setTimeout>;

player.on('timeUpdate', ({ currentTime }) => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveProgressToServer(player.state.currentSrc, currentTime);
  }, 2000); // Save after 2s of no updates
});
```

## Multiple Event Listeners

You can attach multiple listeners to the same event:

```typescript
// Listener 1: Update UI
player.on('play', () => {
  updateButton('pause');
});

// Listener 2: Analytics
player.on('play', ({ src }) => {
  analytics.track('play', { src });
});

// Listener 3: Log
player.on('play', ({ src }) => {
  console.log('Playing:', src);
});
```

## Unsubscribing

### Individual Event

```typescript
const handlePlay = ({ src }) => console.log('Playing:', src);

// Subscribe
player.on('play', handlePlay);

// Unsubscribe
player.off('play', handlePlay);
```

### Using Return Function

```typescript
// Subscribe and get unsubscribe function
const unsubscribe = player.on('play', () => {
  console.log('Playing');
});

// Later, unsubscribe
unsubscribe();
```

### All Events (Destroy)

```typescript
// Clean up all listeners
player.destroy();
```

## Event Timing

### Synchronous vs Asynchronous

Events are fired **synchronously** when possible:

```typescript
player.play();
// 'play' event fires immediately
console.log('This runs after event handlers');
```

Some events (like `timeUpdate`) fire based on browser timing:

```typescript
player.on('timeUpdate', () => {
  // Fires ~4 times per second during playback
});
```

### Event Order

When multiple state changes occur:

```
1. State updates in Engine
2. Engine fires specific events (play, pause, etc.)
3. Engine fires stateChange event
4. AudioInstance forwards events
5. User callbacks execute
```

## Best Practices

### Do: Use Specific Events

```typescript
// ✅ Good: Listen to specific events
player.on('play', () => updateUI());
player.on('pause', () => updateUI());
```

### Don't: Overuse subscribe()

```typescript
// ❌ Avoid: subscribe() fires on every state change
player.subscribe((state) => {
  // This fires very frequently
  updateEntireUI(state);
});
```

### Do: Unsubscribe When Done

```typescript
// ✅ Good: Clean up listeners
useEffect(() => {
  const unsubscribe = player.on('play', handlePlay);
  return () => unsubscribe();
}, []);
```

### Do: Handle Errors

```typescript
// ✅ Good: Always handle errors
player.on('error', ({ message }) => {
  console.error('Player error:', message);
  showErrorToUser(message);
});
```

## See Also

- [AudioInstance API](./AudioInstance.md)
- [Playlist API](./Playlist.md)
- [Event Handling Guide](../guides/event-handling.md)
