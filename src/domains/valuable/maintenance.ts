import { NetworkGraph } from '../network/graph.js';
import type { NetworkServer, NetworkSnapshot } from '../network/model.js';
import { findMaintenanceOrder } from './maintenance-order.js';

export interface MaintenanceTarget {
    readonly id: string;
    readonly name: string;
    readonly ip: string | null;
    readonly typeName: string | null;
    readonly timeUntil: string | null;
    readonly endsAt: string | null;
    readonly active: boolean;
    /** Route length from home; retained for diagnostics, no longer the force order. */
    readonly distance: number;
    /** Built-in maintenance order (1..44), or null for servers outside the catalog. */
    readonly maintenanceOrder: number | null;
}

/**
 * Only servers present in the built-in catalog and currently in the upcoming
 * state can be forced. Name and IP must both match the catalog entry.
 */
function isForceable(server: NetworkServer): boolean {
    return findMaintenanceOrder(server.name, server.ip) !== null
        && !server.maintenance.active
        && !server.maintenance.endsAt
        && typeof server.maintenance.timeUntil === 'string'
        && server.maintenance.timeUntil.length > 0;
}

function toTargets(snapshot: NetworkSnapshot, servers: readonly NetworkServer[]): readonly MaintenanceTarget[] {
    const graph = new NetworkGraph(snapshot);
    const targets = servers.map((server): MaintenanceTarget => {
        const route = graph.findRoute(server.id);
        const order = findMaintenanceOrder(server.name, server.ip);
        return {
            id: server.id,
            name: server.name,
            ip: server.ip,
            typeName: server.typeName,
            timeUntil: server.maintenance.timeUntil,
            endsAt: server.maintenance.endsAt,
            active: server.maintenance.active,
            distance: route.ok ? route.value.nodes.length : 0,
            maintenanceOrder: order?.maintenanceId ?? null,
        };
    });
    return targets.sort((left, right) =>
        (left.maintenanceOrder ?? Number.MAX_SAFE_INTEGER) - (right.maintenanceOrder ?? Number.MAX_SAFE_INTEGER)
        || left.name.localeCompare(right.name));
}

/** Listed, forceable servers in `maintenance_id` order for the manual tab. */
export function listMaintenanceCandidates(snapshot: NetworkSnapshot): readonly MaintenanceTarget[] {
    return toTargets(snapshot, [...snapshot.servers.values()].filter(isForceable));
}

/**
 * Upcoming listed servers in `maintenance_id` order. This is the default target
 * set when no explicit server ids are supplied.
 */
export function planMaintenanceTargets(snapshot: NetworkSnapshot): readonly MaintenanceTarget[] {
    return listMaintenanceCandidates(snapshot);
}

/**
 * Explicitly selected servers, re-ordered by the built-in catalog. The UI's
 * selection order is ignored; unlisted/unforceable ids are dropped.
 */
export function planSelectedMaintenanceTargets(
    snapshot: NetworkSnapshot,
    ids: readonly string[],
): readonly MaintenanceTarget[] {
    if (ids.length === 0) return [];
    const wanted = new Set(ids);
    return toTargets(
        snapshot,
        [...snapshot.servers.values()].filter((server) => wanted.has(server.id) && isForceable(server)),
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
