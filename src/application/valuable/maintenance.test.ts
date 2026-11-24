import { describe, expect, it } from 'vitest';
import { asServerId } from '../../kernel/ids.js';
import type { NetworkServer, NetworkSnapshot } from '../../domains/network/model.js';
import { MAINTENANCE_ORDER } from '../../domains/valuable/maintenance-order.js';
import { MaintenanceForceService } from './maintenance.js';

function listedServer(orderId: number, overrides: Partial<NetworkServer> = {}): NetworkServer {
    const entry = MAINTENANCE_ORDER.find((item) => item.maintenanceId === orderId)!;
    return {
        id: asServerId(`server-${orderId}`),
        name: entry.server,
        ip: entry.ip,
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

function unlistedServer(id: string): NetworkServer {
    return {
        id: asServerId(id),
        name: id,
        ip: '999.999.9.9',
        typeName: null,
        cluster: null,
        faction: null,
        maintenance: { active: false, endsAt: null, timeUntil: '00:02:00' },
        access: { kind: 'none', active: false },
        endpointCapable: false,
        reachableNow: true,
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
    it('searches a listed upcoming server until its snapshot shows maintenance', async () => {
        const base = snapshot([listedServer(1)]);
        const active = snapshot([
            listedServer(1, { maintenance: { active: true, endsAt: null, timeUntil: null } }),
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
            expect(result.value.targets.map((target) => target.maintenanceOrder)).toEqual([1]);
            expect(result.value.forced).toEqual([MAINTENANCE_ORDER[0]!.server]);
            expect(result.value.failed).toEqual([]);
            expect(result.value.stopped).toBe(false);
        }
        expect(searches).toEqual(['server-1', 'server-1']);
        expect(progress).toContain('prepare');
        expect(progress).toContain('searching');
        expect(progress).toContain('done');
    });

    it('stops after maxAttempts and reports the failure', async () => {
        const snap = snapshot([listedServer(2)]);
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

    it('executes selected listed servers in catalog order and skips unlisted ids', async () => {
        const snap = snapshot([
            listedServer(20),
            listedServer(3),
            listedServer(10),
            unlistedServer('outside'),
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
        const result = await service.force({
            selectedIds: ['server-20', 'outside', 'server-3'],
            maxAttempts: 1,
            sleep: async () => {},
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.targets.map((target) => target.maintenanceOrder)).toEqual([3, 20]);
            expect(result.value.failed).toHaveLength(2);
        }
        expect(searches).toEqual(['server-3', 'server-20']);
    });

    it('continues to the next catalog server after a failure', async () => {
        const snap = snapshot([listedServer(3), listedServer(4)]);
        const searches: string[] = [];
        const service = new MaintenanceForceService({
            snapshots: { get: async () => ({ ok: true, value: snap }) },
            servers: {
                searchFiles: async (id) => {
                    searches.push(id);
                    return { ok: true, value: { found: [] } };
                },
            },
            beforeSearch: async (id) => id === 'server-3'
                ? { ok: false, error: { code: 'NO_LOADOUT', message: 'missing' } }
                : { ok: true, value: undefined },
        });
        const result = await service.force({ maxAttempts: 1, sleep: async () => {} });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.failed).toEqual([
                { target: MAINTENANCE_ORDER[2]!.server, message: 'missing' },
                { target: MAINTENANCE_ORDER[3]!.server, message: 'No maintenance after 1 searches' },
            ]);
            expect(result.value.stopped).toBe(false);
        }
        expect(searches).toEqual(['server-4']);
    });

    it('honors shouldStop during a run', async () => {
        const snap = snapshot([listedServer(5)]);
        let stopped = false;
        const service = new MaintenanceForceService({
            snapshots: { get: async () => ({ ok: true, value: snap }) },
            servers: { searchFiles: async () => ({ ok: true, value: { found: [] } }) },
        });
        const result = await service.force({
            maxAttempts: 3,
            shouldStop: () => stopped,
            onProgress: (progress) => { if (progress.phase === 'searching') stopped = true; },
            sleep: async () => {},
        });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.stopped).toBe(true);
    });
});
