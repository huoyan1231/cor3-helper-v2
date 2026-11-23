import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceBootstrapStorePort } from './bootstrap-service.js';
import { WorkspaceBootstrapService } from './bootstrap-service.js';
import { settingsV1Schema } from '../../contracts/storage.js';
import type { WorkspaceBootstrap } from '../../contracts/workspace-bootstrap.js';

function store(initial: WorkspaceBootstrap | null = null): WorkspaceBootstrapStorePort & { value: WorkspaceBootstrap | null } {
    return {
        value: initial,
        get: async function () { return this.value; },
        set: async function (next) { this.value = next; },
    };
}

function deps(overrides: Partial<ConstructorParameters<typeof WorkspaceBootstrapService>[0]> = {}) {
    const bootstrapStore = store();
    return {
        store: bootstrapStore,
        now: () => 1_700_000_000_000,
        settings: { get: async () => settingsV1Schema.parse({}) },
        auth: { status: async () => ({ authenticated: true, source: 'content' as const }) },
        network: async () => ({ serverCount: 3, connectionCount: 2, hiddenConnectionCount: 0, home: 'home', endpoint: 'home' }),
        autoJobs: () => ({
            at: 1_699_999_000_000,
            jobs: [],
            markets: [{ marketKey: 'home', label: 'Home', ok: true, skipped: 0 }],
        }),
        daily: async () => ({
            hasClaimedToday: false,
            currentStreak: 2,
            difficulty: 'easy',
            nextTaskTime: '2026-11-24T00:00:00.000Z',
            streakBonus: 100,
        }),
        marketProgress: async () => ({
            home: { marketId: 'market-home', marketName: 'Home', credits: 10, reputation: null },
        }),
        ...overrides,
    };
}

describe('WorkspaceBootstrapService', () => {
    it('projects every read-only source into one persisted snapshot', async () => {
        const fake = deps();
        const service = new WorkspaceBootstrapService(fake);

        const snapshot = await service.refresh();

        expect(snapshot.at).toBe(1_700_000_000_000);
        expect(snapshot.auth?.authenticated).toBe(true);
        expect(snapshot.network?.serverCount).toBe(3);
        expect(snapshot.autoJobs?.markets[0]?.marketKey).toBe('home');
        expect(snapshot.daily?.currentStreak).toBe(2);
        expect(snapshot.marketProgress.home?.marketName).toBe('Home');
        expect((fake.store as ReturnType<typeof store>).value).toEqual(snapshot);
    });

    it('keeps the last known value when a source fails', async () => {
        const previous: WorkspaceBootstrap = {
            at: 1,
            settings: settingsV1Schema.parse({ uiLanguage: 'zh' }),
            auth: { authenticated: false, source: 'none' },
            network: null,
            autoJobs: null,
            daily: null,
            marketProgress: { home: { marketId: 'market-home', marketName: 'Old home', credits: 1, reputation: null } },
        };
        const fake = deps({
            store: store(previous),
            auth: { status: async () => { throw new Error('no tab'); } },
            daily: async () => { throw new Error('no game'); },
        });
        const service = new WorkspaceBootstrapService({ ...fake, logger: { warn: vi.fn() } });

        const snapshot = await service.refresh();

        expect(snapshot.auth).toEqual(previous.auth);
        expect(snapshot.daily).toBeNull();
        expect(snapshot.marketProgress.home?.marketName).toBe('Home');
        expect(snapshot.at).toBe(1_700_000_000_000);
    });

    it('returns null when the store cannot be read', async () => {
        const fake = deps({
            store: { get: async () => { throw new Error('storage down'); }, set: async () => undefined },
            logger: { warn: vi.fn() },
        });
        const service = new WorkspaceBootstrapService(fake);

        await expect(service.read()).resolves.toBeNull();
    });
});
