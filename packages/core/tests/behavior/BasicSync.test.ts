import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioInstance } from '../../src/model/AudioInstance';
import { AudioReadyState } from '../../src/model/types/driver.types';

class MockBroadcastChannel {
    public onmessage: ((ev: MessageEvent) => void) | null = null;
    public name: string;
    static instances: MockBroadcastChannel[] = [];

    constructor(name: string) {
        this.name = name;
        MockBroadcastChannel.instances.push(this);
    }

    postMessage(data: any) {
        setTimeout(() => {
            MockBroadcastChannel.instances.forEach(instance => {
                if (instance.name === this.name && instance !== this && instance.onmessage) {
                    instance.onmessage({ data } as MessageEvent);
                }
            });
        }, 0);
    }

    close() {
        const idx = MockBroadcastChannel.instances.indexOf(this);
        if (idx > -1) MockBroadcastChannel.instances.splice(idx, 1);
    }
}

class MockAudio {
    public src: string = '';
    public currentTime: number = 0;
    public duration: number = 100;
    public volume: number = 1;
    public muted: boolean = false;
    public readyState: number = AudioReadyState.HAVE_ENOUGH_DATA;
    public ontimeupdate: any = null;
    public onplaying: any = null;
    public onpause: any = null;

    play = vi.fn(async () => {
        // Simulate async behavior - onplaying fires after play resolves
        await Promise.resolve();
        if (this.onplaying) this.onplaying();
        return Promise.resolve();
    });

    pause = vi.fn(() => {
        if (this.onpause) this.onpause();
    });
}

// @ts-ignore
global.BroadcastChannel = MockBroadcastChannel;
// @ts-ignore
global.Audio = MockAudio;

describe('Behavior: Synchronization Scenarios', () => {
    beforeEach(() => {
        MockBroadcastChannel.instances = [];
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('Scenario: New tab should sync with existing leader', async () => {
        // Создаем первую вкладку и запускаем музыку
        const tab1 = new AudioInstance('sync_test');
        tab1.play('song.mp3');
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        // Таб 1 должен стать лидером
        expect(tab1.state.isLeader).toBe(true);
        expect(tab1.state.isPlaying).toBe(true);

        // Имитируем прогресс времени
        // @ts-ignore (доступ к приватному аудио через драйвер для теста, анти-паттерн)
        tab1.driver.audio.currentTime = 50;
        // @ts-ignore
        tab1.driver.audio.ontimeupdate();

        // Открываем вторую вкладку
        const tab2 = new AudioInstance('sync_test');

        // Ждем SYNC_REQUEST -> STATE_UPDATE
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        // Таб 2 должен подхватить состояние Таба 1
        expect(tab2.state.currentSrc).toBe('song.mp3');
        expect(tab2.state.isPlaying).toBe(true);
        expect(tab2.state.currentTime).toBeCloseTo(50, 1);
        expect(tab2.state.isLeader).toBe(false);
    });

    it('Scenario: Leadership transfer on user interaction', async () => {
        const tab1 = new AudioInstance('leadership_test');
        const tab2 = new AudioInstance('leadership_test');
        await vi.advanceTimersByTimeAsync(100);

        // @ts-ignore
        const tab1Audio = tab1.driver.audio;

        // Таб 1 начинает играть
        tab1.play('track.mp3');
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);
        
        expect(tab1.state.isLeader).toBe(true);
        expect(tab2.state.isLeader).toBe(false);

        tab1Audio.pause.mockClear();

        // Пользователь нажимает паузу на Табе 2
        tab2.pause();
        await vi.advanceTimersByTimeAsync(100);

        // Лидерство должно перейти к Табу 2
        expect(tab2.state.isLeader).toBe(true);
        expect(tab2.state.isPlaying).toBe(false);
        expect(tab1.state.isLeader).toBe(false);
        expect(tab1.state.isPlaying).toBe(false);
        
        // В singlePlayback режиме tab1 должен остановить реальное аудио
        expect(tab1Audio.pause).toHaveBeenCalled();
    });

    it('Scenario: Seek synchronization across tabs', async () => {
        // Создаем первую вкладку и начинаем играть
        const tab1 = new AudioInstance('seek_test');
        tab1.play('song.mp3');
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        // Таб 1 должен стать лидером
        expect(tab1.state.isLeader).toBe(true);
        expect(tab1.state.isPlaying).toBe(true);

        // Открываем вторую вкладку - она должна синхронизироваться
        const tab2 = new AudioInstance('seek_test');
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab2.state.isPlaying).toBe(true);
        expect(tab2.state.isLeader).toBe(false);

        tab1.seek(120);

        // Даем время на доставку сообщения
        await vi.advanceTimersByTimeAsync(100);

        // Используем toBeCloseTo, так как из-за latencyCompensator время может быть например 120.001
        expect(tab1.state.currentTime).toBe(120);
        expect(tab2.state.currentTime).toBeCloseTo(120, 1);
    });

    it('Scenario: Single Playback mode - leader transfer and silence', async () => {
        const config = { singlePlayback: true };
        const tab1 = new AudioInstance('single_test', config);
        const tab2 = new AudioInstance('single_test', config);
        await vi.advanceTimersByTimeAsync(100);

        const tab1Audio = tab1.driver.audio;

        tab1.play('song.mp3');
        await vi.advanceTimersByTimeAsync(300);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab1.state.isLeader).toBe(true);
        expect(tab1.state.isPlaying).toBe(true);

        tab1Audio.pause.mockClear();

        // Таб 2 перехватывает управление
        tab2.play();
        await vi.advanceTimersByTimeAsync(300);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab2.state.isLeader).toBe(true);
        expect(tab2.state.isPlaying).toBe(true);

        expect(tab1.state.isLeader).toBe(false);
        expect(tab1Audio.pause).toHaveBeenCalled();
    });

    it('Scenario: Multi-playback mode - all tabs play together', async () => {
        const config = { singlePlayback: false };
        const tab1 = new AudioInstance('multi_test', config);
        const tab2 = new AudioInstance('multi_test', config);
        await vi.advanceTimersByTimeAsync(100);

        // @ts-ignore
        const tab1Audio = tab1.driver.audio;
        // @ts-ignore
        const tab2Audio = tab2.driver.audio;

        tab1.play('song.mp3');
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab1.state.isLeader).toBe(true);
        expect(tab1.state.isPlaying).toBe(true);
        expect(tab1Audio.play).toHaveBeenCalled();

        expect(tab2.state.isPlaying).toBe(true);
        expect(tab2Audio.play).toHaveBeenCalled();

        tab1Audio.pause.mockClear();
        tab2Audio.pause.mockClear();

        tab2.pause();
        await vi.advanceTimersByTimeAsync(100);

        expect(tab1.state.isPlaying).toBe(false);
        expect(tab2.state.isPlaying).toBe(false);
        expect(tab1Audio.pause).toHaveBeenCalled();
        expect(tab2Audio.pause).toHaveBeenCalled();
    });

    it('Scenario: Track change synchronization', async () => {
        const config = { syncTrackChange: true, singlePlayback: false };
        const tab1 = new AudioInstance('track_test', config);
        const tab2 = new AudioInstance('track_test', config);
        await vi.advanceTimersByTimeAsync(100);

        tab1.play('track1.mp3');
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab1.state.currentSrc).toBe('track1.mp3');
        expect(tab2.state.currentSrc).toBe('track1.mp3');

        tab1.play('track2.mp3');
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab1.state.currentSrc).toBe('track2.mp3');
        expect(tab2.state.currentSrc).toBe('track2.mp3');
    });

    it('Scenario: Disabled play synchronization', async () => {
        const config = { syncPlay: false, singlePlayback: false };
        const tab1 = new AudioInstance('nosync_test', config);
        const tab2 = new AudioInstance('nosync_test', config);
        await vi.advanceTimersByTimeAsync(100);

        tab1.play('song.mp3');
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab1.state.isPlaying).toBe(true);
        expect(tab2.state.isPlaying).toBe(false);
        expect(tab2.state.currentSrc).toBeNull();
    });

    it('Scenario: Three tabs with leadership transfer', async () => {
        const tab1 = new AudioInstance('three_tabs');
        const tab2 = new AudioInstance('three_tabs');
        const tab3 = new AudioInstance('three_tabs');
        await vi.advanceTimersByTimeAsync(100);

        // @ts-ignore
        const tab1Audio = tab1.driver.audio;
        // @ts-ignore
        const tab2Audio = tab2.driver.audio;
        // @ts-ignore
        const tab3Audio = tab3.driver.audio;

        // Tab1 становится лидером
        tab1.play('song.mp3');
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab1.state.isLeader).toBe(true);
        expect(tab2.state.isLeader).toBe(false);
        expect(tab3.state.isLeader).toBe(false);

        tab1Audio.pause.mockClear();

        // Tab2 перехватывает лидерство
        tab2.play();
        await vi.advanceTimersByTimeAsync(300);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab1.state.isLeader).toBe(false);
        expect(tab2.state.isLeader).toBe(true);
        expect(tab3.state.isLeader).toBe(false);
        expect(tab1Audio.pause).toHaveBeenCalled();

        tab2Audio.pause.mockClear();

        // Tab3 перехватывает лидерство
        tab3.play();
        await vi.advanceTimersByTimeAsync(300);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab1.state.isLeader).toBe(false);
        expect(tab2.state.isLeader).toBe(false);
        expect(tab3.state.isLeader).toBe(true);
        expect(tab2Audio.pause).toHaveBeenCalled();
    });

    it('Scenario: Disabled seek synchronization', async () => {
        const config = { syncSeek: false, singlePlayback: false };
        const tab1 = new AudioInstance('noseek_test', config);
        const tab2 = new AudioInstance('noseek_test', config);
        await vi.advanceTimersByTimeAsync(100);

        tab1.play('song.mp3');
        await vi.advanceTimersByTimeAsync(100);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        // Устанавливаем разное время на вкладках
        // @ts-ignore
        tab1.driver.audio.currentTime = 10;
        // @ts-ignore
        tab1.driver.audio.ontimeupdate();
        // @ts-ignore
        tab2.driver.audio.currentTime = 50;
        // @ts-ignore
        tab2.driver.audio.ontimeupdate();

        await vi.advanceTimersByTimeAsync(50);

        const tab2TimeBefore = tab2.state.currentTime;

        tab1.seek(120);
        await vi.advanceTimersByTimeAsync(100);

        // Tab1 должен переместиться
        expect(tab1.state.currentTime).toBe(120);
        // Tab2 НЕ должен синхронизироваться
        expect(tab2.state.currentTime).toBe(tab2TimeBefore);
    });

    it('Scenario: Follower in singlePlayback does not produce sound', async () => {
        const config = { singlePlayback: true };
        const tab1 = new AudioInstance('follower_test', config);
        const tab2 = new AudioInstance('follower_test', config);
        await vi.advanceTimersByTimeAsync(100);

        // @ts-ignore
        const tab2Audio = tab2.driver.audio;

        // Tab1 - leader
        tab1.play('song.mp3');
        await vi.advanceTimersByTimeAsync(300);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        expect(tab1.state.isLeader).toBe(true);
        expect(tab2.state.isLeader).toBe(false);

        expect(tab2.state.isPlaying).toBe(false);
        
        // В singlePlayback режиме follower НЕ должен вызывать audio.play()
        const tab2PlayCalls = tab2Audio.play.mock.calls.length;
        expect(tab2PlayCalls).toBe(0);
    });
});
