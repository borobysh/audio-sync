/**
 * Media Session API Example
 * 
 * This example demonstrates how to use the Media Session API integration
 * to provide native OS-level media controls.
 */

import { AudioInstance } from '../src/index';

// ============================================================================
// Example 1: Basic Usage (Auto-enabled)
// ============================================================================

console.log('=== Example 1: Basic Usage ===\n');

const basicPlayer = new AudioInstance('basic-channel', {
    playlist: {
        autoAdvance: true
    }
    // Media Session is enabled by default!
});

// Add tracks with metadata
basicPlayer.playlist?.addMany([
    {
        id: 'track1',
        src: 'https://example.com/song1.mp3',
        title: 'Beautiful Day',
        artist: 'The Band',
        album: 'Greatest Hits',
        coverArt: 'https://example.com/album-cover.jpg',
        duration: 240
    },
    {
        id: 'track2',
        src: 'https://example.com/song2.mp3',
        title: 'Summer Vibes',
        artist: 'The Band',
        album: 'Greatest Hits',
        coverArt: 'https://example.com/album-cover.jpg',
        duration: 180
    }
]);

// Start playback
basicPlayer.playlist?.play(0);

console.log('✅ Media Session automatically shows:');
console.log('   - Track title, artist, album');
console.log('   - Cover art');
console.log('   - Play/Pause, Next, Previous buttons');
console.log('   - Works on lock screen, notifications, hardware buttons\n');

// ============================================================================
// Example 2: Custom Configuration
// ============================================================================

console.log('=== Example 2: Custom Configuration ===\n');

const podcastPlayer = new AudioInstance('podcast-channel', {
    singlePlayback: true,
    playlist: {
        autoAdvance: true
    },
    mediaSession: {
        enabled: true,
        seekStep: 15,  // 15 seconds for podcasts
        updateInterval: 1000,
        actions: [
            'play',
            'pause',
            'nexttrack',
            'previoustrack',
            'seekforward',
            'seekbackward'
        ],
        artwork: {
            defaultUrl: 'https://example.com/default-podcast-cover.jpg',
            sizes: [96, 128, 192, 256, 384, 512]
        }
    }
});

// Add podcast episodes
podcastPlayer.playlist?.addMany([
    {
        id: 'ep1',
        src: 'https://example.com/episode1.mp3',
        title: 'Episode 1: Introduction to TypeScript',
        artist: 'Tech Podcast',
        album: 'Season 1',
        coverArt: 'https://example.com/season1-cover.jpg',
        duration: 3600  // 1 hour
    },
    {
        id: 'ep2',
        src: 'https://example.com/episode2.mp3',
        title: 'Episode 2: Advanced TypeScript',
        artist: 'Tech Podcast',
        album: 'Season 1',
        coverArt: 'https://example.com/season1-cover.jpg',
        duration: 4200  // 70 minutes
    }
]);

console.log('✅ Podcast player with:');
console.log('   - 15 second seek steps');
console.log('   - Default artwork fallback');
console.log('   - Custom action set\n');

// ============================================================================
// Example 3: Manual Metadata Updates
// ============================================================================

console.log('=== Example 3: Manual Metadata Updates ===\n');

const manualPlayer = new AudioInstance('manual-channel');

// Manually update metadata
manualPlayer.mediaSession?.onTrackChange({
    title: 'Custom Track Title',
    artist: 'Custom Artist',
    album: 'Custom Album',
    artwork: [
        { src: 'cover-96.jpg', sizes: '96x96', type: 'image/jpeg' },
        { src: 'cover-512.jpg', sizes: '512x512', type: 'image/jpeg' }
    ]
});

console.log('✅ Manually updated metadata');
console.log('   - Useful for dynamic content');
console.log('   - Live streams, radio, etc.\n');

// ============================================================================
// Example 4: Check Browser Support
// ============================================================================

console.log('=== Example 4: Browser Support Check ===\n');

const player = new AudioInstance('check-channel');

if (player.mediaSession?.isSupported()) {
    console.log('✅ Media Session API is supported!');
    console.log('   - Lock screen controls available');
    console.log('   - Hardware buttons will work');
    console.log('   - System notifications enabled\n');
} else {
    console.log('⚠️ Media Session API not supported');
    console.log('   - Playback still works normally');
    console.log('   - No OS-level controls available\n');
}

// ============================================================================
// Example 5: Leadership-Aware Usage
// ============================================================================

console.log('=== Example 5: Leadership-Aware Usage ===\n');

const leaderPlayer = new AudioInstance('leader-channel', {
    singlePlayback: true
});

leaderPlayer.on('leaderChange', ({ isLeader }) => {
    if (isLeader) {
        console.log('👑 This tab is now the leader');
        console.log('   - Controls Media Session');
        console.log('   - Updates lock screen');
        console.log('   - Handles hardware buttons\n');
    } else {
        console.log('👥 This tab is a follower');
        console.log('   - Does not control Media Session');
        console.log('   - Can send commands to leader\n');
    }
});

// ============================================================================
// Example 6: Disable Media Session
// ============================================================================

console.log('=== Example 6: Disable Media Session ===\n');

const disabledPlayer = new AudioInstance('disabled-channel', {
    mediaSession: {
        enabled: false  // Explicitly disable
    }
});

console.log('✅ Media Session disabled');
console.log('   - Playback works normally');
console.log('   - No OS-level controls');
console.log('   - Useful for background audio, sound effects, etc.\n');

// ============================================================================
// Example 7: Custom Action Handlers (Advanced)
// ============================================================================

console.log('=== Example 7: Custom Action Handlers ===\n');

const advancedPlayer = new AudioInstance('advanced-channel', {
    mediaSession: { enabled: false }  // Disable auto-setup
});

// Get Media Session instance
const mediaSession = advancedPlayer.mediaSession?.getMediaSession();

// Set custom handlers
mediaSession?.setActionHandler('play', () => {
    console.log('🎮 Custom play handler');
    advancedPlayer.play();
});

mediaSession?.setActionHandler('seekbackward', (details) => {
    const offset = details?.seekOffset || 30;  // Custom 30s seek
    const newTime = Math.max(0, advancedPlayer.state.currentTime - offset);
    console.log(`🎮 Custom seek backward: ${offset}s`);
    advancedPlayer.seek(newTime);
});

// Activate manually
mediaSession?.activate();

console.log('✅ Custom action handlers registered');
console.log('   - Override default behavior');
console.log('   - Add custom logic');
console.log('   - Analytics, logging, etc.\n');

// ============================================================================
// Example 8: Remote Control Mode
// ============================================================================

console.log('=== Example 8: Remote Control Mode ===\n');

const remotePlayer = new AudioInstance('remote-channel', {
    singlePlayback: true,
    allowRemoteControl: true,  // Followers can control without leadership
    autoClaimLeadershipIfNone: true
});

console.log('✅ Remote Control Mode (like Spotify Connect)');
console.log('   - Leader tab plays audio');
console.log('   - Follower tabs can control playback');
console.log('   - Only leader updates Media Session');
console.log('   - Perfect for multi-device scenarios\n');

// ============================================================================
// Example 9: Event Listeners
// ============================================================================

console.log('=== Example 9: Event Listeners ===\n');

const eventPlayer = new AudioInstance('event-channel', {
    playlist: { autoAdvance: true }
});

eventPlayer.on('play', ({ src }) => {
    console.log('▶️ Playing:', src);
});

eventPlayer.on('pause', () => {
    console.log('⏸️ Paused');
});

eventPlayer.on('playlistTrackChanged', ({ current, previous }) => {
    console.log('🎵 Track changed:');
    console.log('   From:', previous?.title || 'none');
    console.log('   To:', current?.title || 'none');
    // Media Session automatically updates!
});

console.log('✅ Event listeners registered');
console.log('   - Track playback state');
console.log('   - React to track changes');
console.log('   - Media Session updates automatically\n');

// ============================================================================
// Example 10: Complete Music App
// ============================================================================

console.log('=== Example 10: Complete Music App ===\n');

const musicApp = new AudioInstance('music-app', {
    singlePlayback: true,
    allowRemoteControl: true,
    playlist: {
        autoAdvance: true,
        defaultRepeatMode: 'all',
        defaultShuffle: false
    },
    mediaSession: {
        enabled: true,
        seekStep: 10,
        actions: ['play', 'pause', 'previoustrack', 'nexttrack', 'seekforward', 'seekbackward'],
        artwork: {
            defaultUrl: '/default-music-cover.jpg'
        }
    }
});

// Add library
musicApp.playlist?.addMany([
    {
        id: '1',
        src: 'song1.mp3',
        title: 'Song 1',
        artist: 'Artist 1',
        album: 'Album 1',
        coverArt: 'cover1.jpg',
        duration: 240
    },
    {
        id: '2',
        src: 'song2.mp3',
        title: 'Song 2',
        artist: 'Artist 2',
        album: 'Album 2',
        coverArt: 'cover2.jpg',
        duration: 180
    }
]);

// Setup UI event listeners
musicApp.on('play', () => {
    console.log('🎵 Update UI: Show pause button');
});

musicApp.on('pause', () => {
    console.log('⏸️ Update UI: Show play button');
});

musicApp.on('playlistTrackChanged', ({ current }) => {
    console.log('🎵 Update UI: Show current track:', current?.title);
});

musicApp.on('leaderChange', ({ isLeader }) => {
    console.log(isLeader ? '👑 Leader tab' : '👥 Follower tab');
});

console.log('✅ Complete music app setup:');
console.log('   - Playlist with auto-advance');
console.log('   - Media Session with OS controls');
console.log('   - Cross-tab synchronization');
console.log('   - Remote control support');
console.log('   - Event-driven UI updates\n');

// ============================================================================
// Summary
// ============================================================================

console.log('=== Summary ===\n');
console.log('Media Session API provides:');
console.log('✅ Lock screen controls');
console.log('✅ System notifications');
console.log('✅ Hardware button support');
console.log('✅ Native OS integration');
console.log('✅ Automatic metadata updates');
console.log('✅ Cross-tab coordination');
console.log('✅ Graceful degradation\n');

console.log('Usage:');
console.log('1. Enabled by default - just add metadata to tracks');
console.log('2. Customize via mediaSession config');
console.log('3. Works seamlessly with playlist');
console.log('4. Respects leader-follower model');
console.log('5. No extra code needed for basic usage\n');

// Cleanup
setTimeout(() => {
    basicPlayer.destroy();
    podcastPlayer.destroy();
    manualPlayer.destroy();
    player.destroy();
    leaderPlayer.destroy();
    disabledPlayer.destroy();
    advancedPlayer.destroy();
    remotePlayer.destroy();
    eventPlayer.destroy();
    musicApp.destroy();
    console.log('✅ All players destroyed\n');
}, 5000);
