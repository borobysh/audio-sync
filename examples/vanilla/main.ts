import { AudioInstance, AudioInstanceConfig, SyncPresets, Track } from "../../packages/core/src/index";

const tracks: Track[] = [
    {
        id: '1',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        title: 'Sound Helix Song 1',
        artist: 'T. Schürger',
        album: 'Sound Helix Collection',
        coverArt: 'https://picsum.photos/512/512?random=1'
    },
    {
        id: '2',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        title: 'Sound Helix Song 2',
        artist: 'T. Schürger',
        album: 'Sound Helix Collection',
        coverArt: 'https://picsum.photos/512/512?random=2'
    },
    {
        id: '3',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        title: 'Sound Helix Song 3',
        artist: 'T. Schürger',
        album: 'Sound Helix Collection',
        coverArt: 'https://picsum.photos/512/512?random=3'
    },
    {
        id: '4',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
        title: 'Sound Helix Song 4',
        artist: 'T. Schürger',
        album: 'Sound Helix Collection',
        coverArt: 'https://picsum.photos/512/512?random=4'
    },
    {
        id: '5',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
        title: 'Sound Helix Song 5',
        artist: 'T. Schürger',
        album: 'Sound Helix Collection',
        coverArt: 'https://picsum.photos/512/512?random=5'
    },
];

// ═══════════════════════════════════════════════════════════════
// Configuration - Try different presets to see different behaviors!
// ═══════════════════════════════════════════════════════════════
// 
// 🎯 Available presets:
// 
// SyncPresets.INDEPENDENT
//   → Each tab completely independent (no sync)
//   → Use case: Different users/sessions
// 
// SyncPresets.SYNCHRONIZED
//   → All tabs play same content in perfect sync
//   → Use case: Same user, consistent experience
// 
// SyncPresets.REMOTE_CONTROL ✅ CURRENT
//   → One tab plays (leader), others can control remotely
//   → Followers can play/pause/seek/change tracks without becoming leaders
//   → To become leader, click "Become Leader" button
//   → Use case: Desktop plays, phone controls (Spotify-style)
// 
// SyncPresets.PLAY_PAUSE_SYNC
//   → Each tab becomes leader when it plays/pauses
//   → Simple sync: only play/pause state syncs
//   → No track or seek synchronization
//   → Use case: Independent playback with basic state sync
//
// SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS
//   → Play/pause syncs, but each tab has its own track
//   → Use case: Each tab plays different song but playback state syncs
// 
// ═══════════════════════════════════════════════════════════════

const config: AudioInstanceConfig = {
    ...SyncPresets.REMOTE_CONTROL,

    playlist: {
        autoAdvance: true,
        defaultRepeatMode: 'all' as const,
        syncPlaylist: false
    },

    mediaSession: {
        enabled: true,
        seekStep: 10,
        updateInterval: 1000,
        actions: [
            'play' as const,
            'pause' as const,
            'previoustrack' as const,
            'nexttrack' as const,
            'seekforward' as const,
            'seekbackward' as const
        ]
    }
};

const player = new AudioInstance('audio_sync_unified', config);
const playlist = player.playlist;

if (!playlist) {
    throw new Error('Playlist not available');
}

playlist.addMany(tracks);

// --- DOM Elements ---
const playBtn = document.getElementById('play') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const becomeLeaderBtn = document.getElementById('become-leader') as HTMLButtonElement;
const progressBar = document.getElementById('progress-bar') as HTMLElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const timeCurrent = document.getElementById('time-current') as HTMLElement;
const timeDuration = document.getElementById('time-duration') as HTMLElement;
const playlistEl = document.getElementById('playlist') as HTMLElement;
const roleBadge = document.getElementById('role-badge') as HTMLElement;

// Now playing elements
const currentTitle = document.getElementById('current-title') as HTMLElement;
const currentArtist = document.getElementById('current-artist') as HTMLElement;
const currentCover = document.getElementById('current-cover') as HTMLElement;

// Playlist control buttons
const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
const shuffleBtn = document.getElementById('shuffle-btn') as HTMLButtonElement;
const repeatBtn = document.getElementById('repeat-btn') as HTMLButtonElement;

// Volume controls
const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
const volumeValue = document.getElementById('volume-value') as HTMLElement;
const muteBtn = document.getElementById('mute') as HTMLButtonElement;
const unmuteBtn = document.getElementById('unmute') as HTMLButtonElement;

// Seek controls
const seekInput = document.getElementById('seek-input') as HTMLInputElement;
const seekBtn = document.getElementById('seek-btn') as HTMLButtonElement;

// Playback rate controls
const playbackRateDisplay = document.getElementById('playback-rate-display') as HTMLElement;
const speedButtons = document.querySelectorAll('.speed-btn') as NodeListOf<HTMLButtonElement>;
const speedDecreaseBtn = document.getElementById('speed-decrease') as HTMLButtonElement;
const speedIncreaseBtn = document.getElementById('speed-increase') as HTMLButtonElement;

// Instance controls
const destroyBtn = document.getElementById('destroy') as HTMLButtonElement;
const instanceStatus = document.getElementById('instance-status') as HTMLElement;

// Buffering indicator
const bufferingIndicator = document.getElementById('buffering-indicator') as HTMLElement;
const bufferInfo = document.getElementById('buffer-info') as HTMLElement;

const mediaSessionInfo = document.getElementById('media-session-info') as HTMLElement;
const mediaSessionActiveBadge = document.getElementById('media-session-active-badge') as HTMLElement;

let isDestroyed = false;

const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) {
        return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Render playlist
const renderPlaylist = () => {
    if (!playlistEl || !playlist) {
        return;
    }

    const currentIndex = playlist.state.currentIndex;

    playlistEl.innerHTML = playlist.state.queue.map((track, index) => {
        const trackTitle = track.title ?? 'Unknown Track';
        const trackArtist = track.artist ?? 'Unknown Artist';
        return `
        <div class="track-item ${index === currentIndex ? 'active' : ''}" data-index="${index}">
            <div class="track-number">${index === currentIndex ? '▶️' : (index + 1)}</div>
            <div class="track-info">
                <div class="track-title">${trackTitle}</div>
                <div class="track-artist">${trackArtist}</div>
            </div>
        </div>
    `;
    }).join('');

    playlistEl.querySelectorAll('.track-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index') ?? '0');
            playlist.playTrack(index);
        });
    });
};

// Update now playing
const updateNowPlaying = () => {
    if (!playlist) {
        return;
    }

    const current = playlist.currentTrack;

    if (currentTitle && currentArtist && currentCover) {
        if (current) {
            currentTitle.textContent = current.title ?? 'Unknown Track';
            currentArtist.textContent = current.artist ?? 'Unknown Artist';
            
            // Update cover art
            if (current.coverArt) {
                currentCover.innerHTML = `<img src="${current.coverArt}" alt="Cover">`;
            } else {
                currentCover.innerHTML = '🎵';
            }
        } else {
            currentTitle.textContent = 'No track playing';
            currentArtist.textContent = 'Select a track to start';
            currentCover.innerHTML = '🎵';
        }
    }
};

// Update playlist control buttons
const updatePlaylistControls = () => {
    if (!playlist) return;

    if (shuffleBtn) {
        shuffleBtn.classList.toggle('active', playlist.state.shuffleEnabled);
        shuffleBtn.textContent = playlist.state.shuffleEnabled ? '🔀 Shuffle ON' : '🔀 Shuffle';
    }

    if (repeatBtn) {
        const repeatText: Record<string, string> = {
            'none': '🔁 Repeat',
            'all': '🔁 All',
            'one': '🔂 One'
        };
        repeatBtn.textContent = repeatText[playlist.state.repeatMode];
        repeatBtn.classList.toggle('active', playlist.state.repeatMode !== 'none');
    }
};

const updateUI = () => {
    if (isDestroyed) {
        return;
    }

    const state = player.state;

    timeCurrent.innerText = formatTime(state.currentTime);
    timeDuration.innerText = formatTime(state.duration);

    if (state.duration > 0) {
        const progress = (state.currentTime / state.duration) * 100;
        progressFill.style.width = `${progress}%`;
    } else {
        progressFill.style.width = '0%';
    }

    // Playback button states
    playBtn.style.opacity = state.isPlaying ? '0.5' : '1';
    pauseBtn.style.opacity = state.isPlaying ? '1' : '0.5';
    stopBtn.style.opacity = state.isPlaying || state.currentTime > 0 ? '1' : '0.5';

    muteBtn.disabled = state.muted;
    unmuteBtn.disabled = !state.muted;

    // Leader badge
    if (state.isLeader) {
        roleBadge.innerText = "Leader (Broadcasting)";
        roleBadge.className = "status-badge status-leader";
        roleBadge.style.background = "#e91e63";
        becomeLeaderBtn.disabled = true;
        becomeLeaderBtn.textContent = "You are Leader";
    } else {
        roleBadge.innerText = "Follower (Syncing)";
        roleBadge.className = "status-badge status-follower";
        roleBadge.style.background = "#2196f3";
        becomeLeaderBtn.disabled = false;
        becomeLeaderBtn.textContent = "Become Leader";
    }

    // Update now playing and playlist
    updateNowPlaying();
    updatePlaylistControls();
    
    // Update playback rate display
    if (playbackRateDisplay) {
        playbackRateDisplay.textContent = `${state.playbackRate.toFixed(2)}x`;
    }
    
    // Update speed buttons active state
    speedButtons.forEach(btn => {
        const rate = parseFloat(btn.getAttribute('data-rate') || '1');
        if (Math.abs(rate - state.playbackRate) < 0.01) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update Media Session active badge
    if (player.mediaSession?.isActive() && state.isLeader) {
        mediaSessionActiveBadge.style.display = 'inline-block';
    } else {
        mediaSessionActiveBadge.style.display = 'none';
    }
};

player.subscribe(updateUI);

// Initialize UI
renderPlaylist();
updatePlaylistControls();
updateNowPlaying();
updateUI();

if (player.mediaSession?.isSupported()) {
    mediaSessionInfo.innerHTML = `
        ✅ <strong>Supported!</strong> Media Session API activated.<br>
    `;
} else {
    mediaSessionInfo.innerHTML = `
        ⚠️ <strong>Not supported</strong> in this browser<br>
        <span style="color: #888;">Playback works normally, but no OS-level controls.</span>
    `;
}

// --- Controls ---

becomeLeaderBtn.addEventListener('click', () => {
    player.becomeLeader();
});

playBtn.addEventListener('click', () => {
    const state = player.state;

    if (!state.currentSrc && playlist) {
        playlist.playTrack(0);
    } else if (state.currentSrc) {
        player.play();
    } else {
        player.play();
    }
});

pauseBtn.addEventListener('click', () => {
    player.pause();
});

stopBtn.addEventListener('click', () => {
    player.stop();
});

progressBar.addEventListener('click', (e) => {
    const state = player.state;
    if (state.duration <= 0) {
        return;
    }

    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const seekTime = clickPosition * state.duration;

    player.seek(seekTime);
});

// Playlist control buttons
prevBtn.addEventListener('click', () => {
    playlist?.prev();
});

nextBtn.addEventListener('click', () => {
    playlist?.next();
});

shuffleBtn.addEventListener('click', () => {
    playlist?.toggleShuffle();
    updatePlaylistControls();
});

repeatBtn.addEventListener('click', () => {
    playlist?.toggleRepeat();
    updatePlaylistControls();
});

// --- Volume Controls ---

volumeSlider.addEventListener('input', () => {
    const value = parseInt(volumeSlider.value, 10) / 100;
    player.setVolume(value);
    volumeValue.innerText = `${volumeSlider.value}%`;
});

muteBtn.addEventListener('click', () => {
    player.mute();
});

unmuteBtn.addEventListener('click', () => {
    player.unmute();
});

// --- Seek Input ---

seekBtn.addEventListener('click', () => {
    const time = parseFloat(seekInput.value);
    if (!isNaN(time) && time >= 0) {
        player.seek(time);
        seekInput.value = '';
    }
});

seekInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        seekBtn.click();
    }
});

// --- Playback Rate Controls ---

// Speed preset buttons
speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const rate = parseFloat(btn.getAttribute('data-rate') || '1');
        player.setPlaybackRate(rate);
    });
});

// Increase/decrease speed buttons
speedIncreaseBtn.addEventListener('click', () => {
    const currentRate = player.getPlaybackRate();
    const newRate = Math.min(4, currentRate + 0.25);
    player.setPlaybackRate(newRate);
});

speedDecreaseBtn.addEventListener('click', () => {
    const currentRate = player.getPlaybackRate();
    const newRate = Math.max(0.25, currentRate - 0.25);
    player.setPlaybackRate(newRate);
});

// Listen to playback rate changes
player.on('playbackRateChange', ({ playbackRate, previousRate }) => {
    console.log(`[Playback Rate] Changed: ${previousRate}x → ${playbackRate}x`);
    updateUI();
});

// --- Destroy Instance ---

destroyBtn.addEventListener('click', () => {
    if (isDestroyed) {
        console.log('[Playground] Instance already destroyed');
        return;
    }

    player.destroy();
    isDestroyed = true;

    instanceStatus.innerText = 'Instance destroyed';
    instanceStatus.style.color = '#ff5252';
    destroyBtn.disabled = true;
    destroyBtn.style.opacity = '0.5';

    [playBtn, pauseBtn, stopBtn, muteBtn, unmuteBtn, seekBtn, becomeLeaderBtn, 
     prevBtn, nextBtn, shuffleBtn, repeatBtn, speedDecreaseBtn, speedIncreaseBtn].forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    });
    speedButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    });
    volumeSlider.disabled = true;
    seekInput.disabled = true;

    console.log('[Playground] Instance destroyed');
});

// Leadership change events
player.on('leaderChange', ({ isLeader }: { isLeader: boolean }) => {
    console.log('[Playground] Leadership changed:', isLeader);
    updateUI();
});

// Playlist event listeners
if (playlist) {
    (playlist as any).on('trackChanged', (data: any) => {
        console.log('[Playlist] Track changed:', data?.current?.title);
        updateNowPlaying();
        renderPlaylist();
    });

    (playlist as any).on('queueUpdated', () => {
        console.log('[Playlist] Queue updated');
        renderPlaylist();
    });

    (playlist as any).on('playlistEnded', () => {
        console.log('[Playlist] Playlist ended');
    });

    (playlist as any).on('shuffleChanged', (data: any) => {
        console.log('[Playlist] Shuffle:', data?.enabled);
        updatePlaylistControls();
        renderPlaylist();
    });

    (playlist as any).on('repeatModeChanged', (data: any) => {
        console.log('[Playlist] Repeat mode:', data?.mode);
        updatePlaylistControls();
    });
}

// Expose to window for debugging
(window as any).player = player;
(window as any).playlist = playlist;

console.log(`[Playground] Instance initialized: ${player.instanceId}`);
console.log('[Playground] Available commands: playlist.next(), playlist.prev(), playlist.toggleShuffle()');
console.log('[Playground] Media Session commands: player.mediaSession');

// ═══════════════════════════════════════════════════════════════
// 🎵 Media Session Event Logging
// ═══════════════════════════════════════════════════════════════

player.on('play', () => {
    console.log('🎵 [Media Session] ▶️ Playback started');
    if (player.isLeader) {
        // Show visual notification
        if (mediaSessionActiveBadge) {
            mediaSessionActiveBadge.style.display = 'inline-block';
            mediaSessionActiveBadge.style.animation = 'pulse 1s ease-in-out 3';
        }
    }
});

player.on('pause', () => {
    console.log('🎵 [Media Session] ⏸️ Playback paused');
    if (player.isLeader) {
        console.log('   → Lock screen updated with pause state');
    }
});

player.on('playlistTrackChanged', ({ current }) => {
    console.log('🎵 [Media Session] 🎵 Track changed:', current?.title);
    if (player.isLeader) {
        console.log('   → Metadata updated:');
        console.log('      • Title:', current?.title);
        console.log('      • Artist:', current?.artist);
        console.log('      • Album:', current?.album);
        console.log('      • Cover:', current?.coverArt ? '✅' : '❌');
        console.log('   💡 Check lock screen to see the new track info!');
    }
});

player.on('leaderChange', ({ isLeader }) => {
    if (isLeader) {
        console.log('🎵 [Media Session] This tab now controls Media Session');
        console.log('   → Lock screen controls are active');
        console.log('   → Hardware buttons will work');
    } else {
        console.log('🎵 [Media Session] Another tab controls Media Session');
        console.log('   → This tab released Media Session control');
    }
});