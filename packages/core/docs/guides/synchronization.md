# Synchronization Guide

Understanding how Audio Sync Core synchronizes playback across multiple browser tabs.

## How Synchronization Works

Audio Sync Core uses the **BroadcastChannel API** to communicate between tabs. When any action occurs in one tab, it broadcasts an event to all other tabs sharing the same channel name.

```
Tab 1 (Leader)          BroadcastChannel          Tab 2 (Follower)
     |                         |                         |
     |------- PLAY event ----->|                         |
     |                         |--------->               |
     |                         |                    [Updates state]
     |                         |                         |
     |                         |                         |
     |<------ STATE_UPDATE ----|<--------                |
     |   [Periodic sync]       |                         |
```

## Leadership Model

### Leader Election

When multiple tabs are open, one tab becomes the **leader**:

- The leader is responsible for broadcasting state updates
- In `singlePlayback: true` mode, only the leader plays actual audio
- Leadership can transfer between tabs based on user actions

### How Leadership is Claimed

1. **User Action**: User clicks play in Tab A
2. **Claim Broadcast**: Tab A broadcasts a `LEADERSHIP_CLAIM`
3. **Current Leader Yields**: Other tabs (including current leader) acknowledge
4. **Timeout**: After `leadershipHandshakeTimeout` (default 100ms), Tab A becomes leader
5. **Execute Action**: Tab A executes the play action

```typescript
// Fast leadership handshake
const player = new AudioInstance('app', {
  leadershipHandshakeTimeout: 50 // 50ms timeout
});

// More conservative handshake
const player = new AudioInstance('app', {
  leadershipHandshakeTimeout: 200 // 200ms timeout
});
```

### Monitoring Leadership

```typescript
player.on('leaderChange', ({ isLeader }) => {
  if (isLeader) {
    console.log('This tab is now the leader');
    showLeaderBadge();
  } else {
    console.log('This tab is a follower');
    hideLeaderBadge();
  }
});
```

## Synchronization Modes

### Single Playback Mode (`singlePlayback: true`)

**Behavior:**
- Only the leader tab plays audio
- Follower tabs track state but don't play sound
- When leadership changes, audio seamlessly transfers

**Best for:**
- Preventing multiple audio streams
- Saving bandwidth
- Traditional single-player experience

```typescript
const player = new AudioInstance('app', {
  singlePlayback: true
});

// Tab 1 (leader): plays audio
// Tab 2 (follower): tracks state, no audio
// Tab 3 (follower): tracks state, no audio
```

**Visual Indicator:**

```typescript
player.on('leaderChange', ({ isLeader }) => {
  document.body.classList.toggle('is-leader', isLeader);
});
```

```css
body:not(.is-leader) .player {
  opacity: 0.7; /* Dim follower tabs */
}

body.is-leader .player::before {
  content: '👑 Playing';
}

body:not(.is-leader) .player::before {
  content: '👥 Following';
}
```

### Multi-Tab Playback Mode (`singlePlayback: false`)

**Behavior:**
- All tabs play audio simultaneously
- Audio is synchronized across tabs
- No concept of "silent" followers

**Best for:**
- Redundancy (if one tab closes, audio continues)
- Consistent experience across all tabs
- Testing synchronization accuracy

```typescript
const player = new AudioInstance('app', {
  singlePlayback: false
});

// All tabs: play synchronized audio
// All tabs: can control playback
```

## Sync Events

### Event Types

Different actions trigger different sync events:

| User Action | Broadcast Event | Effect on Other Tabs |
|-------------|----------------|----------------------|
| `play()` | `PLAY` | Start playback at synced time |
| `pause()` | `PAUSE` | Pause playback |
| `seek(time)` | `SEEK` | Seek to same time |
| `stop()` | `STOP` | Stop playback |
| Track change | `TRACK_CHANGE` | Load new track |

### State Updates

The leader periodically broadcasts `STATE_UPDATE` events:

```typescript
const player = new AudioInstance('app', {
  syncInterval: 1000 // Broadcast every 1 second
});
```

**State Update Contains:**
- Current time
- Playing/paused state
- Current track
- Duration

## Latency Compensation

Audio Sync Core automatically compensates for network and processing latency to keep tabs in sync.

### How It Works

1. **Timestamp**: Each event includes a timestamp
2. **Latency Calculation**: Receiving tab calculates delay
3. **Time Adjustment**: Playback position is adjusted forward based on latency

```typescript
// Example: Leader sends STATE_UPDATE at t=10.0s
// Follower receives it 50ms later
// Follower adjusts to t=10.05s (10.0 + 0.05)
```

### Latency Compensation in Action

```typescript
// In LatencyCompensator.ts
static calculateAdjustedTime(
  reportedTime: number,
  isPlaying: boolean,
  latency: number,
  fallback: number
): number {
  if (!isFinite(reportedTime) || reportedTime < 0) {
    return fallback;
  }
  
  // If playing, compensate for latency
  if (isPlaying) {
    return reportedTime + latency;
  }
  
  return reportedTime;
}
```

## Selective Synchronization

You can choose which aspects to synchronize:

### Sync Everything

```typescript
const player = new AudioInstance('app', {
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: true
});
```

### Sync Playback Only (No Seek)

Useful for live streams or radio where seeking doesn't make sense.

```typescript
const player = new AudioInstance('radio', {
  syncPlay: true,
  syncPause: true,
  syncSeek: false,      // Don't sync seek
  syncTrackChange: true
});
```

### Independent Playlists

Each tab has its own playlist, but playback state syncs.

```typescript
const player = new AudioInstance('app', {
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: false, // Don't sync track changes
  playlist: {
    syncPlaylist: false   // Each tab has independent playlist
  }
});
```

### No Sync (Independent Tabs)

```typescript
const player = new AudioInstance('app', {
  syncPlay: false,
  syncPause: false,
  syncSeek: false,
  syncTrackChange: false
});
// Each tab operates independently
```

## Common Patterns

### Aggressive Sync (Low Latency)

For applications where tight synchronization is critical:

```typescript
const player = new AudioInstance('app', {
  singlePlayback: false,    // All tabs play
  syncInterval: 200,        // Update 5 times per second
  leadershipHandshakeTimeout: 30
});
```

### Conservative Sync (Low Bandwidth)

For applications where bandwidth is limited:

```typescript
const player = new AudioInstance('app', {
  singlePlayback: true,     // Only leader plays
  syncInterval: 5000,       // Update every 5 seconds
  leadershipHandshakeTimeout: 200
});
```

### Hybrid Sync

Sync control but not content:

```typescript
const player = new AudioInstance('app', {
  syncPlay: true,
  syncPause: true,
  syncSeek: false,          // Each tab can seek independently
  syncTrackChange: false,   // Each tab can play different tracks
  singlePlayback: false
});
```

## Debugging Synchronization

### Log Sync Events

```typescript
const player = new AudioInstance('app');

// Log leadership changes
player.on('leaderChange', ({ isLeader }) => {
  console.log('[Sync]', isLeader ? 'Became leader' : 'Lost leadership');
});

// Log state changes
player.subscribe((state) => {
  console.log('[State]', {
    time: state.currentTime.toFixed(2),
    playing: state.isPlaying,
    leader: state.isLeader
  });
});

// Log all events
['play', 'pause', 'seek', 'trackChange'].forEach(event => {
  player.on(event, (data) => {
    console.log(`[Event] ${event}:`, data);
  });
});
```

### Visualize Sync State

```typescript
function createSyncDebugPanel(player: AudioInstance) {
  const panel = document.createElement('div');
  panel.className = 'sync-debug';
  
  player.subscribe((state) => {
    panel.innerHTML = `
      <div>Instance: ${player.instanceId.slice(0, 6)}</div>
      <div>Role: ${state.isLeader ? '👑 Leader' : '👥 Follower'}</div>
      <div>Time: ${state.currentTime.toFixed(2)}s</div>
      <div>Playing: ${state.isPlaying ? '▶️' : '⏸️'}</div>
      <div>Track: ${state.currentSrc?.split('/').pop() || 'None'}</div>
    `;
  });
  
  document.body.appendChild(panel);
}
```

## Troubleshooting

### Audio Out of Sync

**Symptom:** Tabs play at slightly different times

**Solutions:**
1. Reduce `syncInterval` for more frequent updates
2. Ensure `syncSeek: true` is enabled
3. Check network latency between updates

```typescript
const player = new AudioInstance('app', {
  syncInterval: 500,  // More frequent sync
  syncSeek: true
});
```

### Leadership Conflicts

**Symptom:** Multiple tabs think they're leader

**Solutions:**
1. Increase `leadershipHandshakeTimeout`
2. Ensure all tabs use the same channel name
3. Check for multiple `AudioInstance` creations

```typescript
const player = new AudioInstance('app', {
  leadershipHandshakeTimeout: 200  // Give more time
});
```

### Tabs Not Syncing

**Symptom:** Actions in one tab don't affect others

**Solutions:**
1. Verify all tabs use the same channel name
2. Check that sync options are enabled
3. Ensure BroadcastChannel API is supported

```typescript
// Check support
if (!('BroadcastChannel' in window)) {
  console.error('BroadcastChannel not supported');
}

// Verify configuration
const player = new AudioInstance('same-channel-name', {
  syncPlay: true,
  syncPause: true
});
```

## See Also

- [Configuration Guide](../api/configuration.md)
- [AudioInstance API](../api/AudioInstance.md)
- [Architecture Overview](../advanced/architecture.md)
- [Leadership Handshake Details](../advanced/leadership.md)
