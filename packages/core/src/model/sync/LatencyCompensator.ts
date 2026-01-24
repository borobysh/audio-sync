/**
 * LatencyCompensator - Pure logic for latency compensation.
 */
export class LatencyCompensator {
    /**
     * Calculates latency-adjusted playback time.
     * If playing, adds latency compensation. Otherwise returns raw time or fallback.
     */
    public static calculateAdjustedTime(
        currentTime: number | undefined,
        isPlaying: boolean | undefined,
        latencySeconds: number,
        fallback: number = 0
    ): number {
        const isValidTime = typeof currentTime === 'number' && isFinite(currentTime);

        if (!isValidTime) {
            return fallback;
        }

        return isPlaying ? currentTime + latencySeconds : currentTime;
    }

    /**
     * Calculates the difference between local time and remote adjusted time.
     * Returns the difference in seconds.
     */
    public static getDiff(localTime: number, remoteTime: number, isPlaying: boolean, latencySeconds: number): number {
        const adjustedRemoteTime = isPlaying ? remoteTime + latencySeconds : remoteTime;
        return Math.abs(localTime - adjustedRemoteTime);
    }
}
