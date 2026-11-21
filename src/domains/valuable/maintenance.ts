import { NetworkGraph } from '../network/graph.js';
import type { NetworkServer, NetworkSnapshot } from '../network/model.js';

export interface MaintenanceTarget {
    readonly id: string;
    readonly name: string;
    readonly typeName: string | null;
    readonly timeUntil: string | null;
    readonly endsAt: string | null;
    readonly active: boolean;
    /** Route length from home; larger means further (v1's furthest-first order). */
    readonly distance: number;
}

function hasMaintenanceInfo(server: NetworkServer): boolean {
    return server.maintenance.active
        || Boolean(server.maintenance.endsAt)
        || (typeof server.maintenance.timeUntil === 'string' && server.maintenance.timeUntil.length > 0);
}

function toTargets(
    snapshot: NetworkSnapshot,
    servers: readonly NetworkServer[],
    order: 'ui' | 'route',
): readonly MaintenanceTarget[] {
    const graph = new NetworkGraph(snapshot);
    const targets = servers.map((server): MaintenanceTarget => {
        const route = graph.findRoute(server.id);
        return {
            id: server.id,
            name: server.name,
            typeName: server.typeName,
            timeUntil: server.maintenance.timeUntil,
            endsAt: server.maintenance.endsAt,
            active: server.maintenance.active,
            distance: route.ok ? route.value.nodes.length : 0,
        };
    });
    if (order === 'route') {
        return targets.sort((left, right) =>
            right.distance - left.distance || left.name.localeCompare(right.name));
    }
    // v1 maintenance tab: already-in-maintenance first, then by next time.
    return targets.sort((left, right) => {
        const leftActive = left.endsAt ? 0 : 1;
        const rightActive = right.endsAt ? 0 : 1;
        if (leftActive !== rightActive) return leftActive - rightActive;
        const leftTime = left.timeUntil || left.endsAt || '';
        const rightTime = right.timeUntil || right.endsAt || '';
        return leftTime < rightTime ? -1 : leftTime > rightTime ? 1 : 0;
    });
}

/** Every server the v1 maintenance tab listed: upcoming or already in maintenance. */
export function listMaintenanceCandidates(snapshot: NetworkSnapshot): readonly MaintenanceTarget[] {
    return toTargets(snapshot, [...snapshot.servers.values()].filter(hasMaintenanceInfo), 'ui');
}

/**
 * Servers that have a known upcoming maintenance but are not in maintenance
 * yet. These are the only servers where repeated valuable searches can force
 * the server into maintenance, matching v1's `isUpcoming` check.
 */
export function planMaintenanceTargets(snapshot: NetworkSnapshot): readonly MaintenanceTarget[] {
    return toTargets(
        snapshot,
        [...snapshot.servers.values()].filter((server: NetworkServer) =>
            !server.maintenance.active
            && !server.maintenance.endsAt
            && typeof server.maintenance.timeUntil === 'string'
            && server.maintenance.timeUntil.length > 0),
        'route',
    );
}

/** Servers explicitly selected in the UI, executed furthest-first like v1's batch. */
export function planSelectedMaintenanceTargets(
    snapshot: NetworkSnapshot,
    ids: readonly string[],
): readonly MaintenanceTarget[] {
    if (ids.length === 0) return [];
    const wanted = new Set(ids);
    return toTargets(
        snapshot,
        [...snapshot.servers.values()].filter((server) => wanted.has(server.id)),
        'route',
    );
}

/**
 * Whether a server's maintenance became active given its current state.
 * v1 confirmed maintenance via `maintenanceEndsAt`; some game states set that
 * field before `isInMaintenance`, so either signal counts as started as long as
 * the end time has not already passed.
 */
export function maintenanceStarted(server: NetworkServer, now: number): boolean {
    const { active, endsAt } = server.maintenance;
    if (!active && !endsAt) return false;
    if (!endsAt) return active;
    const endsAtMs = new Date(endsAt).getTime();
    return Number.isFinite(endsAtMs) ? endsAtMs > now : active;
}
