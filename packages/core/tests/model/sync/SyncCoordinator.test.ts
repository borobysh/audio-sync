import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncCoordinator } from '../../../src/model/sync/SyncCoordinator';
import { AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG } from '../../../src/config/sync.config';

class MockBroadcastChannel {
    public onmessage: ((ev: MessageEvent) => void) | null = null;
    public name: string;
    public postMessage = vi.fn();
    public close = vi.fn();

    constructor(name: string) {
        this.name = name;
        MockBroadcastChannel.instances.push(this);
    }

    static instances: MockBroadcastChannel[] = [];
    
    static reset() {
        MockBroadcastChannel.instances = [];
    }

    static simulateMessage(instanceId: string, data: any) {
        MockBroadcastChannel.instances.forEach(instance => {
            if (instance.onmessage) {
                instance.onmessage({ data } as MessageEvent);
            }
        });
    }
}

// @ts-ignore
global.BroadcastChannel = MockBroadcastChannel;

describe('SyncCoordinator', () => {
    const instanceId = 'test-id';
    const channelName = 'test-channel';
    const config = { ...AUDIO_INSTANCE_DEFAULT_SYNC_CONFIG, leadershipHandshakeTimeout: 100 };
    
    let coordinator: SyncCoordinator;
    let events: any;

    beforeEach(() => {
        MockBroadcastChannel.reset();
        events = {
            onRemoteEvent: vi.fn(),
            onLeadershipChange: vi.fn(),
            onSyncRequest: vi.fn(),
        };
        coordinator = new SyncCoordinator(instanceId, channelName, config, events);
    });

    afterEach(() => {
        coordinator.close();
    });

    it('should initialize with correct leader state', () => {
        expect(coordinator.isLeader).toBe(false);
    });

    it('should broadcast messages correctly', () => {
        const payload = { test: true };
        coordinator.broadcast('PLAY', payload);
        
        const channel = MockBroadcastChannel.instances[0];
        expect(channel.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'PLAY',
            payload,
            instanceId
        }));
    });

    it('should set leader and emit event', () => {
        coordinator.setLeader(true);
        expect(coordinator.isLeader).toBe(true);
        expect(events.onLeadershipChange).toHaveBeenCalledWith(true);
    });

    describe('leadership handshake', () => {
        it('should claim leadership and execute after timeout', async () => {
            vi.useFakeTimers();
            const onExecute = vi.fn();
            
            coordinator.claimLeadership({ action: 'play' }, onExecute);
            
            expect(MockBroadcastChannel.instances[0].postMessage).toHaveBeenCalledWith(expect.objectContaining({
                type: 'LEADERSHIP_CLAIM'
            }));
            
            vi.advanceTimersByTime(config.leadershipHandshakeTimeout);
            
            expect(coordinator.isLeader).toBe(true);
            expect(onExecute).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('should cancel leadership claim if remote claim received', () => {
            vi.useFakeTimers();
            const onExecute = vi.fn();
            coordinator.claimLeadership({ action: 'play' }, onExecute);
            
            MockBroadcastChannel.simulateMessage('other-id', {
                type: 'LEADERSHIP_CLAIM',
                instanceId: 'other-id',
                payload: { isLeader: true }
            });
            
            vi.advanceTimersByTime(config.leadershipHandshakeTimeout);
            
            expect(coordinator.isLeader).toBe(false);
            expect(onExecute).not.toHaveBeenCalled();
            vi.useRealTimers();
        });
    });

    describe('remote events', () => {
        it('should ignore its own messages', () => {
            MockBroadcastChannel.simulateMessage(instanceId, {
                type: 'PLAY',
                instanceId: instanceId,
                payload: {}
            });
            expect(events.onRemoteEvent).not.toHaveBeenCalled();
        });

        it('should handle remote PLAY event', () => {
            const payload = { isPlaying: true };
            const timestamp = Date.now();
            
            MockBroadcastChannel.simulateMessage('other-id', {
                type: 'PLAY',
                instanceId: 'other-id',
                payload,
                timestamp
            });
            
            expect(events.onRemoteEvent).toHaveBeenCalledWith('PLAY', payload, timestamp);
        });

        it('should give up leadership if remote leader appears', () => {
            coordinator.setLeader(true);
            
            MockBroadcastChannel.simulateMessage('other-id', {
                type: 'STATE_UPDATE',
                instanceId: 'other-id',
                payload: { isLeader: true }
            });
            
            expect(coordinator.isLeader).toBe(false);
        });

        it('should call onSyncRequest when remote SYNC_REQUEST received', () => {
            MockBroadcastChannel.simulateMessage('other-id', {
                type: 'SYNC_REQUEST',
                instanceId: 'other-id',
                payload: {}
            });
            expect(events.onSyncRequest).toHaveBeenCalled();
        });
    });
});
