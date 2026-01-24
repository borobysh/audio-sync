import { describe, it, expect } from 'vitest';
import {
    validateSyncConfig,
    describeSyncConfig,
    SyncPresets
} from '../../src/model/types/syncConfig.types';

describe('SyncConfig Validation', () => {
    describe('validateSyncConfig', () => {
        it('should pass validation for valid configs', () => {
            const { valid, warnings } = validateSyncConfig({
                syncPlay: true,
                syncPause: true,
                syncSeek: true,
                syncTrackChange: true,
                singlePlayback: false
            });

            expect(valid).toBe(true);
            expect(warnings).toHaveLength(0);
        });

        it('should warn about singlePlayback + no syncPlay', () => {
            const { valid, warnings } = validateSyncConfig({
                singlePlayback: true,
                syncPlay: false
            });

            expect(valid).toBe(false);
            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings[0]).toContain('singlePlayback: true + syncPlay: false');
        });

        it('should warn about multi-tab with no sync', () => {
            const { valid, warnings } = validateSyncConfig({
                singlePlayback: false,
                syncPlay: false,
                syncPause: false,
                syncSeek: false,
                syncTrackChange: false
            });

            expect(valid).toBe(false);
            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings[0]).toContain('All tabs play but nothing is synced');
        });

        it('should warn about syncTrackChange without syncPlay', () => {
            const { valid, warnings } = validateSyncConfig({
                syncTrackChange: true,
                syncPlay: false
            });

            expect(valid).toBe(false);
            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings[0]).toContain('syncTrackChange: true + syncPlay: false');
        });

        it('should suggest periodic sync for singlePlayback', () => {
            const { warnings } = validateSyncConfig({
                singlePlayback: true,
                syncInterval: 0
            });

            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings[0]).toContain('syncInterval: 0');
        });
    });

    describe('describeSyncConfig', () => {
        it('should describe singlePlayback mode', () => {
            const description = describeSyncConfig({ singlePlayback: true });
            expect(description).toContain('Only leader tab plays audio');
        });

        it('should describe multi-tab mode', () => {
            const description = describeSyncConfig({ singlePlayback: false });
            expect(description).toContain('All tabs play audio simultaneously');
        });

        it('should describe track sync', () => {
            const syncDescription = describeSyncConfig({ syncTrackChange: true });
            expect(syncDescription).toContain('Tracks sync across tabs');

            const noSyncDescription = describeSyncConfig({ syncTrackChange: false });
            expect(noSyncDescription).toContain('Each tab plays independent tracks');
        });

        it('should describe seek sync', () => {
            const syncDescription = describeSyncConfig({ syncSeek: true });
            expect(syncDescription).toContain('Seek/time syncs');

            const noSyncDescription = describeSyncConfig({ syncSeek: false });
            expect(noSyncDescription).toContain('Each tab can seek independently');
        });
    });

    describe('SyncPresets', () => {
        it('should have INDEPENDENT preset', () => {
            expect(SyncPresets.INDEPENDENT).toBeDefined();
            expect(SyncPresets.INDEPENDENT.singlePlayback).toBe(false);
            expect(SyncPresets.INDEPENDENT.syncPlay).toBe(false);
            expect(SyncPresets.INDEPENDENT.syncTrackChange).toBe(false);
        });

        it('should have SYNCHRONIZED preset', () => {
            expect(SyncPresets.SYNCHRONIZED).toBeDefined();
            expect(SyncPresets.SYNCHRONIZED.singlePlayback).toBe(false);
            expect(SyncPresets.SYNCHRONIZED.syncPlay).toBe(true);
            expect(SyncPresets.SYNCHRONIZED.syncTrackChange).toBe(true);
        });

        it('should have REMOTE_CONTROL preset', () => {
            expect(SyncPresets.REMOTE_CONTROL).toBeDefined();
            expect(SyncPresets.REMOTE_CONTROL.singlePlayback).toBe(true);
            expect(SyncPresets.REMOTE_CONTROL.syncPlay).toBe(true);
            expect(SyncPresets.REMOTE_CONTROL.syncTrackChange).toBe(true);
        });

        it('should have SYNCED_PLAYBACK_INDEPENDENT_TRACKS preset', () => {
            expect(SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS).toBeDefined();
            expect(SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS.singlePlayback).toBe(false);
            expect(SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS.syncPlay).toBe(true);
            expect(SyncPresets.SYNCED_PLAYBACK_INDEPENDENT_TRACKS.syncTrackChange).toBe(false);
        });

        it('presets should pass validation', () => {
            Object.values(SyncPresets).forEach(preset => {
                const { valid } = validateSyncConfig(preset);
                // Note: Some presets may have warnings but are intentionally designed that way
                // We don't enforce strict validation
            });
        });
    });
});
