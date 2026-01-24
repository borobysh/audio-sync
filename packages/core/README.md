# 🎵 Audio Sync Core

<div align="center">

**Multi-tab synchronized audio player library for web browsers**

[![npm version](https://img.shields.io/npm/v/@borobysh/audio-sync-core.svg)](https://www.npmjs.com/package/@borobysh/audio-sync-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

## 📖 Overview

Audio Sync Core is a powerful, lightweight library that enables synchronized audio playback across multiple browser tabs. Perfect for creating consistent audio experiences in web applications where users might have multiple tabs open.

### ✨ Key Features

- 🔄 **Multi-tab Synchronization** - Seamlessly sync playback across all open tabs
- 🎵 **Playlist Management** - Built-in playlist support with shuffle and repeat modes
- 🎯 **Leadership Handshake** - Smart leadership election for conflict-free playback control
- ⚡ **Low Latency** - Intelligent latency compensation for smooth synchronization
- 🎛️ **Full Control** - Play, pause, seek, volume, and more
- 📦 **TypeScript** - Full TypeScript support with comprehensive type definitions
- 🪶 **Zero Dependencies** - Lightweight with no external runtime dependencies

## 🚀 Quick Start

### Installation

```bash
npm install @borobysh/audio-sync-core
```

### Basic Usage

```typescript
import { AudioInstance, SyncPresets } from '@borobysh/audio-sync-core';

// Create an audio instance with a preset
const player = new AudioInstance('my-app-channel', SyncPresets.SYNCHRONIZED);

// Or customize:
const player = new AudioInstance('my-app-channel', {
  syncPlay: true,
  syncPause: true,
  syncSeek: true,
  syncTrackChange: true,
  singlePlayback: false  // All tabs play synchronized audio
});

// Play audio
player.play('https://example.com/audio.mp3');

// Control playback
player.pause();
player.seek(30); // Seek to 30 seconds
player.setVolume(0.8);

// Listen to events
player.on('play', ({ src }) => {
  console.log('Playing:', src);
});

player.on('timeUpdate', ({ currentTime, duration }) => {
  console.log(`${currentTime}s / ${duration}s`);
});
```

### With Playlist

```typescript
import { AudioInstance, Track } from '@borobysh/audio-sync-core';

const player = new AudioInstance('my-app-channel', {
  playlist: {
    autoAdvance: true,
    defaultRepeatMode: 'all',
    syncPlaylist: false
  }
});

const tracks: Track[] = [
  { 
    id: '1', 
    src: 'https://example.com/track1.mp3', 
    title: 'Song One', 
    artist: 'Artist Name' 
  },
  { 
    id: '2', 
    src: 'https://example.com/track2.mp3', 
    title: 'Song Two', 
    artist: 'Artist Name' 
  }
];

// Add tracks to playlist
player.playlist?.addMany(tracks);

// Navigate playlist
player.playlist?.next();
player.playlist?.prev();
player.playlist?.toggleShuffle();
player.playlist?.setRepeat('one');

// Listen to playlist events
player.playlist?.on('trackChanged', ({ current }) => {
  console.log('Now playing:', current?.title);
});
```

## 📚 Documentation

Comprehensive documentation is available in the [docs](./docs) directory:

### Getting Started
- [Installation & Setup](./docs/getting-started.md)
- [Quick Start Guide](./docs/getting-started.md#quick-start)

### API Reference
- [AudioInstance API](./docs/api/AudioInstance.md) - Main player class
- [Playlist API](./docs/api/Playlist.md) - Playlist management
- [Configuration Options](./docs/api/configuration.md) - All available config options
- [Events](./docs/api/events.md) - Event system reference

### Guides
- [Synchronization Modes](./docs/guides/synchronization.md) - How sync works
- [Playlist Management](./docs/guides/playlist-management.md) - Working with playlists
- [Event Handling](./docs/guides/event-handling.md) - Handling events
- [Error Handling](./docs/guides/error-handling.md) - Dealing with errors

### Advanced
- [Architecture Overview](./docs/advanced/architecture.md) - Internal architecture
- [Leadership Handshake](./docs/advanced/leadership.md) - How leadership works
- [Latency Compensation](./docs/advanced/latency.md) - Sync timing details

## 🎯 Use Cases

- **Music Streaming Apps** - Keep playback in sync when users switch tabs
- **Podcast Players** - Maintain listening position across tabs
- **Audio Learning Platforms** - Synchronized audio for educational content
- **Radio Streaming** - Consistent playback experience
- **Multi-tab Applications** - Any app where audio should stay consistent

## 🔧 Configuration

### Using Presets (Recommended)

```typescript
import { SyncPresets } from '@borobysh/audio-sync-core';

// Independent tabs (no sync)
const player = new AudioInstance('app', SyncPresets.INDEPENDENT);

// Synchronized tabs (all play same content)
const player = new AudioInstance('app', SyncPresets.SYNCHRONIZED);

// Remote control (one plays, others control)
const player = new AudioInstance('app', SyncPresets.REMOTE_CONTROL);
```

### Custom Configuration

```typescript
import { validateSyncConfig } from '@borobysh/audio-sync-core';

const config = {
  // Synchronization options
  syncPlay: true,           // Sync play events
  syncPause: true,          // Sync pause events
  syncSeek: true,           // Sync seek operations
  syncTrackChange: true,    // Sync track changes
  singlePlayback: false,    // false: all tabs play audio, true: only leader plays
  syncInterval: 1000,       // Periodic sync interval (ms)
  
  // Playlist options (optional)
  playlist: {
    autoAdvance: true,           // Auto-play next track
    defaultRepeatMode: 'none',   // 'none', 'all', or 'one'
    defaultShuffle: false,       // Start with shuffle enabled
    syncPlaylist: false          // Sync playlist changes across tabs
  }
};

// Validate before using
const { warnings } = validateSyncConfig(config);
warnings.forEach(w => console.warn(w));

const player = new AudioInstance('app', config);
```

## 🌐 Browser Support

- Chrome/Edge 54+
- Firefox 38+
- Safari 10.1+
- Opera 41+

*Requires BroadcastChannel API support*

## 📦 What's Included

```
@borobysh/audio-sync-core/
├── AudioInstance      # Main player class
├── Playlist           # Standalone playlist class
├── PlaylistManager    # Playlist integration with AudioInstance
└── Types             # TypeScript type definitions
```

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## 📄 License

MIT © [Your Name]

## 🔗 Links

- [GitHub Repository](https://github.com/yourusername/audio-sync)
- [Issue Tracker](https://github.com/yourusername/audio-sync/issues)
- [Examples](../../examples/)
- [Changelog](./CHANGELOG.md)

---

<div align="center">
Made with ❤️ for better web audio experiences
</div>
