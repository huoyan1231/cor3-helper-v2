import { describe, expect, it } from 'vitest';
import { asServerId } from '../../kernel/ids.js';
import type { NetworkServer, NetworkSnapshot } from '../network/model.js';
import { listMaintenanceCandidates, maintenanceStarted, planMaintenanceTargets, planSelectedMaintenanceTargets } from './maintenance.js';

function server(id: string, overrides: Partial<NetworkServer> = {}): NetworkServer {
    return {
        id: asServerId(id),
        name: id,
        ip: null,
        typeName: null,
        cluster: null,
        faction: null,
        maintenance: { active: false, endsAt: null, timeUntil: null },
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
    it('picks only upcoming-maintenance servers, excluding active and unknown', () => {
        const result = planMaintenanceTargets(snapshot([
            server('home'),
            server('upcoming', { maintenance: { active: false, endsAt: null, timeUntil: '00:02:00' } }),
            server('active', { maintenance: { active: true, endsAt: '2026-11-22T00:00:00Z', timeUntil: null } }),
            server('unknown', { maintenance: { active: false, endsAt: null, timeUntil: null } }),
        ]));
        expect(result.map((target) => target.id)).toEqual(['upcoming']);
        expect(result[0]?.timeUntil).toBe('00:02:00');
    });

    it('orders furthest servers first, then by name', () => {
        const result = planMaintenanceTargets(snapshot([
            server('home'),
            server('near', { maintenance: { active: false, endsAt: null, timeUntil: '00:01:00' } }),
            server('far', { maintenance: { active: false, endsAt: null, timeUntil: '00:03:00' } }),
        ]));
        // With no edges all routes are length 1, so the name tie-break applies.
        expect(result.map((target) => target.id)).toEqual(['far', 'near']);
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
    it('lists both upcoming and active servers with active first', () => {
        const result = listMaintenanceCandidates(snapshot([
            server('home'),
            server('upcoming', { maintenance: { active: false, endsAt: null, timeUntil: '2026-11-21T00:02:00Z' } }),
            server('active', { maintenance: { active: true, endsAt: '2026-11-21T00:10:00Z', timeUntil: null } }),
            server('unknown'),
        ]));
        expect(result.map((target) => target.id)).toEqual(['active', 'upcoming']);
        expect(result[0]?.active).toBe(true);
        expect(result[0]?.endsAt).toBe('2026-11-21T00:10:00Z');
        expect(result[1]?.timeUntil).toBe('2026-11-21T00:02:00Z');
    });

    it('forces only the selected ids, furthest first', () => {
        const result = planSelectedMaintenanceTargets(snapshot([
            server('home'),
            server('near', { maintenance: { active: false, endsAt: null, timeUntil: '00:01:00' } }),
            server('far', { maintenance: { active: false, endsAt: null, timeUntil: '00:03:00' } }),
            server('skip', { maintenance: { active: false, endsAt: null, timeUntil: '00:05:00' } }),
        ]), ['near', 'far']);
        expect(result.map((target) => target.id)).toEqual(['far', 'near']);
    });

    it('returns no targets for an empty selection', () => {
        expect(planSelectedMaintenanceTargets(snapshot([server('home')]), [])).toEqual([]);
    });
});
