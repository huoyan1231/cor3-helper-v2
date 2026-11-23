import { describe, expect, it } from 'vitest';
import { WorkspaceBootstrapStore } from './workspace-bootstrap-store.js';
import { MemoryStorageArea } from './storage-area.js';
import { settingsV1Schema } from '../../contracts/storage.js';
import type { WorkspaceBootstrap } from '../../contracts/workspace-bootstrap.js';

const snapshot: WorkspaceBootstrap = {
    at: 1_700_000_000_000,
    settings: settingsV1Schema.parse({ uiLanguage: 'zh' }),
    auth: { authenticated: true, source: 'content' },
    network: { serverCount: 1, connectionCount: 0, hiddenConnectionCount: 0, home: 'home', endpoint: 'home' },
    autoJobs: { at: 1_699_999_000_000, jobs: [], markets: [] },
    daily: {
        hasClaimedToday: true,
        currentStreak: 3,
        difficulty: 'normal',
        nextTaskTime: null,
        streakBonus: null,
    },
    marketProgress: {},
};

describe('WorkspaceBootstrapStore', () => {
    it('round-trips a validated workspace snapshot', async () => {
        const store = new WorkspaceBootstrapStore(new MemoryStorageArea(), { now: () => snapshot.at });

        await store.set(snapshot);
        const loaded = await store.get();

        expect(loaded).toEqual(snapshot);
    });
});
