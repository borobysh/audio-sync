# Architecture Overview

Deep dive into the internal architecture of Audio Sync Core.

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      AudioInstance                           │
│  (Orchestrator - Routes events to appropriate handlers)      │
└────┬──────────────┬──────────────┬──────────────┬────────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌──────────┐   ┌──────────────┐
│ Engine  │   │ Driver  │   │SyncCoord │   │PlaylistMgr   │
│         │   │         │   │          │   │              │
│  Core   │   │Playback │   │Broadcast │   │   Playlist   │
│  State  │   │ Control │   │ Channel  │   │  Management  │
└─────────┘   └─────────┘   └──────────┘   └──────────────┘
     │             │              │                 │
     │             │              │                 │
     │             ▼              ▼                 ▼
     │        ┌──────────┐  ┌─────────────────┐  ┌──────────┐
     │        │HTMLAudio │  │PlaybackSyncHndlr│  │ Playlist │
     │        │Element   │  │                 │  │          │
     └───────▶│          │  │Playback Sync    │  │Core Logic│
              └──────────┘  │Logic            │  └──────────┘
                            └─────────────────┘

Separation of Concerns:
━━━━━━━━━━━━━━━━━━━━━━
• AudioInstance    → Orchestration
• PlaybackSyncHandler → Playback sync logic
• PlaylistManager  → Playlist sync logic
• SyncCoordinator  → Communication infrastructure
• Driver           → Audio playback
• Engine           → State management
```

## Core Components

### 1. AudioInstance

**Role:** Main entry point and orchestrator

**Responsibilities:**
- Public API for users
- Coordinates all internal components
- Event aggregation and forwarding
- Lifecycle management
- Routes events to appropriate handlers

**Key Features:**
- Extends `EventEmitter` for event handling
- Manages configuration
- Delegates playback to `Driver`
- Delegates sync to `SyncCoordinator` and `PlaybackSyncHandler`
- Delegates playlist to `PlaylistManager` if enabled
- **Single Responsibility:** Orchestration only, no sync logic

```typescript
export class AudioInstance extends EventEmitter<AudioInstanceEventData> {
  private readonly _engine: Engine;
  private readonly _driver: Driver;
  private readonly _coordinator: SyncCoordinator;
  private readonly _playbackSyncHandler: PlaybackSyncHandler;
  private readonly _playlistManager: PlaylistManager | null;
  
  // Public API methods
  play(src?: string): void
  pause(): void
  seek(time: number): void
  // ... more methods
}
```

### 2. Engine

**Role:** Core state manager

**Responsibilities:**
- Maintains authoritative state
- Fires state change events
- No side effects (pure state)

**State Schema:**

```typescript
interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  currentSrc: string | null;
  error: AudioError | null;
}
```

**Key Methods:**
- `setSyncState()`: Update state from sync
- `setState()`: Update state from local actions
- Event emission for state changes

### 3. Driver

**Role:** Audio playback controller

**Responsibilities:**
- Manages HTML Audio element
- Executes playback commands
- Buffers state updates
- Reports actual playback state to Engine

**Key Features:**
- Silent mode for followers
- Buffered state updates
- `seekWhenReady()` for pending seeks
- Auto-recovery from errors

```typescript
export class Driver {
  private readonly _audio: HTMLAudioElement;
  private readonly _engine: Engine;
  
  play(src?: string): void
  pause(): void
  pauseSilently(): void  // For followers
  seek(time: number): void
  // ... more methods
}
```

### 4. SyncCoordinator

**Role:** Multi-tab synchronization infrastructure

**Responsibilities:**
- BroadcastChannel management
- Leadership handshake protocol
- Message broadcasting
- Event routing between tabs

**Leadership Protocol:**

```
Tab A                    Tab B (current leader)
  |                              |
  |-- LEADERSHIP_CLAIM --------->|
  |                              |
  |<------- ACK -----------------|
  |       (yields leadership)    |
  |                              |
  |-- [timeout: 100ms] ----------|
  |                              |
  |== Becomes Leader =====       |
```

**Key Features:**
- Non-blocking leadership claims
- Queued actions during handshake
- Automatic timeout for deadlock prevention
- **Single Responsibility:** Communication only, no sync logic

### 4.5. PlaybackSyncHandler

**Role:** Playback synchronization logic

**Responsibilities:**
- Determine if sync events should be processed
- Handle remote playback events (PLAY, PAUSE, STATE_UPDATE)
- Sync time/seek operations with latency compensation
- Coordinate with Driver and Engine

**Key Features:**
- Separate from AudioInstance for cleaner code
- Works with both single and multi-tab playback modes
- Latency compensation for smooth sync
- **Single Responsibility:** Playback sync logic only

```typescript
export class PlaybackSyncHandler {
  isSyncAllowed(type: AudioEvent['type']): boolean
  handleRemoteEvent(type, payload, timestamp): void
  
  private _handlePlay(payload, latency): void
  private _handlePause(): void
  private _handleStateUpdate(payload, timestamp, latency): void
  private _syncTime(payload, sentAt): void
}
```

### 5. PlaylistManager

**Role:** Playlist integration with sync

**Responsibilities:**
- Integrates `Playlist` with `AudioInstance`
- Auto-advance between tracks
- Playlist sync across tabs
- Track callbacks to player

**Key Features:**
- Wraps pure `Playlist` logic
- Broadcasts playlist actions
- Handles remote playlist updates
- `_isProcessingRemote` flag prevents echo

### 6. Playlist

**Role:** Pure playlist logic

**Responsibilities:**
- Track list management
- Shuffle algorithm
- Repeat modes
- Queue generation

**Key Features:**
- Immutable state exposure
- Duplicate protection
- Index tracking
- Event-driven updates

## Data Flow

### User Action → Playback

```
User clicks Play
      ↓
AudioInstance.play()
      ↓
singlePlayback? ────yes───→ SyncCoordinator.claimLeadership()
      │                            ↓
      no                    Leadership handshake
      │                            ↓
      ↓                     Become leader + execute
Driver.play()
      ↓
HTMLAudioElement.play()
      ↓
'playing' event
      ↓
Driver updates Engine
      ↓
Engine fires 'play' event
      ↓
AudioInstance emits to user
```

### Remote Event → State Update

```
Remote Tab broadcasts PLAY
      ↓
SyncCoordinator receives
      ↓
AudioInstance._handleRemoteEvent()
      ↓
singlePlayback? ────yes───→ Engine.setSyncState()
      │                     (track state, no audio)
      no
      ↓
Driver.play()
(play synchronized audio)
      ↓
Engine updated
      ↓
User callbacks triggered
```

### Periodic Sync

```
setInterval (syncInterval: 1000ms)
      ↓
Is leader? ────no────→ [skip]
      │
     yes
      ↓
Broadcast STATE_UPDATE
      ↓
      │
All follower tabs
      ↓
Receive STATE_UPDATE
      ↓
LatencyCompensator.calculateAdjustedTime()
      ↓
Update local state with compensation
```

## Event System

### EventEmitter

Generic event emitter with type safety:

```typescript
export class EventEmitter<TEventPayloads> {
  private _eventSubscribers = new Map<
    keyof TEventPayloads, 
    Set<Function>
  >();
  
  on<T extends keyof TEventPayloads>(
    event: T,
    callback: (data: TEventPayloads[T]) => void
  ): () => void
  
  protected _emitEvent<T extends keyof TEventPayloads>(
    event: T,
    data: TEventPayloads[T]
  ): void
}
```

### Event Flow

```
HTMLAudioElement
      ↓ (native events)
    Driver
      ↓ (updates)
    Engine
      ↓ (state events)
AudioInstance
      ↓ (typed events)
 User Callbacks
```

## Synchronization Protocol

### Message Format

All messages use this structure:

```typescript
interface AudioEvent {
  type: AudioEventType;
  payload: Partial<SyncCoreState>;
  timestamp: number;
  instanceId: string;
}
```

### Event Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `PLAY` | Broadcast | Start playback |
| `PAUSE` | Broadcast | Pause playback |
| `SEEK` | Broadcast | Seek to time |
| `STOP` | Broadcast | Stop playback |
| `STATE_UPDATE` | Leader → All | Periodic sync |
| `LEADERSHIP_CLAIM` | Claimant → All | Request leadership |
| `LEADERSHIP_ACK` | Responder → Claimant | Acknowledge claim |
| `SYNC_REQUEST` | New tab → All | Request current state |
| `PLAYLIST_*` | Broadcast | Playlist actions |

### State Consistency

**Conflict Resolution:**
1. Leader's state is authoritative
2. Most recent action wins (by timestamp)
3. Leadership claim preempts other claims

**Eventual Consistency:**
- Periodic `STATE_UPDATE` broadcasts
- Catch-up on `SYNC_REQUEST`
- Latency compensation for timing

## Module Organization

```
src/
├── model/                        # Core domain models
│   ├── AudioInstance.ts          # Main API (orchestrator)
│   ├── Engine.ts                 # State manager
│   ├── Driver.ts                 # Playback controller
│   ├── EventEmitter.ts           # Event system
│   ├── sync/                     # Synchronization
│   │   ├── SyncCoordinator.ts    # Communication infrastructure
│   │   ├── PlaybackSyncHandler.ts # Playback sync logic ✨ NEW
│   │   └── LatencyCompensator.ts # Latency calculations
│   ├── playlist/                 # Playlist system
│   │   ├── Playlist.ts           # Pure playlist logic
│   │   └── PlaylistManager.ts    # Playlist sync logic
│   └── types/                    # TypeScript types
│       ├── engine.types.ts
│       ├── syncCore.types.ts
│       ├── playlist.types.ts
│       └── eventEmitter.types.ts
├── config/                       # Default configurations
│   ├── engine.config.ts
│   ├── sync.config.ts
│   └── playlist.config.ts
└── index.ts                      # Public API exports

Key Changes:
━━━━━━━━━━━
✨ PlaybackSyncHandler - Extracted from AudioInstance
   → Handles all playback synchronization logic
   → Clean separation from orchestration code
```

## Design Principles

### 1. Separation of Concerns

Each component has a single, well-defined responsibility:

- **AudioInstance**: Orchestration and routing only
- **Engine**: State management only, no side effects
- **Driver**: Audio playback control only, no state logic
- **SyncCoordinator**: Communication infrastructure only
- **PlaybackSyncHandler**: Playback synchronization logic only
- **PlaylistManager**: Playlist synchronization logic only
- **Playlist**: Pure playlist logic only

**Benefits:**
- Easy to understand and maintain
- Each class can be tested independently
- Changes to one component don't affect others
- Clear boundaries and interfaces

### 2. Single Responsibility Principle (SRP)

**Before refactoring:**
```typescript
// AudioInstance had too many responsibilities:
class AudioInstance {
  // ❌ Orchestration
  // ❌ Playback sync logic
  // ❌ Event routing
  // ❌ Playlist integration
}
```

**After refactoring:**
```typescript
// AudioInstance now only orchestrates:
class AudioInstance {
  private _playbackSyncHandler: PlaybackSyncHandler;
  private _playlistManager: PlaylistManager;
  
  // ✅ Routes events to appropriate handlers
  // ✅ Coordinates lifecycle
  // ✅ Exposes public API
}

// Sync logic extracted to dedicated handler:
class PlaybackSyncHandler {
  // ✅ Determines if events should sync
  // ✅ Handles remote playback events
  // ✅ Applies latency compensation
}
```

### 3. Event-Driven Architecture

- Loose coupling between components
- React to changes, don't poll
- Easy to extend with new features
- Clear communication patterns

### 4. Type Safety

- Full TypeScript coverage
- Generic event emitter for type-safe events
- Strict type checking
- No `any` types in public API
- Comprehensive type definitions

### 5. Testability

- Pure functions where possible
- Dependency injection
- Minimal side effects
- Mockable interfaces
- Each component can be tested in isolation

## Performance Considerations

### Memory

- Single `HTMLAudioElement` per instance
- Event subscribers cleaned up on destroy
- BroadcastChannel closed on destroy

### Network

- Configurable sync interval
- Only leader broadcasts periodic updates
- Events are lightweight JSON

### CPU

- Efficient event subscription/unsubscription
- Minimal DOM operations
- No polling, only event-driven updates

## Extension Points

### Custom Events

Add new events by extending types:

```typescript
declare module '@borobysh/audio-sync-core' {
  interface AudioInstanceEventData {
    customEvent: { data: string };
  }
}
```

### Custom Playlist Logic

Extend `Playlist` class:

```typescript
class SmartPlaylist extends Playlist {
  addSmart(criteria: Criteria): void {
    // Custom logic
  }
}
```

### Custom Sync Protocol

Extend `SyncCoordinator`:

```typescript
class CustomCoordinator extends SyncCoordinator {
  // Override broadcast logic
}
```

## See Also

- [AudioInstance API](../api/AudioInstance.md)
- [Synchronization Guide](../guides/synchronization.md)
- [Leadership Protocol](./leadership.md)
- [Latency Compensation](./latency.md)
