import { AudioEvent, LeadershipAction, SyncConfig, SyncCoreState } from "../types/syncCore.types";

/**
 * Pending action to execute after leadership handshake
 */
export type PendingAction = {
    action: LeadershipAction;
    src?: string;
    seekTime?: number;
};

export interface SyncCoordinatorEvents {
    onRemoteEvent: (type: AudioEvent['type'], payload: Partial<SyncCoreState>, timestamp: number) => void;
    onLeadershipChange: (isLeader: boolean) => void;
    onSyncRequest: () => void;
}

/**
 * SyncCoordinator - Handles BroadcastChannel communication and leadership handshake.
 */
export class SyncCoordinator {
    private readonly _channel: BroadcastChannel;
    private readonly _instanceId: string;
    private readonly _config: Required<SyncConfig>;
    private readonly _events: SyncCoordinatorEvents;

    private _isLeader: boolean = false;
    private _isClaimingLeadership: boolean = false;
    private _pendingAction: PendingAction | null = null;
    private _handshakeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _isProcessingRemoteEvent: boolean = false;
    private _lastLeaderMessageTimestamp: number = 0;
    private _leaderCheckCallback: ((hasLeader: boolean) => void) | null = null;
    private _leaderCheckTimeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(
        instanceId: string,
        channelName: string,
        config: Required<SyncConfig>,
        events: SyncCoordinatorEvents
    ) {
        this._instanceId = instanceId;
        this._channel = new BroadcastChannel(channelName);
        this._config = config;
        this._events = events;

        this._initBroadcastListeners();
    }

    public get isLeader(): boolean {
        return this._isLeader;
    }

    public setLeader(value: boolean) {
        if (this._isLeader !== value) {
            this._isLeader = value;
            this._events.onLeadershipChange(value);
        }
    }

    public get isProcessingRemoteEvent(): boolean {
        return this._isProcessingRemoteEvent;
    }

    /**
     * Check if there's an active leader by sending a ping and waiting for response
     */
    public checkForActiveLeader(callback: (hasLeader: boolean) => void, timeout: number = 200) {
        if (this._isLeader) {
            // We are the leader
            callback(true);
            return;
        }

        // Check if we received a message from leader recently (within last 3 seconds)
        const timeSinceLastLeaderMessage = Date.now() - this._lastLeaderMessageTimestamp;
        if (timeSinceLastLeaderMessage < 3000) {
            // Leader is active
            callback(true);
            return;
        }

        // Send SYNC_REQUEST and wait for response
        this._leaderCheckCallback = callback;
        this.broadcast('SYNC_REQUEST', {});

        this._leaderCheckTimeoutId = setTimeout(() => {
            if (this._leaderCheckCallback) {
                this._leaderCheckCallback(false);  // No leader found
                this._leaderCheckCallback = null;
            }
        }, timeout);
    }

    /**
     * Sends a message to the broadcast channel.
     */
    public broadcast(type: AudioEvent['type'], payload: any) {
        const event: AudioEvent = {
            type,
            payload,
            timestamp: Date.now(),
            instanceId: this._instanceId
        };
        this._channel.postMessage(event);
    }

    /**
     * Initiates the leadership handshake.
     */
    public claimLeadership(action: PendingAction, onExecute: (action: PendingAction) => void) {
        // If we're already the leader and not in singlePlayback mode, execute immediately
        if (this._isLeader && !this._config.singlePlayback) {
            onExecute(action);
            return;
        }

        // If we're already claiming leadership, queue the new action
        if (this._isClaimingLeadership) {
            this._pendingAction = action;
            return;
        }

        // If we're already the leader in singlePlayback mode, execute immediately
        if (this._isLeader) {
            onExecute(action);
            return;
        }

        this._isClaimingLeadership = true;
        this._pendingAction = action;

        // Send LEADERSHIP_CLAIM to all other tabs
        this.broadcast('LEADERSHIP_CLAIM', {
            action: action.action,
            src: action.src,
            seekTime: action.seekTime,
            isLeader: true
        });

        // Set timeout - after this we become leader regardless of ACKs
        this._handshakeTimeoutId = setTimeout(() => {
            this._completeLeadershipHandshake(onExecute);
        }, this._config.leadershipHandshakeTimeout);
    }

    private _completeLeadershipHandshake(onExecute: (action: PendingAction) => void) {
        if (!this._isClaimingLeadership) {
            return;
        }

        if (this._handshakeTimeoutId) {
            clearTimeout(this._handshakeTimeoutId);
            this._handshakeTimeoutId = null;
        }

        this.setLeader(true);
        this._isClaimingLeadership = false;

        if (this._pendingAction) {
            const action = this._pendingAction;
            this._pendingAction = null;
            onExecute(action);
        }
    }

    private _initBroadcastListeners() {
        this._channel.onmessage = (event: MessageEvent<AudioEvent>) => {
            const { type, payload, timestamp, instanceId } = event.data;

            if (instanceId === this._instanceId) {
                return;
            }

            this._isProcessingRemoteEvent = true;

            try {
                if (type === 'LEADERSHIP_CLAIM') {
                    this._handleLeadershipClaim(instanceId || '');
                    return;
                }

                if (type === 'LEADERSHIP_ACK') {
                    // ACK handling could be more advanced, currently just waiting for timeout
                    return;
                }

                if (type === 'SYNC_REQUEST') {
                    this._events.onSyncRequest();
                    return;
                }

                // Track when we last heard from a leader
                if (payload.isLeader && ['PLAY', 'PAUSE', 'STATE_UPDATE'].includes(type)) {
                    this._lastLeaderMessageTimestamp = Date.now();
                    
                    // If we were checking for a leader, notify callback
                    if (this._leaderCheckCallback) {
                        if (this._leaderCheckTimeoutId) {
                            clearTimeout(this._leaderCheckTimeoutId);
                            this._leaderCheckTimeoutId = null;
                        }
                        this._leaderCheckCallback(true);  // Leader found
                        this._leaderCheckCallback = null;
                    }
                }

                // If someone else becomes the leader (but NOT a remote command), we remove the crown
                if (['PLAY', 'PAUSE', 'STATE_UPDATE'].includes(type) && payload.isLeader && !payload.isRemoteCommand) {
                    if (this._isLeader) {
                        this.setLeader(false);
                    }
                }

                this._events.onRemoteEvent(type, payload, timestamp);
            } finally {
                this._isProcessingRemoteEvent = false;
            }
        };
    }

    private _handleLeadershipClaim(claimerId: string) {
        if (this._isClaimingLeadership) {
            if (this._handshakeTimeoutId) {
                clearTimeout(this._handshakeTimeoutId);
                this._handshakeTimeoutId = null;
            }
            this._isClaimingLeadership = false;
            this._pendingAction = null;
        }

        if (this._isLeader) {
            this.setLeader(false);
        }

        // Send ACK
        this.broadcast('LEADERSHIP_ACK', {});
    }

    public close() {
        if (this._handshakeTimeoutId) {
            clearTimeout(this._handshakeTimeoutId);
        }
        if (this._leaderCheckTimeoutId) {
            clearTimeout(this._leaderCheckTimeoutId);
        }
        this._channel.close();
    }
}
