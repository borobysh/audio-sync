# Testing Different Configurations

How to test and experiment with different sync configurations.

## Quick Testing in Examples

The vanilla example (`examples/vanilla/main.ts`) is set up for easy config testing:

```typescript
// Just change the preset!
const config = {
    ...SyncPresets.SYNCHRONIZED,  // ← Change this line
    playlist: { /* ... */ }
};
```

### Available Presets to Try

1. **`SyncPresets.INDEPENDENT`**
   ```typescript
   ...SyncPresets.INDEPENDENT
   ```
   - No synchronization
   - Each tab completely independent
   - Open 2 tabs → play different songs → no interference

2. **`SyncPresets.SYNCHRONIZED`**
   ```typescript
   ...SyncPresets.SYNCHRONIZED
   ```
   - Full synchronization
   - All tabs play same content
   - Open 2 tabs → play on one → both play in sync

3. **`SyncPresets.REMOTE_CONTROL`**
   ```typescript
   ...SyncPresets.REMOTE_CONTROL
   ```
   - One tab plays, others control
   - Like Spotify Connect
   - Open 2 tabs → play on one → only that tab has audio

4. **`SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS`**
   ```typescript
   ...SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS
   ```
   - Play/pause syncs
   - Each tab has different track
   - Open 2 tabs → play Song 1 on Tab 1, Song 2 on Tab 2 → both sync playback

## Testing Scenarios

### Scenario 1: Independent Tracks Test

**Config:**
```typescript
const config = {
    ...SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS,
    playlist: { syncPlaylist: false }
};
```

**Test Steps:**
1. Open Tab 1 → Play Song 1
2. Open Tab 2 → Play Song 3
3. Pause on Tab 1 → Both should pause
4. Resume on Tab 2 → Both should resume
5. Tab 1 should still be on Song 1, Tab 2 on Song 3 ✅

**Expected Result:**
- ✅ Each tab keeps its own track
- ✅ Play/pause syncs
- ✅ Seek is independent

### Scenario 2: Full Sync Test

**Config:**
```typescript
const config = {
    ...SyncPresets.SYNCHRONIZED,
    playlist: { syncPlaylist: true }
};
```

**Test Steps:**
1. Open Tab 1 → Play Song 1
2. Open Tab 2 → Should auto-play Song 1
3. Next on Tab 1 → Tab 2 should also advance
4. Seek to 30s on Tab 2 → Tab 1 should also seek
5. Add Song 6 on Tab 1 → Tab 2 should also get Song 6

**Expected Result:**
- ✅ All tabs play same track
- ✅ All actions sync
- ✅ Playlist changes sync

### Scenario 3: Remote Control Test

**Config:**
```typescript
const config = {
    ...SyncPresets.REMOTE_CONTROL,
    playlist: { syncPlaylist: true }
};
```

**Test Steps:**
1. Open Tab 1 → Play Song 1
2. Tab 1 becomes leader and plays audio 🔊
3. Open Tab 2 → No audio, just shows state 🔇
4. Next on Tab 2 → Tab 1 advances and plays Song 2
5. Tab 2 still has no audio, just controls

**Expected Result:**
- ✅ Only one tab plays audio (saves bandwidth)
- ✅ Other tabs can control it
- ✅ Like Spotify Connect

## Interactive Testing

### In Browser Console

```javascript
// Show current config behavior
console.log(describeSyncConfig(player.config));

// Test validation
const { warnings } = validateSyncConfig({
  syncPlay: false,
  singlePlayback: true
});
console.log('Warnings:', warnings);

// Check current state
console.log('State:', player.state);
console.log('Is Leader:', player.isLeader);
console.log('Current Track:', player.playlist?.currentTrack);
```

### Create Test Matrix

Test all combinations systematically:

```typescript
const testConfigs = [
  { name: 'Independent', config: SyncPresets.INDEPENDENT },
  { name: 'Synchronized', config: SyncPresets.SYNCHRONIZED },
  { name: 'Remote Control', config: SyncPresets.REMOTE_CONTROL },
  { name: 'Synced Playback Only', config: SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS }
];

testConfigs.forEach(({ name, config }) => {
  console.log(`\n=== ${name} ===`);
  console.log(describeSyncConfig(config));
  
  const { warnings } = validateSyncConfig(config);
  if (warnings.length > 0) {
    console.warn('Warnings:', warnings);
  }
});
```

## Debugging Sync Issues

### Add Debug Panel

```html
<div id="debug-panel" style="position: fixed; top: 10px; right: 10px; 
     background: rgba(0,0,0,0.8); color: white; padding: 10px; 
     border-radius: 8px; font-family: monospace; font-size: 11px;">
  <div id="debug-info"></div>
</div>
```

```typescript
function updateDebugPanel() {
  const info = document.getElementById('debug-info');
  const state = player.state;
  const playlistState = player.playlist?.state;
  
  info.innerHTML = `
    <strong>Instance: ${player.instanceId.slice(0, 6)}</strong><br>
    Role: ${state.isLeader ? '👑 Leader' : '👥 Follower'}<br>
    Playing: ${state.isPlaying ? '▶️' : '⏸️'}<br>
    Time: ${state.currentTime.toFixed(1)}s / ${state.duration.toFixed(1)}s<br>
    Track: ${state.currentSrc?.split('/').pop() || 'None'}<br>
    ${playlistState ? `
      Playlist: ${playlistState.currentIndex + 1} / ${playlistState.tracks.length}<br>
      Shuffle: ${playlistState.shuffleEnabled ? '🔀 ON' : 'OFF'}<br>
      Repeat: ${playlistState.repeatMode}
    ` : ''}
  `;
}

player.subscribe(updateDebugPanel);
setInterval(updateDebugPanel, 100);
```

### Log All Sync Events

```typescript
// Intercept BroadcastChannel messages
const originalPostMessage = BroadcastChannel.prototype.postMessage;
BroadcastChannel.prototype.postMessage = function(message) {
  console.log('[Broadcast →]', message.type, message.payload);
  return originalPostMessage.call(this, message);
};

// Log received messages
player.on('leaderChange', ({ isLeader }) => {
  console.log('[Leadership]', isLeader ? 'Became leader' : 'Lost leadership');
});

player.on('trackChange', ({ src, previousSrc }) => {
  console.log('[Track Change]', { from: previousSrc, to: src });
});
```

## Automated Testing

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { AudioInstance, SyncPresets } from '@borobysh/audio-sync-core';

describe('Sync Configuration', () => {
  it('should not sync tracks when syncTrackChange is false', () => {
    const config = {
      ...SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS
    };
    
    const player = new AudioInstance('test', config);
    
    expect(player.config.syncTrackChange).toBe(false);
    expect(player.config.syncPlay).toBe(true);
  });

  it('should validate conflicting configs', () => {
    const { valid, warnings } = validateSyncConfig({
      singlePlayback: true,
      syncPlay: false
    });
    
    expect(valid).toBe(false);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
```

## Common Test Patterns

### Pattern 1: Two-Tab Test

```typescript
// Tab 1
const player1 = new AudioInstance('test-channel', config);
player1.play('song1.mp3');

// Tab 2 (simulated)
const player2 = new AudioInstance('test-channel', config);

// Assert behavior based on config
if (config.syncTrackChange) {
  expect(player2.state.currentSrc).toBe('song1.mp3');
} else {
  expect(player2.state.currentSrc).toBe(null);
}
```

### Pattern 2: State Preservation Test

```typescript
const player = new AudioInstance('test', {
  syncTrackChange: false
});

player.play('song1.mp3');
player.seek(60);

// Simulate remote play event
// player should keep song1.mp3, not change to song2.mp3

expect(player.state.currentSrc).toBe('song1.mp3');
expect(player.state.currentTime).toBeCloseTo(60);
```

### Pattern 3: Playlist Sync Test

```typescript
const player1 = new AudioInstance('test', {
  playlist: { syncPlaylist: true }
});

const player2 = new AudioInstance('test', {
  playlist: { syncPlaylist: true }
});

player1.playlist?.add({ id: '1', src: 'song.mp3', title: 'Song' });

// Wait for sync
await sleep(100);

expect(player2.playlist?.state.tracks.length).toBe(1);
```

## See Also

- [Configuration Validation Guide](./config-validation.md)
- [Troubleshooting](../troubleshooting.md)
- [Synchronization Guide](./synchronization.md)
