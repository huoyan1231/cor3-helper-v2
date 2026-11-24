import { describe, expect, it } from 'vitest';
import { asServerId } from '../../kernel/ids.js';
import type { NetworkServer, NetworkSnapshot } from '../network/model.js';
import { MAINTENANCE_ORDER } from './maintenance-order.js';
import { listMaintenanceCandidates, maintenanceStarted, planMaintenanceTargets, planSelectedMaintenanceTargets } from './maintenance.js';

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

function server(id: string, overrides: Partial<NetworkServer> = {}): NetworkServer {
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

describe('planMaintenanceTargets', () => {
    it('keeps only listed upcoming servers and skips unlisted, active and unknown', () => {
        const result = planMaintenanceTargets(snapshot([
            listedServer(10),
            listedServer(2),
            listedServer(3, { maintenance: { active: true, endsAt: '2026-11-22T00:00:00Z', timeUntil: null } }),
            listedServer(4, { maintenance: { active: false, endsAt: '2026-11-22T00:00:00Z', timeUntil: '00:02:00' } }),
            listedServer(5, { maintenance: { active: false, endsAt: null, timeUntil: null } }),
            server('outside'),
            server('wrong-ip', { name: MAINTENANCE_ORDER[0]!.server, ip: '000.000.0.0' }),
        ]));
        expect(result.map((target) => target.maintenanceOrder)).toEqual([2, 10]);
        expect(result.map((target) => target.name)).toEqual([MAINTENANCE_ORDER[1]!.server, MAINTENANCE_ORDER[9]!.server]);
        expect(result.every((target) => !target.active && !target.endsAt)).toBe(true);
    });

    it('orders strictly by maintenance_id, ignoring route distance and selection order', () => {
        const result = planMaintenanceTargets(snapshot([
            listedServer(35),
            listedServer(6),
            listedServer(23),
        ]));
        expect(result.map((target) => target.maintenanceOrder)).toEqual([6, 23, 35]);
    });
});

describe('maintenanceStarted', () => {
    it('is false when maintenance is not active', () => {
        expect(maintenanceStarted({
            ...server('s'),
            maintenance: { active: false, endsAt: null, timeUntil: null },
        }, 0)).toBe(false);
    });

    it('is true for an open-ended active maintenance and a future end', () => {
        expect(maintenanceStarted({ ...server('s'), maintenance: { active: true, endsAt: null, timeUntil: null } }, 0)).toBe(true);
        expect(maintenanceStarted({ ...server('s'), maintenance: { active: true, endsAt: '2026-11-22T00:00:00Z', timeUntil: null } }, Date.parse('2026-11-21T23:00:00Z'))).toBe(true);
    });

    it('is false for an already-ended maintenance', () => {
        expect(maintenanceStarted({ ...server('s'), maintenance: { active: true, endsAt: '2026-11-20T00:00:00Z', timeUntil: null } }, Date.parse('2026-11-21T00:00:00Z'))).toBe(false);
    });

    it('accepts a future maintenanceEndsAt even before isInMaintenance flips', () => {
        expect(maintenanceStarted({ ...server('s'), maintenance: { active: false, endsAt: '2026-11-22T00:00:00Z', timeUntil: null } }, Date.parse('2026-11-21T23:00:00Z'))).toBe(true);
    });
});

describe('manual selection', () => {
    it('lists only listed upcoming servers in maintenance_id order', () => {
        const result = listMaintenanceCandidates(snapshot([
            listedServer(44),
            listedServer(1),
            listedServer(2, { maintenance: { active: true, endsAt: '2026-11-21T00:10:00Z', timeUntil: null } }),
            server('outside'),
        ]));
        expect(result.map((target) => target.maintenanceOrder)).toEqual([1, 44]);
        expect(result[0]?.active).toBe(false);
        expect(result[0]?.ip).toBe(MAINTENANCE_ORDER[0]!.ip);
    });

    it('forces only the selected listed ids in catalog order, not selection order', () => {
        const result = planSelectedMaintenanceTargets(snapshot([
            listedServer(9),
            listedServer(2),
            listedServer(4),
            server('outside'),
        ]), ['server-9', 'server-2', 'outside']);
        expect(result.map((target) => target.maintenanceOrder)).toEqual([2, 9]);
    });

    it('returns no targets for an empty selection', () => {
        expect(planSelectedMaintenanceTargets(snapshot([listedServer(1)]), [])).toEqual([]);
    });
});
