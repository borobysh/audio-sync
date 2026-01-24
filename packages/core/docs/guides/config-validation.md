# Configuration Validation Guide

Learn how to use validated sync configurations and presets to avoid conflicting settings.

## The Problem

Some combinations of sync flags can be confusing or contradictory:

```typescript
// ❌ Conflicting: Only leader plays, but play events don't sync
{
  singlePlayback: true,
  syncPlay: false  // How will followers know to stop?
}

// ❌ Confusing: Tracks sync, but play state doesn't
{
  syncTrackChange: true,
  syncPlay: false  // Tracks change but playback doesn't?
}

// ❌ Wasteful: All tabs play but nothing syncs
{
  singlePlayback: false,
  syncPlay: false,
  syncPause: false,
  syncSeek: false,
  syncTrackChange: false  // Why use multi-tab then?
}
```

## The Solution: Validated Configs & Presets

### Using Presets

The easiest way to avoid conflicts is to use presets:

```typescript
import { AudioInstance, SyncPresets } from '@borobysh/audio-sync-core';

// 1️⃣ Independent Tabs (each tab plays its own content)
const player1 = new AudioInstance('app', SyncPresets.INDEPENDENT);

// 2️⃣ Synchronized Tabs (all tabs play same content in sync)
const player2 = new AudioInstance('app', SyncPresets.SYNCHRONIZED);

// 3️⃣ Remote Control (one tab plays, others control)
const player3 = new AudioInstance('app', SyncPresets.REMOTE_CONTROL);

// 4️⃣ Synced playback, independent tracks
const player4 = new AudioInstance('app', 
  SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS
);
```

### Available Presets

#### `SyncPresets.INDEPENDENT`

Each tab is completely independent. No synchronization.

```typescript
{
  syncPlay: false,
  syncPause: false,
  syncSeek: false,
  syncTrackChange: false,
  singlePlayback: false,
  syncInterval: 0
}
```

**Use cases:**
- Different users/sessions
- Testing different configurations
- Completely isolated tabs

#### `SyncPresets.SYNCHRONIZED`

All tabs play the same content in perfect sync.

```typescript
{
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: true,
  singlePlayback: false,  // All tabs play audio
  syncInterval: 1000
}
```

**Use cases:**
- Same user, multiple tabs
- Redundant playback (if one tab closes, others continue)
- Consistent experience across tabs

#### `SyncPresets.REMOTE_CONTROL`

Like Spotify Connect - one tab plays, others can control it.

```typescript
{
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: true,
  singlePlayback: true,  // Only leader plays
  syncInterval: 1000
}
```

**Use cases:**
- Desktop plays, phone/tablet controls
- Power saving (only one tab plays audio)
- Traditional "single player" experience

#### `SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS`

Play/pause syncs, but each tab plays its own track.

```typescript
{
  syncPlay: true,
  syncPause: true,
  syncSeek: false,
  syncTrackChange: false,
  singlePlayback: false,
  syncInterval: 0
}
```

**Use cases:**
- Multi-track recording/playback
- Synchronized but different content per tab

## Validating Custom Configs

If you need a custom configuration, validate it first:

```typescript
import { validateSyncConfig } from '@borobysh/audio-sync-core';

const config = {
  syncPlay: false,
  singlePlayback: true,
  syncTrackChange: true
};

const { valid, warnings } = validateSyncConfig(config);

if (!valid) {
  console.warn('Configuration has potential issues:');
  warnings.forEach(warning => console.warn(warning));
}

// Still create player (validation is advisory)
const player = new AudioInstance('app', config);
```

### Example Validation Output

```typescript
const config = {
  singlePlayback: true,
  syncPlay: false
};

const { warnings } = validateSyncConfig(config);
// warnings: [
//   "⚠️ singlePlayback: true + syncPlay: false - " +
//   "Only leader plays, but play events are not synced. This may cause confusion."
// ]
```

## Describing Configs

Get a human-readable description of what a config does:

```typescript
import { describeSyncConfig, SyncPresets } from '@borobysh/audio-sync-core';

const description = describeSyncConfig(SyncPresets.SYNCHRONIZED);
console.log(description);

// Output:
// 🔊 All tabs play audio simultaneously
// 🎵 Tracks sync across tabs
// ⏯️ Play/pause syncs
// ⏩ Seek/time syncs
```

## TypeScript Type Safety

Use validated types for compile-time safety:

```typescript
import { 
  IndependentTabsConfig,
  SynchronizedTabsConfig,
  RemoteControlConfig 
} from '@borobysh/audio-sync-core';

// ✅ Type-safe independent config
const independentConfig: IndependentTabsConfig = {
  syncPlay: false,
  syncPause: false,
  syncSeek: false,
  syncTrackChange: false,
  singlePlayback: false
};

// ❌ TypeScript error: syncPlay should be false
const badConfig: IndependentTabsConfig = {
  syncPlay: true,  // Error!
  syncTrackChange: false,
  singlePlayback: false
};
```

## Common Config Scenarios

### Scenario 1: Music Player (Single User)

User opens multiple tabs of your music player:

```typescript
// They want consistent experience
const player = new AudioInstance('music-app', SyncPresets.SYNCHRONIZED);
```

### Scenario 2: Podcast Player

User listens to podcasts, might have multiple tabs:

```typescript
// Only one tab plays (save bandwidth), others can control
const player = new AudioInstance('podcast-app', SyncPresets.REMOTE_CONTROL);
```

### Scenario 3: Radio Stream

User streams radio, might open multiple tabs:

```typescript
// All tabs play (redundancy), but only basic sync
const player = new AudioInstance('radio-app', {
  ...SyncPresets.SYNCHRONIZED,
  syncSeek: false  // Can't seek live radio anyway
});
```

### Scenario 4: Audio Editor

Multi-track audio editor:

```typescript
// Each tab is independent track
const player = new AudioInstance('editor-app', SyncPresets.INDEPENDENT);
```

### Scenario 5: Collaborative Playlist

Multiple users control same playlist:

```typescript
// Synchronized playback + synced playlist
const player = new AudioInstance('collab-app', {
  ...SyncPresets.SYNCHRONIZED,
  playlist: {
    syncPlaylist: true  // Playlist also syncs
  }
});
```

## Best Practices

### 1. Start with a Preset

```typescript
// ✅ Good: Start with preset, customize if needed
const config = {
  ...SyncPresets.SYNCHRONIZED,
  syncSeek: false  // Custom: disable seek sync
};
```

### 2. Validate Custom Configs

```typescript
// ✅ Good: Validate before using
const { warnings } = validateSyncConfig(customConfig);
if (warnings.length > 0) {
  // Show to user or log
}
```

### 3. Document Your Choice

```typescript
// ✅ Good: Explain why you chose this config
const player = new AudioInstance('app', {
  // Using REMOTE_CONTROL because we want power saving
  // and users typically only listen on one device
  ...SyncPresets.REMOTE_CONTROL
});
```

### 4. Test Different Configs

```typescript
// ✅ Good: Let users choose
const configMode = userPreference;
const config = {
  'sync': SyncPresets.SYNCHRONIZED,
  'control': SyncPresets.REMOTE_CONTROL,
  'independent': SyncPresets.INDEPENDENT
}[configMode];

const player = new AudioInstance('app', config);
```

## Troubleshooting

### Issue: Tabs not syncing

```typescript
// Check your config
const { warnings } = validateSyncConfig(player.config);
console.log(warnings);

// Verify sync flags are enabled
console.log(describeSyncConfig(player.config));
```

### Issue: Multiple tabs playing (echo)

```typescript
// You probably want singlePlayback: true
const player = new AudioInstance('app', SyncPresets.REMOTE_CONTROL);
```

### Issue: Tab lost state after leadership change

```typescript
// You have syncTrackChange: true
// Each tab syncs to leader's track
// Solution: Use syncTrackChange: false for independent tracks
const player = new AudioInstance('app', {
  syncPlay: true,
  syncPause: true,
  syncTrackChange: false,  // Each tab keeps its own track
  singlePlayback: false
});
```

## See Also

- [Configuration Guide](../api/configuration.md)
- [Synchronization Guide](./synchronization.md)
- [Getting Started](../getting-started.md)
