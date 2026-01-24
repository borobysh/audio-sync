# Audio Sync Core Documentation

Complete documentation for the Audio Sync Core library.

## 📚 Table of Contents

### Getting Started
- **[Quick Start Guide](./getting-started.md)** - Get up and running in minutes
- **[Installation & Setup](./getting-started.md#installation)** - Installation instructions
- **[Basic Usage](./getting-started.md#quick-start)** - Simple examples to get started

### API Reference
- **[AudioInstance API](./api/AudioInstance.md)** - Main player class reference
- **[Playlist API](./api/Playlist.md)** - Playlist management reference
- **[Configuration](./api/configuration.md)** - All configuration options
- **[Events](./api/events.md)** - Complete event reference

### Guides
- **[Configuration Validation](./guides/config-validation.md)** - Avoid conflicting settings with validated configs ✨
- **[Synchronization](./guides/synchronization.md)** - How multi-tab sync works
- **[Playlist Management](./guides/playlist-management.md)** - Working with playlists (syncPlaylist explained!)
- **[Testing Configurations](./guides/testing-configs.md)** - How to test different sync modes 🧪
- **[Framework Integration](./guides/frameworks.md)** - React, Vue, Angular, Svelte examples
- **[Event Handling](./guides/event-handling.md)** - Handling events effectively
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions 🔧

### Advanced
- **[Architecture](./advanced/architecture.md)** - Internal architecture overview
- **[Leadership Protocol](./advanced/leadership.md)** - How leadership handshake works
- **[Latency Compensation](./advanced/latency.md)** - Sync timing details

## 🚀 Quick Links

### Common Tasks

**Playing Audio**
```typescript
import { AudioInstance } from '@borobysh/audio-sync-core';

const player = new AudioInstance('my-app');
player.play('https://example.com/audio.mp3');
```

**With Playlist**
```typescript
const player = new AudioInstance('my-app', {
  playlist: { autoAdvance: true }
});

player.playlist?.addMany([
  { id: '1', src: 'song1.mp3', title: 'Song 1' },
  { id: '2', src: 'song2.mp3', title: 'Song 2' }
]);

player.playlist?.playTrack(0);
```

**Listening to Events**
```typescript
player.on('play', ({ src }) => console.log('Playing:', src));
player.on('timeUpdate', ({ currentTime }) => updateUI(currentTime));
player.on('leaderChange', ({ isLeader }) => showBadge(isLeader));
```

## 📖 Documentation Structure

```
docs/
├── README.md (you are here)
├── getting-started.md          # Quick start guide
├── api/                        # API references
│   ├── AudioInstance.md        # Main class
│   ├── Playlist.md             # Playlist API
│   ├── configuration.md        # Config options
│   └── events.md               # Event system
├── guides/                     # How-to guides
│   ├── synchronization.md      # Sync guide
│   ├── playlist-management.md  # Playlist guide
│   ├── frameworks.md           # Framework examples
│   ├── event-handling.md       # Events guide
│   └── error-handling.md       # Error guide
└── advanced/                   # Advanced topics
    ├── architecture.md         # Architecture
    ├── leadership.md           # Leadership protocol
    └── latency.md              # Latency compensation
```

## 🎯 Use Case Documentation

### Music Streaming App
See: [Getting Started](./getting-started.md) → [Playlist Management](./guides/playlist-management.md)

### Podcast Player
See: [Configuration](./api/configuration.md) → Preset: Podcast Player

### Radio Streaming
See: [Synchronization Guide](./guides/synchronization.md) → Single Playback Mode

### Multi-tab Application
See: [Synchronization Guide](./guides/synchronization.md) → Multi-Tab Playback Mode

## 💡 Examples by Framework

- **[React](./guides/frameworks.md#react)** - Hooks and components
- **[Vue 3](./guides/frameworks.md#vue-3)** - Composables
- **[Svelte](./guides/frameworks.md#svelte)** - Stores
- **[Angular](./guides/frameworks.md#angular)** - Services
- **[Solid.js](./guides/frameworks.md#solidjs)** - Signals
- **[Vanilla JS](./guides/frameworks.md#vanilla-javascript)** - Pure JavaScript

## 🔧 Configuration Presets

Use validated presets to avoid conflicting settings:

```typescript
import { AudioInstance, SyncPresets } from '@borobysh/audio-sync-core';

// Independent tabs (no sync)
const player1 = new AudioInstance('app', SyncPresets.INDEPENDENT);

// Synchronized tabs (all play same content)
const player2 = new AudioInstance('app', SyncPresets.SYNCHRONIZED);

// Remote control (one plays, others control)
const player3 = new AudioInstance('app', SyncPresets.REMOTE_CONTROL);
```

**Validate custom configs:**

```typescript
import { validateSyncConfig } from '@borobysh/audio-sync-core';

const { valid, warnings } = validateSyncConfig({
  singlePlayback: true,
  syncPlay: false  // ⚠️ Potential conflict!
});
```

See [Configuration Validation Guide](./guides/config-validation.md) for details.

## 🎓 Learning Path

### Beginner
1. [Quick Start](./getting-started.md#quick-start)
2. [Basic Usage](./getting-started.md#control-playback)
3. [Events](./getting-started.md#listen-to-events)

### Intermediate
1. [Playlist API](./api/Playlist.md)
2. [Configuration Options](./api/configuration.md)
3. [Framework Integration](./guides/frameworks.md)

### Advanced
1. [Synchronization Deep Dive](./guides/synchronization.md)
2. [Architecture](./advanced/architecture.md)
3. [Custom Extensions](./advanced/architecture.md#extension-points)

## 🔍 Searchable Index

### Classes
- [AudioInstance](./api/AudioInstance.md) - Main player class
- [PlaylistManager](./api/Playlist.md#playlistmanager) - Playlist integration
- [Playlist](./api/Playlist.md) - Pure playlist logic

### Methods
- [play()](./api/AudioInstance.md#play) - Start playback
- [pause()](./api/AudioInstance.md#pause) - Pause playback
- [seek()](./api/AudioInstance.md#seek) - Seek to time
- [next()](./api/Playlist.md#next) - Play next track
- [prev()](./api/Playlist.md#prev) - Play previous track

### Events
- [play](./api/events.md#play) - Playback started
- [pause](./api/events.md#pause) - Playback paused
- [timeUpdate](./api/events.md#timeupdate) - Time updated
- [leaderChange](./api/events.md#leaderchange) - Leadership changed
- [trackChanged](./api/events.md#playlisttrackchanged) - Track changed

### Configuration
- [singlePlayback](./api/configuration.md#singleplayback) - Single vs multi-tab playback
- [syncInterval](./api/configuration.md#syncinterval) - Sync frequency
- [autoAdvance](./api/configuration.md#autoadvance) - Auto-play next track
- [syncPlaylist](./api/configuration.md#syncplaylist) - Sync playlist across tabs

## 🤝 Contributing

Found an issue or want to improve the documentation?

- [Report issues](https://github.com/yourusername/audio-sync/issues)
- [Submit pull requests](https://github.com/yourusername/audio-sync/pulls)
- [View examples](../../examples/)

## 📄 License

MIT © [Your Name]

---

<div align="center">
  <strong>Need help?</strong> Check the <a href="./getting-started.md">Getting Started</a> guide or browse the <a href="./api/AudioInstance.md">API Reference</a>.
</div>
