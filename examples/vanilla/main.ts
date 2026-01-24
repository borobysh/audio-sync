import { AudioInstance, Track } from "../../packages/core/src/index";

// Sample tracks
const tracks: Track[] = [
    { id: '1', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', title: 'Sound Helix Song 1', artist: 'T. Schürger' },
    { id: '2', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', title: 'Sound Helix Song 2', artist: 'T. Schürger' },
    { id: '3', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', title: 'Sound Helix Song 3', artist: 'T. Schürger' },
    { id: '4', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', title: 'Sound Helix Song 4', artist: 'T. Schürger' },
    { id: '5', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', title: 'Sound Helix Song 5', artist: 'T. Schürger' },
];

// Create player with playlist support
const player = new AudioInstance('audio_sync_unified', {
    syncSeek: false,
    syncTrackChange: false,
    singlePlayback: true,
    playlist: {
        autoAdvance: true,
        defaultRepeatMode: 'all',
        syncPlaylist: true
    }
});

// Initialize playlist
const playlist = player.playlist;

if (!playlist) {
    throw new Error('Playlist not available');
}

// Add tracks to playlist
playlist.addMany(tracks);

// --- DOM Elements ---
const playBtn = document.getElementById('play') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const progressBar = document.getElementById('progress-bar') as HTMLElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const timeCurrent = document.getElementById('time-current') as HTMLElement;
const timeDuration = document.getElementById('time-duration') as HTMLElement;
const playlistEl = document.getElementById('playlist') as HTMLElement;
const roleBadge = document.getElementById('role-badge') as HTMLElement;

// Now playing elements
const currentTitle = document.getElementById('current-title') as HTMLElement;
const currentArtist = document.getElementById('current-artist') as HTMLElement;

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

// Instance controls
const destroyBtn = document.getElementById('destroy') as HTMLButtonElement;
const instanceStatus = document.getElementById('instance-status') as HTMLElement;

// Buffering indicator
const bufferingIndicator = document.getElementById('buffering-indicator') as HTMLElement;
const bufferInfo = document.getElementById('buffer-info') as HTMLElement;

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
    if (!playlistEl || !playlist) return;

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

    // Add click handlers
    playlistEl.querySelectorAll('.track-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index') ?? '0');
            playlist.playTrack(index);
        });
    });
};

// Update now playing
const updateNowPlaying = () => {
    if (!playlist) return;
    
    const current = playlist.currentTrack;
    
    if (currentTitle && currentArtist) {
        if (current) {
            currentTitle.textContent = current.title ?? 'Unknown Track';
            currentArtist.textContent = current.artist ?? 'Unknown Artist';
        } else {
            currentTitle.textContent = 'No track playing';
            currentArtist.textContent = 'Select a track to start';
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
    } else {
        roleBadge.innerText = "Follower (Syncing)";
        roleBadge.className = "status-badge status-follower";
        roleBadge.style.background = "#2196f3";
    }

    // Update now playing and playlist
    updateNowPlaying();
    updatePlaylistControls();
};

player.subscribe(updateUI);

// Initialize UI
renderPlaylist();
updatePlaylistControls();
updateNowPlaying();
updateUI();

// --- Controls ---

playBtn.addEventListener('click', () => {
    const state = player.state;
    if (!state.currentSrc && playlist) {
        playlist.playTrack(0);
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
    
    [playBtn, pauseBtn, stopBtn, muteBtn, unmuteBtn, seekBtn].forEach(btn => {
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