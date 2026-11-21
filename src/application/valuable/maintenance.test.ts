import { describe, expect, it } from 'vitest';
import { asServerId } from '../../kernel/ids.js';
import type { NetworkServer, NetworkSnapshot } from '../../domains/network/model.js';
import { MaintenanceForceService } from './maintenance.js';

function server(id: string, overrides: Partial<NetworkServer> = {}): NetworkServer {
    return {
        id: asServerId(id),
        name: id,
        ip: null,
        typeName: null,
        cluster: null,
        faction: null,
        maintenance: { active: false, endsAt: null, timeUntil: '00:02:00' },
        access: { kind: 'none', active: false },
        endpointCapable: false,
        reachableNow: true,
        ...overrides,
    };
}

function snapshot(servers: readonly NetworkServer[]): NetworkSnapshot {
    return {
        version: 1,
        capturedAt: 0,
        homeId: asServerId('home'),
        endpointId: null,
        servers: new Map(servers.map((entry) => [entry.id, entry])),
        edges: [],
        maintenanceFingerprint: 'test',
    };
}

describe('MaintenanceForceService', () => {
    it('searches an upcoming server until its snapshot shows maintenance', async () => {
        const base = snapshot([
            server('home', { maintenance: { active: false, endsAt: null, timeUntil: null } }),
            server('target'),
        ]);
        const active = snapshot([
            base.servers.get(asServerId('home'))!,
            server('target', { maintenance: { active: true, endsAt: null, timeUntil: null } }),
        ]);
        let snap = base;
        const searches: string[] = [];
        const progress: string[] = [];
        const service = new MaintenanceForceService({
            snapshots: { get: async () => ({ ok: true, value: snap }) },
            servers: {
                searchFiles: async (id) => {
                    searches.push(id);
                    if (searches.length === 2) snap = active;
                    return { ok: true, value: { found: [] } };
                },
            },
        });
        const result = await service.force({ sleep: async () => {}, onProgress: (entry) => progress.push(entry.phase) });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.targets.map((target) => target.id)).toEqual(['target']);
            expect(result.value.forced).toEqual(['target']);
            expect(result.value.failed).toEqual([]);
            expect(result.value.stopped).toBe(false);
        }
        expect(searches).toEqual(['target', 'target']);
        expect(progress).toContain('prepare');
        expect(progress).toContain('searching');
        expect(progress).toContain('done');
    });

    it('stops after maxAttempts and reports the failure', async () => {
        const snap = snapshot([
            server('home', { maintenance: { active: false, endsAt: null, timeUntil: null } }),
            server('target'),
        ]);
        let searches = 0;
        const service = new MaintenanceForceService({
            snapshots: { get: async () => ({ ok: true, value: snap }) },
            servers: { searchFiles: async () => { searches++; return { ok: true, value: { found: [] } }; } },
        });
        const result = await service.force({ maxAttempts: 3, sleep: async () => {} });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.forced).toEqual([]);
            expect(result.value.failed).toHaveLength(1);
            expect(result.value.failed[0]?.message).toContain('3 searches');
        }
        expect(searches).toBe(3);
    });

    it('forces only explicitly selected servers', async () => {
        const snap = snapshot([
            server('home', { maintenance: { active: false, endsAt: null, timeUntil: null } }),
            server('first'),
            server('second'),
        ]);
        const searches: string[] = [];
        const service = new MaintenanceForceService({
            snapshots: { get: async () => ({ ok: true, value: snap }) },
            servers: {
                searchFiles: async (id) => {
                    searches.push(id);
                    return { ok: true, value: { found: [] } };
                },
            },
        });
        const result = await service.force({ selectedIds: ['first'], maxAttempts: 1, sleep: async () => {} });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.targets.map((target) => target.id)).toEqual(['first']);
            expect(result.value.failed).toHaveLength(1);
        }
        expect(searches).toEqual(['first']);
    });

    it('honors shouldStop and skips the beforeSearch hook failure', async () => {
        const snap = snapshot([
            server('home', { maintenance: { active: false, endsAt: null, timeUntil: null } }),
            server('target'),
        ]);
        const service = new MaintenanceForceService({
            snapshots: { get: async () => ({ ok: true, value: snap }) },
            servers: { searchFiles: async () => ({ ok: true, value: { found: [] } }) },
            beforeSearch: async () => ({ ok: false, error: { code: 'NO_LOADOUT', message: 'missing' } }),
        });
        const result = await service.force({ sleep: async () => {} });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.failed[0]?.message).toBe('missing');
            expect(result.value.forced).toEqual([]);
        }
    });
});
