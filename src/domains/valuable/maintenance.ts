import { NetworkGraph } from '../network/graph.js';
import type { NetworkServer, NetworkSnapshot } from '../network/model.js';

export interface MaintenanceTarget {
    readonly id: string;
    readonly name: string;
    readonly typeName: string | null;
    readonly timeUntil: string;
    /** Route length from home; larger means further (v1's furthest-first order). */
    readonly distance: number;
}

/**
 * Servers that have a known upcoming maintenance but are not in maintenance
 * yet. These are the only servers where repeated valuable searches can force
 * the server into maintenance, matching v1's `isUpcoming` check.
 */
export function planMaintenanceTargets(snapshot: NetworkSnapshot): readonly MaintenanceTarget[] {
    const graph = new NetworkGraph(snapshot);
    return [...snapshot.servers.values()]
        .filter((server: NetworkServer) =>
            !server.maintenance.active
            && !server.maintenance.endsAt
            && typeof server.maintenance.timeUntil === 'string'
            && server.maintenance.timeUntil.length > 0)
        .map((server) => {
            const route = graph.findRoute(server.id);
            return {
                id: server.id,
                name: server.name,
                typeName: server.typeName,
                timeUntil: server.maintenance.timeUntil as string,
                distance: route.ok ? route.value.nodes.length : 0,
            };
        })
        .sort((left, right) => right.distance - left.distance || left.name.localeCompare(right.name));
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
