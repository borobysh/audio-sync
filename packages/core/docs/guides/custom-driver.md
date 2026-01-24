# Custom Driver Implementation

Audio Sync Core follows the **Dependency Inversion Principle** - you can provide your own audio implementation without being tied to browser APIs.

## Why Custom Drivers?

The default `Driver` class is specifically designed for **HTMLAudioElement** (browser environment). If you need:

- ✅ Web Audio API instead of HTMLAudioElement  
- ✅ Third-party libraries (Howler.js, Tone.js, etc.)
- ✅ Mocks for testing
- ✅ Non-browser environments (React Native, Node.js)
- ✅ Future-proof implementation (when Audio API changes)

...then you create your own Driver by extending `AbstractDriver`.

## Architecture

```
AudioInstance
    ↓ uses
AbstractDriver (interface/contract)
    ↓ implements
    ├─ Driver (default, browser, uses addEventListener)
    ├─ YourCustomDriver (your implementation)
    ├─ WebAudioDriver (Web Audio API)
    └─ HowlerDriver (Howler.js)
```

**Key point:** `AbstractDriver` defines the contract. Your implementation can use ANY audio library/API internally.

## Two Levels of Abstraction

### Level 1: AudioElementContract (Low-level)

This is the minimal interface for audio elements (new Audio(), Web Audio nodes, etc.):

```typescript
// Your custom audio element (if you want to use audioElement injection)
const player = new AudioInstance('channel', {
    audioElement: myCustomElement  // Must satisfy AudioElementContract
});
```

**Use when:** You want to use the default Driver but with a custom audio element.

### Level 2: AbstractDriver (High-level) ✅ RECOMMENDED

This is the contract for Driver implementations:

```typescript
// Your custom driver (full control)
const player = new AudioInstance('channel', {
    driver: new MyCustomDriver(engine)  // Must extend AbstractDriver
});
```

**Use when:** You need full control over audio logic, events, buffering, etc.

---

## AudioElementContract Interface (Low-level)

Your custom audio element must satisfy this minimal interface:

```typescript
interface AudioElementContract {
    // Required state
    src: string;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;

    // Required methods
    play(): Promise<void>;
    pause(): void;

    // Required event handlers
    ontimeupdate: ((this: any, ev: any) => any) | null;
    onplaying: ((this: any, ev: any) => any) | null;
    onpause: ((this: any, ev: any) => any) | null;
    onerror: ((this: any, ev: any) => any) | null;
    onended: ((this: any, ev: any) => any) | null;

    // Optional (browser-specific features)
    readyState?: AudioReadyState;
    oncanplay?: ((this: any, ev: any) => any) | null;
    addEventListener?: (type: string, listener: any) => void;
    removeEventListener?: (type: string, listener: any) => void;
    buffered?: {
        length: number;
        start(index: number): number;
        end(index: number): number;
    };
}
```

## Example: Custom Audio Element

### Basic Custom Implementation

```typescript
import { AudioInstance } from '@borobysh/audio-sync-core';

class CustomAudioElement {
    src = '';
    currentTime = 0;
    duration = 0;
    volume = 1;
    muted = false;

    ontimeupdate = null;
    onplaying = null;
    onpause = null;
    onerror = null;
    onended = null;

    private isPlaying = false;
    private interval: any = null;

    async play() {
        this.isPlaying = true;
        this.onplaying?.(null);
        
        // Simulate time updates
        this.interval = setInterval(() => {
            if (this.isPlaying) {
                this.currentTime += 0.1;
                this.ontimeupdate?.(null);
                
                if (this.currentTime >= this.duration) {
                    this.pause();
                    this.onended?.(null);
                }
            }
        }, 100);
    }

    pause() {
        this.isPlaying = false;
        clearInterval(this.interval);
        this.onpause?.(null);
    }
}

// Use custom element
const player = new AudioInstance('my_channel', {
    audioElement: new CustomAudioElement()
});
```

### Web Audio API Wrapper

```typescript
class WebAudioWrapper {
    private audioContext: AudioContext;
    private sourceNode: AudioBufferSourceNode | null = null;
    private gainNode: GainNode;
    private startTime = 0;
    private pauseTime = 0;

    src = '';
    currentTime = 0;
    duration = 0;
    muted = false;

    ontimeupdate = null;
    onplaying = null;
    onpause = null;
    onerror = null;
    onended = null;

    constructor() {
        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
    }

    get volume() {
        return this.gainNode.gain.value;
    }

    set volume(value: number) {
        this.gainNode.gain.value = value;
    }

    async play() {
        if (!this.src) {
            throw new Error('No source set');
        }

        // Load audio if not loaded
        if (!this.sourceNode) {
            const response = await fetch(this.src);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.duration = audioBuffer.duration;
            this.sourceNode = this.audioContext.createBufferSource();
            this.sourceNode.buffer = audioBuffer;
            this.sourceNode.connect(this.gainNode);
            
            this.sourceNode.onended = () => {
                this.onended?.(null);
            };
        }

        this.sourceNode.start(0, this.pauseTime);
        this.startTime = this.audioContext.currentTime - this.pauseTime;
        this.onplaying?.(null);

        // Update current time
        const updateInterval = setInterval(() => {
            if (this.sourceNode) {
                this.currentTime = this.audioContext.currentTime - this.startTime;
                this.ontimeupdate?.(null);
            } else {
                clearInterval(updateInterval);
            }
        }, 100);
    }

    pause() {
        if (this.sourceNode) {
            this.pauseTime = this.audioContext.currentTime - this.startTime;
            this.sourceNode.stop();
            this.sourceNode = null;
            this.onpause?.(null);
        }
    }
}

const player = new AudioInstance('my_channel', {
    audioElement: new WebAudioWrapper()
});
```

### Howler.js Integration

```typescript
import { Howl } from 'howler';

class HowlerWrapper {
    private howl: Howl | null = null;
    private _src = '';

    currentTime = 0;
    duration = 0;
    volume = 1;
    muted = false;

    ontimeupdate = null;
    onplaying = null;
    onpause = null;
    onerror = null;
    onended = null;

    get src() {
        return this._src;
    }

    set src(value: string) {
        this._src = value;
        if (this.howl) {
            this.howl.unload();
        }
        
        this.howl = new Howl({
            src: [value],
            html5: true,
            onload: () => {
                this.duration = this.howl!.duration();
            },
            onplay: () => {
                this.onplaying?.(null);
                this.startTimeUpdates();
            },
            onpause: () => {
                this.onpause?.(null);
            },
            onend: () => {
                this.onended?.(null);
            },
            onloaderror: (id, error) => {
                this.onerror?.(null);
            }
        });
    }

    private timeUpdateInterval: any = null;

    private startTimeUpdates() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
        
        this.timeUpdateInterval = setInterval(() => {
            if (this.howl) {
                this.currentTime = this.howl.seek() as number;
                this.ontimeupdate?.(null);
            }
        }, 100);
    }

    async play() {
        if (this.howl) {
            this.howl.play();
        }
    }

    pause() {
        if (this.howl) {
            this.howl.pause();
        }
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
    }
}

const player = new AudioInstance('my_channel', {
    audioElement: new HowlerWrapper()
});
```

## AbstractDriver Interface (High-level)

```typescript
abstract class AbstractDriver {
    abstract play(src?: string): void;
    abstract pause(): void;
    abstract stop(): void;
    abstract seek(time: number): void;
    abstract setVolume(value: number): void;
    abstract mute(): void;
    abstract unmute(): void;
    abstract toggleMute(): void;
    abstract pauseSilently(): void;
    abstract seekWhenReady(time: number): void;
}
```

---

## Example: Custom Driver (Recommended Approach)

Extend `AbstractDriver` to create your own driver with ANY audio implementation:

```typescript
import { AbstractDriver, Engine } from '@borobysh/audio-sync-core';

class WebAudioDriver extends AbstractDriver {
    private audioContext: AudioContext;
    private sourceNode: AudioBufferSourceNode | null = null;
    private gainNode: GainNode;
    private audioBuffer: AudioBuffer | null = null;
    private isPlaying = false;
    private currentSrc = '';

    constructor(engine: Engine) {
        super(engine);
        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
    }

    async play(src?: string): Promise<void> {
        if (src && src !== this.currentSrc) {
            // Load new audio
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.currentSrc = src;
        }

        if (this.audioBuffer) {
            this.sourceNode = this.audioContext.createBufferSource();
            this.sourceNode.buffer = this.audioBuffer;
            this.sourceNode.connect(this.gainNode);
            this.sourceNode.start(0);
            this.isPlaying = true;

            // Update engine state
            this.engine.updateState({
                currentSrc: this.currentSrc,
                isPlaying: true,
                duration: this.audioBuffer.duration
            });

            // Trigger time updates
            this.startTimeUpdates();
        }
    }

    pause(): void {
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode = null;
            this.isPlaying = false;
            this.engine.updateState({ isPlaying: false });
        }
    }

    stop(): void {
        this.pause();
        this.engine.updateState({ currentTime: 0 });
    }

    seek(time: number): void {
        // Web Audio API requires recreating source node for seek
        const wasPlaying = this.isPlaying;
        this.pause();
        
        if (wasPlaying) {
            // Resume from new position (simplified - real implementation needs offset)
            this.play();
        }
    }

    setVolume(value: number): void {
        this.gainNode.gain.value = value;
        this.engine.updateState({ volume: value });
    }

    mute(): void {
        this.gainNode.gain.value = 0;
        this.engine.updateState({ muted: true });
    }

    unmute(): void {
        this.gainNode.gain.value = 1;
        this.engine.updateState({ muted: false });
    }

    toggleMute(): void {
        if (this.gainNode.gain.value > 0) {
            this.mute();
        } else {
            this.unmute();
        }
    }

    pauseSilently(): void {
        // Same as pause but without triggering engine events
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode = null;
            this.isPlaying = false;
        }
    }

    seekWhenReady(time: number): void {
        // Implement seek when audio is ready
        this.seek(time);
    }

    private startTimeUpdates(): void {
        const interval = setInterval(() => {
            if (!this.isPlaying) {
                clearInterval(interval);
                return;
            }
            
            const currentTime = this.audioContext.currentTime;
            this.engine.updateState({ currentTime });
        }, 100);
    }
}

// Usage
const engine = new Engine();
const customDriver = new WebAudioDriver(engine);

const player = new AudioInstance('my_channel', {
    driver: customDriver
});
```

**Key benefits:**
- ✅ **No dependency on HTMLAudioElement or browser APIs**
- ✅ **Full control** over audio implementation
- ✅ **Future-proof** - when Audio API changes, just update your Driver
- ✅ **Testing** - easy to mock Driver methods
- ✅ **Platform-agnostic** - works anywhere you can implement the methods

## Testing with Mocks

```typescript
class MockAudioElement {
    src = '';
    currentTime = 0;
    duration = 100;
    volume = 1;
    muted = false;

    ontimeupdate = null;
    onplaying = null;
    onpause = null;
    onerror = null;
    onended = null;

    async play() {
        console.log('Mock play called');
        this.onplaying?.(null);
    }

    pause() {
        console.log('Mock pause called');
        this.onpause?.(null);
    }

    triggerTimeUpdate(time: number) {
        this.currentTime = time;
        this.ontimeupdate?.(null);
    }

    triggerEnded() {
        this.onended?.(null);
    }
}

// Use in tests
const mockAudio = new MockAudioElement();
const player = new AudioInstance('test_channel', {
    audioElement: mockAudio
});

// Trigger events manually
mockAudio.triggerTimeUpdate(50);
mockAudio.triggerEnded();
```

## React Native Example

```typescript
import { Audio } from 'expo-av';

class ExpoAudioWrapper {
    private sound: Audio.Sound | null = null;
    private _src = '';

    currentTime = 0;
    duration = 0;
    volume = 1;
    muted = false;

    ontimeupdate = null;
    onplaying = null;
    onpause = null;
    onerror = null;
    onended = null;

    get src() {
        return this._src;
    }

    set src(value: string) {
        this._src = value;
    }

    async play() {
        if (!this.sound) {
            const { sound } = await Audio.Sound.createAsync(
                { uri: this.src },
                { shouldPlay: true },
                this.onPlaybackStatusUpdate
            );
            this.sound = sound;
        } else {
            await this.sound.playAsync();
        }
        this.onplaying?.(null);
    }

    async pause() {
        if (this.sound) {
            await this.sound.pauseAsync();
            this.onpause?.(null);
        }
    }

    private onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            this.currentTime = status.positionMillis / 1000;
            this.duration = status.durationMillis / 1000;
            this.ontimeupdate?.(null);

            if (status.didJustFinish) {
                this.onended?.(null);
            }
        }
    };
}

const player = new AudioInstance('mobile_channel', {
    audioElement: new ExpoAudioWrapper()
});
```

## Benefits

**Flexibility:**
- Use any audio library or API
- Support multiple platforms
- Easy to test

**No Vendor Lock-in:**
- Not tied to browser APIs
- Easy to switch implementations
- Future-proof

**Performance:**
- Use optimized audio libraries
- Custom buffering strategies
- Platform-specific optimizations
