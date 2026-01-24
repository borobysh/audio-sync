# Troubleshooting Guide

Common issues and their solutions.

## State Loss Issues

### Problem: Tab Loses Track After Leadership Change

**Symptom:**
- Tab 1 plays Song 3 at 3:47
- Switch to Tab 2, play Song 5
- Return to Tab 1, click Play
- Song 1 starts from 0:00 instead of Song 3 at 3:47

**Root Cause:**

With default config (`syncTrackChange: true`):
1. Tab 1 plays Song 3 @ 3:47
2. Tab 2 becomes leader and plays Song 5
3. Tab 2 broadcasts PLAY with Song 5
4. Tab 1 **syncs the track** and changes to Song 5 @ 0:00
5. Tab 1 loses memory of Song 3

**Solution:**

Use `syncTrackChange: false` to keep each tab's track independent:

```typescript
import { SyncPresets } from '@borobysh/audio-sync-core';

// Option 1: Use preset
const player = new AudioInstance('app', 
  SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS
);

// Option 2: Custom config
const player = new AudioInstance('app', {
  syncPlay: true,
  syncPause: true,
  syncSeek: false,
  syncTrackChange: false,  // ✅ Each tab keeps its own track
  singlePlayback: false
});
```

**Result:**
- Tab 1 plays Song 3, Tab 2 plays Song 5
- Play/pause are synced
- But each tab maintains its own track and position

## Sync Issues

### Problem: Seek Syncs Even When `syncSeek: false`

**Symptom:**
- Set `syncSeek: false`
- Seek on Tab 1
- Tab 2 also seeks

**Root Cause:**

Old implementation had `default: return true` in `_isSyncAllowed()`, causing all unlisted events to sync.

**Fixed in v0.1.0+**

Update to latest version:
```bash
npm update @borobysh/audio-sync-core
```

### Problem: Tracks Sync Even When `syncTrackChange: false`

**Symptom:**
- Set `syncTrackChange: false`
- Change track on Tab 1
- Tab 2 also changes track

**Root Cause:**

The PLAY handler wasn't checking `syncTrackChange` flag in multi-tab mode.

**Fixed in v0.1.0+**

The handler now properly checks the flag:
```typescript
if (isSourceChanging && !this._config.syncTrackChange) {
  // Don't sync track, just sync play state
}
```

## Playlist Issues

### Problem: Duplicate Tracks Across Tabs

**Symptom:**
- Open Tab 1: 5 tracks
- Open Tab 2: 10 tracks (duplicated)
- Open Tab 3: 15 tracks (tripled)

**Root Cause:**

With `syncPlaylist: true`, each new tab broadcasts its initial tracks, causing duplication.

**Fixed in v0.1.0+**

Playlist now has duplicate protection by track ID:
```typescript
public add(track: Track): void {
  // Check for duplicates by ID
  if (this._tracks.some(t => t.id === track.id)) {
    return; // Skip duplicate
  }
  // ...
}
```

**Alternative Solution:**

Use `syncPlaylist: false` if each tab should have independent playlist:

```typescript
const player = new AudioInstance('app', {
  playlist: {
    syncPlaylist: false  // ✅ No duplication
  }
});
```

### Problem: Playlist Not Syncing

**Symptom:**
- Add track on Tab 1
- Tab 2 doesn't get the track

**Solution:**

Enable playlist sync:
```typescript
const player = new AudioInstance('app', {
  playlist: {
    syncPlaylist: true  // ✅ Sync playlist changes
  }
});
```

## Configuration Conflicts

### Problem: Configuration Seems Contradictory

**Symptom:**
- Settings don't behave as expected
- Confusing sync behavior

**Solution:**

Use configuration validation:

```typescript
import { validateSyncConfig, describeSyncConfig } from '@borobysh/audio-sync-core';

const config = {
  syncPlay: false,
  singlePlayback: true
};

// Validate
const { valid, warnings } = validateSyncConfig(config);

if (!valid) {
  console.warn('Configuration issues:');
  warnings.forEach(w => console.warn(w));
}

// Get description
console.log(describeSyncConfig(config));
```

### Common Conflicts

#### Conflict 1: Single Playback Without Play Sync

```typescript
// ❌ Problematic
{
  singlePlayback: true,
  syncPlay: false  // How will followers know state?
}

// ✅ Better
{
  singlePlayback: true,
  syncPlay: true
}
```

#### Conflict 2: Track Sync Without Play Sync

```typescript
// ❌ Confusing
{
  syncTrackChange: true,
  syncPlay: false  // Tracks change but don't play?
}

// ✅ Better
{
  syncTrackChange: true,
  syncPlay: true
}
```

#### Conflict 3: Multi-Tab Without Sync

```typescript
// ❌ Wasteful
{
  singlePlayback: false,  // All tabs play audio
  syncPlay: false,        // But nothing syncs?
  syncTrackChange: false
}

// ✅ Better (if you want no sync)
{
  singlePlayback: false,
  ...SyncPresets.INDEPENDENT  // Make it explicit
}
```

## Leadership Issues

### Problem: Multiple Tabs Think They're Leader

**Symptom:**
- Multiple tabs show "Leader" badge
- Actions conflict

**Solution:**

Increase handshake timeout:
```typescript
const player = new AudioInstance('app', {
  leadershipHandshakeTimeout: 200  // Give more time
});
```

### Problem: Leadership Switches Too Often

**Symptom:**
- Leader badge keeps switching
- Playback is unstable

**Solution:**

In `singlePlayback: true` mode, leadership changes on every action. This is expected. To reduce switching:

```typescript
// Use longer handshake timeout
const player = new AudioInstance('app', {
  singlePlayback: true,
  leadershipHandshakeTimeout: 300
});
```

Or use multi-tab mode:
```typescript
// No leadership needed, all tabs play
const player = new AudioInstance('app', {
  singlePlayback: false
});
```

## Performance Issues

### Problem: High CPU Usage

**Solution:**

Reduce sync frequency:
```typescript
const player = new AudioInstance('app', {
  syncInterval: 2000  // Sync every 2s instead of 1s
});
```

### Problem: Network Traffic

**Solution:**

Use single playback mode:
```typescript
const player = new AudioInstance('app', {
  singlePlayback: true  // Only leader loads audio
});
```

## Debug Tools

### Enable Debug Logging

Debug logging is enabled by default. Look for console messages:

```
[Sync:7ew5] 🚀 Instance created
[PlaybackSync:7ew5] ▶️ Remote started new track: song.mp3
[Playlist] ➕ Added 5 tracks at position 0
[PlaylistManager] ✅ PlaylistManager created
```

### Inspect Configuration

```typescript
// Show what your config does
import { describeSyncConfig } from '@borobysh/audio-sync-core';

console.log(describeSyncConfig({
  syncPlay: true,
  syncTrackChange: false,
  singlePlayback: false
}));

// Output:
// 🔊 All tabs play audio simultaneously
// 🎵 Each tab plays independent tracks
// ⏯️ Play/pause syncs
// ⏩ Each tab can seek independently
```

### Monitor Events

```typescript
// Log all events for debugging
['play', 'pause', 'seek', 'trackChange', 'leaderChange'].forEach(event => {
  player.on(event, (data) => {
    console.log(`[Event] ${event}:`, data);
  });
});
```

## Getting Help

If you're still experiencing issues:

1. **Check Configuration**: Use `validateSyncConfig()` and `describeSyncConfig()`
2. **Review Logs**: Check console for debug messages
3. **Try Preset**: Test with a standard preset first
4. **File Issue**: [GitHub Issues](https://github.com/yourusername/audio-sync/issues)

## See Also

- [Configuration Validation](./guides/config-validation.md)
- [Synchronization Guide](./guides/synchronization.md)
- [Configuration Reference](./api/configuration.md)
