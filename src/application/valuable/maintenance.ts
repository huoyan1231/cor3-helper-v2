import { maintenanceStarted, planMaintenanceTargets, type MaintenanceTarget } from '../../domains/valuable/maintenance.js';
export type { MaintenanceTarget } from '../../domains/valuable/maintenance.js';
import type { Result } from '../../kernel/result.js';
import { ok } from '../../kernel/result.js';
import type { Clock } from '../../kernel/clock.js';
import { SystemClock } from '../../kernel/clock.js';
import { asServerId } from '../../kernel/ids.js';
import type { GameError } from '../game/ports.js';
import type { NetworkSnapshotService } from '../network/snapshot-service.js';
import type { ValuableServerPort } from './seller.js';

/** Force a server into maintenance by repeatedly searching valuables (v1 behavior). */
export const DEFAULT_MAINTENANCE_MAX_ATTEMPTS = 50;
export const DEFAULT_MAINTENANCE_ATTEMPT_DELAY_MS = 600;
export const DEFAULT_MAINTENANCE_SERVER_DELAY_MS = 1500;

export interface PreSearchHook {
    (serverId: string, serverTypeName: string | null): Promise<Result<void, GameError>>;
}

export interface MaintenanceForceProgress {
    readonly phase: 'prepare' | 'searching' | 'server-done' | 'done';
    readonly target: string;
    readonly index: number;
    readonly total: number;
    readonly attempts: number;
}

export interface MaintenanceForceSummary {
    readonly stopped: boolean;
    readonly targets: readonly MaintenanceTarget[];
    readonly forced: readonly string[];
    readonly failed: readonly { readonly target: string; readonly message: string }[];
}

export interface MaintenanceForceControl {
    readonly shouldStop?: () => boolean;
    readonly onProgress?: (progress: MaintenanceForceProgress) => void;
    readonly maxAttempts?: number;
    readonly attemptDelayMs?: number;
    readonly serverDelayMs?: number;
    readonly sleep?: (ms: number) => Promise<void>;
}

export interface MaintenanceForceDeps {
    readonly snapshots: Pick<NetworkSnapshotService, 'get'>;
    readonly servers: Pick<ValuableServerPort, 'searchFiles'>;
    readonly beforeSearch?: PreSearchHook;
    readonly clock?: Clock;
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drive each upcoming-maintenance server into maintenance by issuing repeated
 * `file.search-valuable` commands (the only command v1 used), then forcing a
 * fresh network map until the server reports maintenance active. Pure relative
 * to ports: no browser APIs, no direct WS access.
 */
export class MaintenanceForceService {
    private readonly clock: Clock;

    constructor(private readonly deps: MaintenanceForceDeps) {
        this.clock = deps.clock ?? new SystemClock();
    }

    async force(control: MaintenanceForceControl = {}): Promise<Result<MaintenanceForceSummary, GameError>> {
        const sleep = control.sleep ?? defaultSleep;
        const maxAttempts = control.maxAttempts ?? DEFAULT_MAINTENANCE_MAX_ATTEMPTS;
        const attemptDelayMs = control.attemptDelayMs ?? DEFAULT_MAINTENANCE_ATTEMPT_DELAY_MS;
        const serverDelayMs = control.serverDelayMs ?? DEFAULT_MAINTENANCE_SERVER_DELAY_MS;

        const initial = await this.deps.snapshots.get(true);
        if (!initial.ok) return { ok: false, error: initial.error };
        const targets = planMaintenanceTargets(initial.value);
        const forced: string[] = [];
        const failed: { target: string; message: string }[] = [];
        let stopped = false;

        for (let index = 0; index < targets.length; index++) {
            if (control.shouldStop?.()) { stopped = true; break; }
            const target = targets[index]!;
            control.onProgress?.({ phase: 'prepare', target: target.name, index: index + 1, total: targets.length, attempts: 0 });

            if (this.deps.beforeSearch) {
                const ready = await this.deps.beforeSearch(target.id, target.typeName);
                if (!ready.ok) {
                    failed.push({ target: target.name, message: ready.error.message });
                    continue;
                }
            }

            let attempts = 0;
            let started = false;
            let lastError: string | null = null;
            while (attempts < maxAttempts) {
                if (control.shouldStop?.()) { stopped = true; break; }
                attempts += 1;
                control.onProgress?.({ phase: 'searching', target: target.name, index: index + 1, total: targets.length, attempts });

                const search = await this.deps.servers.searchFiles(target.id);
                lastError = search.ok ? null : search.error.message;

                const refreshed = await this.deps.snapshots.get(true);
                if (refreshed.ok) {
                    const current = refreshed.value.servers.get(asServerId(target.id));
                    if (current && maintenanceStarted(current, this.clock.now())) {
                        started = true;
                        break;
                    }
                } else {
                    lastError = refreshed.error.message;
                }

                await sleep(attemptDelayMs);
            }

            if (stopped) break;
            if (started) {
                forced.push(target.name);
                control.onProgress?.({ phase: 'server-done', target: target.name, index: index + 1, total: targets.length, attempts });
            } else {
                failed.push({ target: target.name, message: lastError ?? `No maintenance after ${maxAttempts} searches` });
            }

            if (index < targets.length - 1) await sleep(serverDelayMs);
        }

        control.onProgress?.({ phase: 'done', target: '', index: targets.length, total: targets.length, attempts: 0 });
        return ok({ stopped, targets, forced, failed });
    }
}
