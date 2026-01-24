# Media Session API Integration

This guide explains how to use the Media Session API integration in `audio-sync` to provide native OS-level media controls.

## Table of Contents

- [What is Media Session?](#what-is-media-session)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Advanced Usage](#advanced-usage)
- [Custom Implementation](#custom-implementation)
- [Cross-Tab Synchronization](#cross-tab-synchronization)
- [Browser Support](#browser-support)
- [Troubleshooting](#troubleshooting)

---

## What is Media Session?

Media Session API provides integration with OS-level media controls:

- **Lock screen controls** (iOS, Android)
- **System notifications** (Windows, macOS, Linux)
- **Hardware buttons** (headphones, keyboard media keys)
- **Picture-in-Picture controls**

### User Benefits

✅ Control playback without opening the browser tab  
✅ See track info on lock screen  
✅ Use hardware buttons (headphones, keyboard)  
✅ Native experience like Spotify/Apple Music

---

## Quick Start

### Basic Usage (Automatic)

Media Session is **enabled by default** when you create an `AudioInstance`:

```typescript
import { AudioInstance } from '@borobysh/audio-sync';

const player = new AudioInstance('my-channel', {
    playlist: {
        autoAdvance: true
    }
});

// Add tracks with metadata
player.playlist?.addMany([
    {
        id: '1',
        src: 'https://example.com/track1.mp3',
        title: 'Song Title',
        artist: 'Artist Name',
        album: 'Album Name',
        coverArt: 'https://example.com/cover.jpg'
    }
]);

// Media Session automatically shows track info and controls!
player.play();
```

That's it! Media Session will automatically:
- Show track metadata on lock screen
- Register play/pause/next/prev handlers
- Update position state
- Handle hardware button presses

---

## Configuration

### Default Configuration

```typescript
const player = new AudioInstance('my-channel', {
    mediaSession: {
        enabled: true,           // Enable Media Session
        seekStep: 10,            // Seek forward/backward step (seconds)
        updateInterval: 1000,    // Position update interval (ms)
    }
});
```

### Custom Actions

You can specify which actions to enable:

```typescript
const player = new AudioInstance('my-channel', {
    mediaSession: {
        enabled: true,
        seekStep: 15,  // 15 seconds for seek
        actions: [
            'play',
            'pause',
            'nexttrack',
            'previoustrack',
            'seekforward',
            'seekbackward'
        ]
    }
});
```

### Default Artwork

Provide a fallback artwork for tracks without cover art:

```typescript
const player = new AudioInstance('my-channel', {
    mediaSession: {
        enabled: true,
        artwork: {
            defaultUrl: 'https://example.com/default-cover.jpg',
            sizes: [96, 128, 192, 256, 384, 512]  // Multiple sizes for different displays
        }
    }
});
```

### Disable Media Session

```typescript
const player = new AudioInstance('my-channel', {
    mediaSession: {
        enabled: false  // Disable Media Session
    }
});
```

---

## Advanced Usage

### Manual Metadata Updates

Access the Media Session manager directly:

```typescript
import { MediaMetadata } from '@borobysh/audio-sync';

const player = new AudioInstance('my-channel');

// Manually update metadata
const metadata: MediaMetadata = {
    title: 'Custom Title',
    artist: 'Custom Artist',
    album: 'Custom Album',
    artwork: [
        { src: 'cover-96.jpg', sizes: '96x96', type: 'image/jpeg' },
        { src: 'cover-512.jpg', sizes: '512x512', type: 'image/jpeg' }
    ]
};

player.mediaSession?.onTrackChange(metadata);
```

### Custom Action Handlers

Override default action handlers:

```typescript
const player = new AudioInstance('my-channel', {
    mediaSession: { enabled: false }  // Disable auto-setup
});

// Get the Media Session instance
const mediaSession = player.mediaSession?.getMediaSession();

// Set custom handler
mediaSession?.setActionHandler('play', () => {
    console.log('Custom play handler');
    player.play();
});

mediaSession?.setActionHandler('seekbackward', (details) => {
    const offset = details?.seekOffset || 30;  // Custom 30s seek
    player.seek(Math.max(0, player.state.currentTime - offset));
});

// Activate manually
mediaSession?.activate();
```

### Position State Updates

Update position state manually:

```typescript
const player = new AudioInstance('my-channel');

// Update position every second
setInterval(() => {
    if (player.state.isPlaying) {
        player.mediaSession?.updatePositionState(
            player.state.currentTime,
            player.state.duration,
            1.0  // playback rate
        );
    }
}, 1000);
```

---

## Custom Implementation

You can create your own Media Session implementation by extending `AbstractMediaSession`:

```typescript
import { AbstractMediaSession, MediaSessionConfig, MediaSessionCallbacks } from '@borobysh/audio-sync';

class CustomMediaSession extends AbstractMediaSession {
    constructor(config: MediaSessionConfig, callbacks: MediaSessionCallbacks) {
        super(config, callbacks);
    }

    isSupported(): boolean {
        // Check if your custom implementation is supported
        return true;
    }

    activate(): void {
        // Activate your custom Media Session
        console.log('Activating custom Media Session');
        this.isActive = true;
    }

    deactivate(): void {
        // Deactivate your custom Media Session
        console.log('Deactivating custom Media Session');
        this.isActive = false;
    }

    updateMetadata(metadata: MediaMetadata): void {
        // Update metadata in your custom implementation
        console.log('Updating metadata:', metadata);
    }

    setPlaybackState(state: MediaSessionPlaybackState): void {
        // Update playback state
        console.log('Playback state:', state);
    }

    setPositionState(state: MediaPositionState): void {
        // Update position state
        console.log('Position:', state);
    }

    setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
        // Register action handler
        console.log('Action handler:', action);
    }

    clear(): void {
        // Clear metadata
        console.log('Clearing metadata');
    }

    destroy(): void {
        // Cleanup
        console.log('Destroying Media Session');
    }
}

// Use custom implementation
const player = new AudioInstance('my-channel', {
    mediaSessionImpl: new CustomMediaSession(
        { enabled: true, seekStep: 10, updateInterval: 1000 },
        {
            onPlay: () => player.play(),
            onPause: () => player.pause()
        }
    )
});
```

---

## Cross-Tab Synchronization

### How It Works

Only the **leader tab** controls Media Session to avoid conflicts:

```
Tab 1 (Leader)  ─┐
                 ├─► Media Session API ─► OS Controls
Tab 2 (Follower)─┘   (only leader)
Tab 3 (Follower)─┘
```

### Leadership Change

When leadership changes, Media Session automatically transfers:

```typescript
const player = new AudioInstance('my-channel', {
    singlePlayback: true  // Enable leader-follower mode
});

player.on('leaderChange', ({ isLeader }) => {
    console.log(isLeader ? 'I control Media Session' : 'Another tab controls it');
});
```

### Remote Control Mode

In remote control mode, followers can send commands without becoming leaders:

```typescript
const player = new AudioInstance('my-channel', {
    singlePlayback: true,
    allowRemoteControl: true  // Followers can control without leadership
});

// Follower tab can control playback
player.play();  // Sends command to leader
player.pause(); // Sends command to leader

// Leader tab controls Media Session
```

---

## Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome  | 73+     | ✅ Full |
| Edge    | 79+     | ✅ Full |
| Firefox | 82+     | ✅ Full |
| Safari  | 15+     | ✅ Full |
| Opera   | 60+     | ✅ Full |

### Graceful Degradation

The library automatically detects support and gracefully degrades:

```typescript
const player = new AudioInstance('my-channel');

if (player.mediaSession?.isSupported()) {
    console.log('✅ Media Session supported');
} else {
    console.log('⚠️ Media Session not supported - playback still works');
}
```

---

## Troubleshooting

### Media Session Not Showing

**Problem:** Lock screen doesn't show controls

**Solutions:**
1. Check browser support: `player.mediaSession?.isSupported()`
2. Ensure metadata is provided (title, artist)
3. Check if tab is the leader: `player.isLeader`
4. Try playing audio first (some browsers require user interaction)

### Hardware Buttons Not Working

**Problem:** Headphone buttons don't work

**Solutions:**
1. Ensure Media Session is active: `player.mediaSession?.isActive()`
2. Check if actions are registered properly
3. Verify browser permissions (some browsers require HTTPS)
4. Test with native media (to rule out hardware issues)

### Multiple Tabs Conflict

**Problem:** Multiple tabs fighting for Media Session

**Solutions:**
1. Enable `singlePlayback: true` in config
2. Only one tab should be the leader
3. Check leadership status: `player.isLeader`

### Metadata Not Updating

**Problem:** Track info doesn't update on track change

**Solutions:**
1. Ensure playlist has metadata (title, artist, coverArt)
2. Check if Media Session is active
3. Verify leadership (only leader updates Media Session)
4. Manually trigger update: `player.mediaSession?.onTrackChange(metadata)`

### Position State Issues

**Problem:** Seek bar not working in notifications

**Solutions:**
1. Ensure duration is set correctly
2. Check if position updates are enabled
3. Verify values are valid (no NaN, Infinity)
4. Some browsers have limited support for position state

---

## Examples

### Complete Example with Playlist

```typescript
import { AudioInstance } from '@borobysh/audio-sync';

const player = new AudioInstance('podcast-player', {
    singlePlayback: true,
    playlist: {
        autoAdvance: true
    },
    mediaSession: {
        enabled: true,
        seekStep: 15,  // 15s for podcasts
        artwork: {
            defaultUrl: '/default-podcast-cover.jpg'
        }
    }
});

// Add podcast episodes
player.playlist?.addMany([
    {
        id: 'ep1',
        src: 'https://example.com/episode1.mp3',
        title: 'Episode 1: Introduction',
        artist: 'My Podcast',
        album: 'Season 1',
        coverArt: 'https://example.com/season1-cover.jpg',
        duration: 3600  // 1 hour
    },
    {
        id: 'ep2',
        src: 'https://example.com/episode2.mp3',
        title: 'Episode 2: Deep Dive',
        artist: 'My Podcast',
        album: 'Season 1',
        coverArt: 'https://example.com/season1-cover.jpg',
        duration: 4200  // 70 minutes
    }
]);

// Start playback
player.playlist?.play(0);

// Lock screen now shows:
// - Episode title
// - Podcast name
// - Cover art
// - Play/Pause, Previous, Next, Seek buttons
```

### Music Streaming Service

```typescript
const player = new AudioInstance('music-app', {
    singlePlayback: true,
    allowRemoteControl: true,  // Remote control like Spotify Connect
    playlist: { autoAdvance: true },
    mediaSession: {
        enabled: true,
        seekStep: 10,
        actions: ['play', 'pause', 'previoustrack', 'nexttrack', 'seekforward', 'seekbackward']
    }
});

// Add songs
player.playlist?.addMany(songs);

// Play
player.playlist?.play(0);

// Now works like Spotify:
// - Lock screen controls
// - Hardware buttons
// - System notifications
// - Multiple tabs can control playback
```

---

## API Reference

### MediaSessionConfig

```typescript
interface MediaSessionConfig {
    enabled: boolean;              // Enable/disable Media Session
    seekStep: number;              // Seek step in seconds (default: 10)
    updateInterval: number;        // Position update interval in ms (default: 1000)
    actions?: MediaSessionAction[]; // Actions to enable
    artwork?: {
        defaultUrl?: string;       // Default artwork URL
        sizes?: number[];          // Artwork sizes (default: [96, 128, 192, 256, 384, 512])
    };
}
```

### MediaMetadata

```typescript
interface MediaMetadata {
    title?: string;
    artist?: string;
    album?: string;
    artwork?: MediaImage[];
}

interface MediaImage {
    src: string;
    sizes?: string;  // e.g., '512x512'
    type?: string;   // e.g., 'image/jpeg'
}
```

### MediaSessionManager

```typescript
class MediaSessionManager {
    onLeadershipChange(isLeader: boolean): void;
    onStateUpdate(state: Partial<SyncCoreState>): void;
    onTrackChange(metadata: MediaMetadata): void;
    onPlaybackStateChange(isPlaying: boolean): void;
    updatePositionState(currentTime: number, duration: number, playbackRate?: number): void;
    isSupported(): boolean;
    isActive(): boolean;
    getMediaSession(): AbstractMediaSession;
    destroy(): void;
}
```

---

## Next Steps

- [Playlist Management](./playlist-management.md)
- [Synchronization Guide](./synchronization.md)
- [Custom Driver](./custom-driver.md)
- [API Reference](../api/AudioInstance.md)
