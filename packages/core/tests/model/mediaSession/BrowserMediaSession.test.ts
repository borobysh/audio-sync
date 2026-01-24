import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserMediaSession } from '../../../src/model/mediaSession/BrowserMediaSession';
import { MediaSessionConfig, MediaSessionCallbacks } from '../../../src/model/types/mediaSession.types';

describe('BrowserMediaSession', () => {
    let config: MediaSessionConfig;
    let callbacks: MediaSessionCallbacks;
    let mockMediaSession: any;

    beforeEach(() => {
        // Mock navigator.mediaSession
        mockMediaSession = {
            metadata: null,
            playbackState: 'none',
            setActionHandler: vi.fn(),
            setPositionState: vi.fn()
        };

        // @ts-ignore
        global.navigator = {
            mediaSession: mockMediaSession
        };

        // @ts-ignore
        global.window = {
            MediaMetadata: class MediaMetadata {
                title: string;
                artist: string;
                album: string;
                artwork: any[];

                constructor(data: any) {
                    this.title = data.title;
                    this.artist = data.artist;
                    this.album = data.album;
                    this.artwork = data.artwork;
                }
            }
        };

        config = {
            enabled: true,
            seekStep: 10,
            updateInterval: 1000
        };

        callbacks = {
            onPlay: vi.fn(),
            onPause: vi.fn(),
            onStop: vi.fn(),
            onSeekBackward: vi.fn(),
            onSeekForward: vi.fn(),
            onSeekTo: vi.fn(),
            onPreviousTrack: vi.fn(),
            onNextTrack: vi.fn()
        };
    });

    describe('isSupported', () => {
        it('should return true when Media Session API is available', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            expect(mediaSession.isSupported()).toBe(true);
        });

        it('should return false when Media Session API is not available', () => {
            // @ts-ignore
            delete global.navigator.mediaSession;
            const mediaSession = new BrowserMediaSession(config, callbacks);
            expect(mediaSession.isSupported()).toBe(false);
        });
    });

    describe('activate', () => {
        it('should activate Media Session and register action handlers', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            expect(mediaSession.isMediaSessionActive()).toBe(true);
            expect(mockMediaSession.setActionHandler).toHaveBeenCalled();
        });

        it('should not activate if already active', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();
            
            mockMediaSession.setActionHandler.mockClear();
            mediaSession.activate();

            expect(mockMediaSession.setActionHandler).not.toHaveBeenCalled();
        });

        it('should not activate if disabled in config', () => {
            const disabledConfig = { ...config, enabled: false };
            const mediaSession = new BrowserMediaSession(disabledConfig, callbacks);
            mediaSession.activate();

            expect(mediaSession.isMediaSessionActive()).toBe(false);
        });
    });

    describe('deactivate', () => {
        it('should deactivate Media Session and unregister handlers', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();
            mediaSession.deactivate();

            expect(mediaSession.isMediaSessionActive()).toBe(false);
            expect(mockMediaSession.metadata).toBeNull();
            expect(mockMediaSession.playbackState).toBe('none');
        });
    });

    describe('updateMetadata', () => {
        it('should update metadata with title, artist, and album', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            mediaSession.updateMetadata({
                title: 'Test Song',
                artist: 'Test Artist',
                album: 'Test Album'
            });

            expect(mockMediaSession.metadata).toBeDefined();
            expect(mockMediaSession.metadata.title).toBe('Test Song');
            expect(mockMediaSession.metadata.artist).toBe('Test Artist');
            expect(mockMediaSession.metadata.album).toBe('Test Album');
        });

        it('should handle artwork', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            mediaSession.updateMetadata({
                title: 'Test Song',
                artist: 'Test Artist',
                artwork: [
                    { src: 'cover.jpg', sizes: '512x512', type: 'image/jpeg' }
                ]
            });

            expect(mockMediaSession.metadata.artwork).toHaveLength(1);
            expect(mockMediaSession.metadata.artwork[0].src).toBe('cover.jpg');
        });

        it('should use default values for missing metadata', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            mediaSession.updateMetadata({});

            expect(mockMediaSession.metadata.title).toBe('Unknown Title');
            expect(mockMediaSession.metadata.artist).toBe('Unknown Artist');
        });
    });

    describe('setPlaybackState', () => {
        it('should update playback state', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            mediaSession.setPlaybackState('playing');
            expect(mockMediaSession.playbackState).toBe('playing');

            mediaSession.setPlaybackState('paused');
            expect(mockMediaSession.playbackState).toBe('paused');
        });
    });

    describe('setPositionState', () => {
        it('should update position state with valid values', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            mediaSession.setPositionState({
                duration: 180,
                position: 60,
                playbackRate: 1.0
            });

            expect(mockMediaSession.setPositionState).toHaveBeenCalledWith({
                duration: 180,
                position: 60,
                playbackRate: 1.0
            });
        });

        it('should handle invalid values gracefully', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            // Should not throw
            mediaSession.setPositionState({
                duration: NaN,
                position: -1,
                playbackRate: 0
            });
        });
    });

    describe('action handlers', () => {
        it('should call onPlay callback when play action is triggered', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            // Get the play handler that was registered
            const playHandler = mockMediaSession.setActionHandler.mock.calls.find(
                (call: any) => call[0] === 'play'
            )?.[1];

            expect(playHandler).toBeDefined();
            playHandler();
            expect(callbacks.onPlay).toHaveBeenCalled();
        });

        it('should call onPause callback when pause action is triggered', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            const pauseHandler = mockMediaSession.setActionHandler.mock.calls.find(
                (call: any) => call[0] === 'pause'
            )?.[1];

            expect(pauseHandler).toBeDefined();
            pauseHandler();
            expect(callbacks.onPause).toHaveBeenCalled();
        });

        it('should call onNextTrack callback when nexttrack action is triggered', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            const nextHandler = mockMediaSession.setActionHandler.mock.calls.find(
                (call: any) => call[0] === 'nexttrack'
            )?.[1];

            expect(nextHandler).toBeDefined();
            nextHandler();
            expect(callbacks.onNextTrack).toHaveBeenCalled();
        });

        it('should call onPreviousTrack callback when previoustrack action is triggered', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            const prevHandler = mockMediaSession.setActionHandler.mock.calls.find(
                (call: any) => call[0] === 'previoustrack'
            )?.[1];

            expect(prevHandler).toBeDefined();
            prevHandler();
            expect(callbacks.onPreviousTrack).toHaveBeenCalled();
        });

        it('should call onSeekForward with correct offset', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            const seekForwardHandler = mockMediaSession.setActionHandler.mock.calls.find(
                (call: any) => call[0] === 'seekforward'
            )?.[1];

            expect(seekForwardHandler).toBeDefined();
            seekForwardHandler({ seekOffset: 15 });
            expect(callbacks.onSeekForward).toHaveBeenCalledWith(15);
        });

        it('should call onSeekBackward with default offset if not provided', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            const seekBackwardHandler = mockMediaSession.setActionHandler.mock.calls.find(
                (call: any) => call[0] === 'seekbackward'
            )?.[1];

            expect(seekBackwardHandler).toBeDefined();
            seekBackwardHandler({});
            expect(callbacks.onSeekBackward).toHaveBeenCalledWith(10); // default seekStep
        });

        it('should call onSeekTo with correct time', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            const seekToHandler = mockMediaSession.setActionHandler.mock.calls.find(
                (call: any) => call[0] === 'seekto'
            )?.[1];

            expect(seekToHandler).toBeDefined();
            seekToHandler({ seekTime: 120 });
            expect(callbacks.onSeekTo).toHaveBeenCalledWith(120, undefined);
        });
    });

    describe('custom action handlers', () => {
        it('should allow setting custom action handlers', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            const customHandler = vi.fn();
            mediaSession.setActionHandler('play', customHandler);

            expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('play', customHandler);
        });

        it('should allow removing action handlers', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            mediaSession.setActionHandler('play', null);

            expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('play', null);
        });
    });

    describe('clear', () => {
        it('should clear metadata and reset playback state', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();

            mediaSession.updateMetadata({
                title: 'Test Song',
                artist: 'Test Artist'
            });

            mediaSession.clear();

            expect(mockMediaSession.metadata).toBeNull();
            expect(mockMediaSession.playbackState).toBe('none');
        });
    });

    describe('destroy', () => {
        it('should deactivate and cleanup', () => {
            const mediaSession = new BrowserMediaSession(config, callbacks);
            mediaSession.activate();
            mediaSession.destroy();

            expect(mediaSession.isMediaSessionActive()).toBe(false);
        });
    });
});
