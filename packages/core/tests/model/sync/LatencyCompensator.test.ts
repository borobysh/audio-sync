import { describe, it, expect } from 'vitest';
import { LatencyCompensator } from "../../../src/model/sync/LatencyCompensator";

describe('LatencyCompensator', () => {
    describe('calculateAdjustedTime', () => {
        it('should return fallback if time is invalid', () => {
            expect(LatencyCompensator.calculateAdjustedTime(undefined, false, 0.5, 10)).toBe(10);
            expect(LatencyCompensator.calculateAdjustedTime(NaN, false, 0.5, 5)).toBe(5);
        });

        it('should return raw time if not playing', () => {
            const time = 42.5;
            const latency = 0.5;
            expect(LatencyCompensator.calculateAdjustedTime(time, false, latency)).toBe(time);
        });

        it('should add latency if playing', () => {
            const time = 100.0;
            const latency = 0.25;
            expect(LatencyCompensator.calculateAdjustedTime(time, true, latency)).toBe(100.25);
        });

        it('should handle zero latency', () => {
            const time = 10.0;
            expect(LatencyCompensator.calculateAdjustedTime(time, true, 0)).toBe(10.0);
        });
    });

    describe('getDiff', () => {
        it('should calculate difference correctly with latency adjustment', () => {
            const localTime = 10.5;
            const remoteTime = 10.0;
            const latency = 0.5;
            
            // remoteAdjusted = 10.0 + 0.5 = 10.5. Diff = |10.5 - 10.5| = 0
            expect(LatencyCompensator.getDiff(localTime, remoteTime, true, latency)).toBe(0);
        });

        it('should calculate difference correctly without playback', () => {
            const localTime = 10.5;
            const remoteTime = 10.0;
            const latency = 0.5;
            
            // remoteAdjusted = 10.0. Diff = |10.5 - 10.0| = 0.5
            expect(LatencyCompensator.getDiff(localTime, remoteTime, false, latency)).toBe(0.5);
        });
    });
});
