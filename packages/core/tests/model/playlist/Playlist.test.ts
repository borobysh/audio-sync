import { describe, it, expect, beforeEach } from 'vitest';
import { Playlist } from '../../../src/model/playlist/Playlist';
import { Track } from '../../../src/model/types/playlist.types';

describe('Playlist', () => {
    let playlist: Playlist;
    const tracks: Track[] = [
        { id: '1', src: 'track1.mp3', title: 'Track 1' },
        { id: '2', src: 'track2.mp3', title: 'Track 2' },
        { id: '3', src: 'track3.mp3', title: 'Track 3' },
        { id: '4', src: 'track4.mp3', title: 'Track 4' },
    ];

    beforeEach(() => {
        playlist = new Playlist();
    });

    describe('Track Management', () => {
        it('should add tracks', () => {
            playlist.add(tracks[0]);
            expect(playlist.tracks).toHaveLength(1);
            expect(playlist.tracks[0]).toEqual(tracks[0]);
        });

        it('should add multiple tracks', () => {
            playlist.addMany(tracks);
            expect(playlist.tracks).toHaveLength(4);
        });

        it('should remove track by id', () => {
            playlist.addMany(tracks);
            const removed = playlist.remove('2');
            expect(removed).toBe(true);
            expect(playlist.tracks).toHaveLength(3);
            expect(playlist.tracks.find(t => t.id === '2')).toBeUndefined();
        });

        it('should clear all tracks', () => {
            playlist.addMany(tracks);
            playlist.clear();
            expect(playlist.tracks).toHaveLength(0);
            expect(playlist.currentTrack).toBeNull();
        });

        it('should move track position', () => {
            playlist.addMany(tracks);
            playlist.move(0, 2);
            expect(playlist.tracks[2].id).toBe('1');
        });
    });

    describe('Navigation', () => {
        beforeEach(() => {
            playlist.addMany(tracks);
        });

        it('should jump to track by index', () => {
            const success = playlist.jumpTo(1);
            expect(success).toBe(true);
            expect(playlist.currentTrack?.id).toBe('2');
        });

        it('should move to next track', () => {
            playlist.jumpTo(0);
            const nextTrack = playlist.next();
            expect(nextTrack?.id).toBe('2');
        });

        it('should move to previous track', () => {
            playlist.jumpTo(2);
            const prevTrack = playlist.prev();
            expect(prevTrack?.id).toBe('2');
        });

        it('should return null at end without repeat', () => {
            playlist.jumpTo(3);
            const nextTrack = playlist.next();
            expect(nextTrack).toBeNull();
        });

        it('should loop to start with repeat all', () => {
            playlist.setRepeat('all');
            playlist.jumpTo(3);
            const nextTrack = playlist.next();
            expect(nextTrack?.id).toBe('1');
        });

        it('should stay on same track with repeat one', () => {
            playlist.setRepeat('one');
            playlist.jumpTo(1);
            const nextTrack = playlist.next();
            expect(nextTrack?.id).toBe('2');
        });
    });

    describe('Shuffle', () => {
        beforeEach(() => {
            playlist.addMany(tracks);
        });

        it('should enable shuffle', () => {
            playlist.setShuffle(true);
            expect(playlist.state.shuffleEnabled).toBe(true);
        });

        it('should create shuffled queue', () => {
            playlist.setShuffle(true);
            const queue = playlist.queue;
            expect(queue).toHaveLength(4);
            // Queue should contain all tracks
            expect(queue.every(t => tracks.find(orig => orig.id === t.id))).toBe(true);
        });

        it('should maintain current track after shuffle', () => {
            playlist.jumpTo(1);
            const currentBefore = playlist.currentTrack;
            playlist.setShuffle(true);
            const currentAfter = playlist.currentTrack;
            expect(currentBefore?.id).toBe(currentAfter?.id);
        });
    });

    describe('Repeat Modes', () => {
        it('should set repeat mode', () => {
            playlist.setRepeat('all');
            expect(playlist.state.repeatMode).toBe('all');
        });

        it('should toggle repeat mode', () => {
            expect(playlist.state.repeatMode).toBe('none');
            playlist.toggleRepeat();
            expect(playlist.state.repeatMode).toBe('all');
            playlist.toggleRepeat();
            expect(playlist.state.repeatMode).toBe('one');
            playlist.toggleRepeat();
            expect(playlist.state.repeatMode).toBe('none');
        });
    });

    describe('State', () => {
        it('should get complete state', () => {
            playlist.addMany(tracks);
            playlist.jumpTo(1);
            playlist.setRepeat('all');
            playlist.setShuffle(true);

            const state = playlist.state;
            expect(state.tracks).toHaveLength(4);
            expect(state.currentIndex).toBeTypeOf('number');
            expect(state.repeatMode).toBe('all');
            expect(state.shuffleEnabled).toBe(true);
        });

        it('should set state', () => {
            playlist.setState({
                tracks: tracks,
                currentIndex: 2,
                repeatMode: 'one',
                shuffleEnabled: false
            });

            expect(playlist.tracks).toHaveLength(4);
            expect(playlist.currentTrack?.id).toBe('3');
            expect(playlist.state.repeatMode).toBe('one');
        });
    });

    describe('Events', () => {
        it('should emit trackChanged event', () => {
            return new Promise<void>((resolve) => {
                playlist.addMany(tracks);
                playlist.jumpTo(0);

                playlist.on('trackChanged', ({ current }) => {
                    expect(current?.id).toBe('2');
                    resolve();
                });

                playlist.next();
            });
        });

        it('should emit queueUpdated event', () => {
            return new Promise<void>((resolve) => {
                playlist.on('queueUpdated', ({ tracks }) => {
                    expect(tracks).toHaveLength(1);
                    resolve();
                });

                playlist.add(tracks[0]);
            });
        });

        it('should emit playlistEnded event', () => {
            return new Promise<void>((resolve) => {
                playlist.addMany(tracks);
                playlist.jumpTo(3);

                playlist.on('playlistEnded', () => {
                    resolve();
                });

                playlist.next();
            });
        });

        it('should emit repeatModeChanged event', () => {
            return new Promise<void>((resolve) => {
                playlist.on('repeatModeChanged', ({ mode }) => {
                    expect(mode).toBe('all');
                    resolve();
                });

                playlist.setRepeat('all');
            });
        });

        it('should emit shuffleChanged event', () => {
            return new Promise<void>((resolve) => {
                playlist.on('shuffleChanged', ({ enabled }) => {
                    expect(enabled).toBe(true);
                    resolve();
                });

                playlist.setShuffle(true);
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty playlist', () => {
            expect(playlist.currentTrack).toBeNull();
            expect(playlist.next()).toBeNull();
            expect(playlist.prev()).toBeNull();
        });

        it('should handle invalid jump index', () => {
            playlist.addMany(tracks);
            expect(playlist.jumpTo(-1)).toBe(false);
            expect(playlist.jumpTo(10)).toBe(false);
        });

        it('should handle removing non-existent track', () => {
            playlist.addMany(tracks);
            const removed = playlist.remove('non-existent');
            expect(removed).toBe(false);
        });
    });
});
