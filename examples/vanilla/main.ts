import { AudioDriver } from "../../packages/core/src";

const player = new AudioDriver();

const playBtn = document.getElementById('play') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
const timeDisplay = document.getElementById('time') as HTMLElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const trackName = document.getElementById('track-name') as HTMLElement;
const playlist = document.getElementById('playlist') as HTMLElement;
const roleBadge = document.getElementById('role-badge') as HTMLElement;

const updateUI = () => {
    const state = player.state;

    timeDisplay.innerText = state.currentTime.toFixed(2);

    if (state.duration > 0) {
        const progress = (state.currentTime / state.duration) * 100;
        progressFill.style.width = `${progress}%`;
    }

    playBtn.style.opacity = state.isPlaying ? '0.5' : '1';
    pauseBtn.style.opacity = state.isPlaying ? '1' : '0.5';

    if (state.error) {
        console.error(`[Player Error] ${state.error.code}: ${state.error.message}`);
        trackName.innerText = `Ошибка: ${state.error.code}`;
        trackName.style.color = '#ff5252';
    } else {
        trackName.style.color = '#b3b3b3';
    }
};

player.on('state_change', () => {
    updateUI();
});

playBtn.addEventListener('click', () => {
    if (!player.state.currentSrc) {
        const firstTrack = playlist.querySelector('.track-item') as HTMLElement;
        if (firstTrack) firstTrack.click();
    } else {
        player.play();
    }
});

pauseBtn.addEventListener('click', () => {
    player.pause();
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

roleBadge.innerText = "Local Mode";
roleBadge.className = "status-badge status-leader";

console.log('Audio Sync Playground initialized');