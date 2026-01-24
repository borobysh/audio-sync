import { AudioInstance } from "../../packages/core/src/model/AudioInstance";


const player = new AudioInstance('my_playground_app', {
    syncSeek: false,
    syncTrackChange: false,
});

// --- DOM Elements ---
const playBtn = document.getElementById('play') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const progressBar = document.getElementById('progress-bar') as HTMLElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const timeCurrent = document.getElementById('time-current') as HTMLElement;
const timeDuration = document.getElementById('time-duration') as HTMLElement;
const trackName = document.getElementById('track-name') as HTMLElement;
const playlist = document.getElementById('playlist') as HTMLElement;
const roleBadge = document.getElementById('role-badge') as HTMLElement;

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

let isDestroyed = false;

const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) {
        return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

    // Error state
    if (state.error) {
        trackName.innerText = `Error: ${state.error.code}`;
        trackName.style.color = '#ff5252';
    } else {
        trackName.style.color = '#b3b3b3';
    }
};

player.subscribe(updateUI);

updateUI();

// --- Controls ---

playBtn.addEventListener('click', () => {
    const state = player.state;
    if (!state.currentSrc) {
        const firstTrack = playlist.querySelector('.track-item') as HTMLElement;
        if (firstTrack) {
            firstTrack.click();
        }
    } else {
        player.play();
    }
});

pauseBtn.addEventListener('click', () => {
    player.pause();
});

stopBtn.addEventListener('click', () => {
    player.stop();
    trackName.innerText = 'Select track';
    playlist.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
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

playlist.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const trackItem = target.closest('.track-item') as HTMLElement;

    if (trackItem) {
        const src = trackItem.getAttribute('data-src');
        const name = trackItem.innerText;

        if (src) {
            playlist.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
            trackItem.classList.add('active');
            trackName.innerText = name;

            player.play(src);
        }
    }
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

console.log(`[Playground] Instance initialized: ${player.instanceId}`);