import type { AutoJobsSnapshot } from '../../contracts/auto-jobs.js';
import type { NetworkMapSummary } from '../../contracts/network-summary.js';
import type { AuthStatus, SettingsV1 } from '../../contracts/storage.js';
import { EMPTY_WORKSPACE_BOOTSTRAP, type WorkspaceBootstrap } from '../../contracts/workspace-bootstrap.js';
import type { DailyOpsState } from '../../domains/daily-ops/model.js';
import type { MarketOptionsView } from '../popup/portal.js';

export interface WorkspaceBootstrapStorePort {
    get(): Promise<WorkspaceBootstrap | null>;
    set(value: WorkspaceBootstrap): Promise<void>;
}

export interface WorkspaceBootstrapDeps {
    readonly store: WorkspaceBootstrapStorePort;
    readonly now: () => number;
    readonly settings: { get(): Promise<SettingsV1> };
    readonly auth: { status(): Promise<AuthStatus> };
    readonly network: () => Promise<NetworkMapSummary | null>;
    readonly autoJobs: () => AutoJobsSnapshot | null;
    readonly daily: () => Promise<DailyOpsState | null>;
    readonly marketProgress: () => Promise<Record<string, MarketOptionsView>>;
    readonly logger?: { warn(scope: string, message: string, data?: unknown): void };
}

async function settle<T>(run: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await run();
    } catch {
        return fallback;
    }
}

/**
 * Owns the persisted UI warm cache. It never sends a command to the game; all
 * fields come from stores/read-only ports that the background already owns.
 * A failed source keeps its last known value so a transient game-tab error
 * cannot make a previously warm panel cold.
 */
export class WorkspaceBootstrapService {
    constructor(private readonly deps: WorkspaceBootstrapDeps) {}

    async read(): Promise<WorkspaceBootstrap | null> {
        try {
            return await this.deps.store.get();
        } catch (error) {
            this.deps.logger?.warn('workspace', 'Failed to read workspace bootstrap cache', {
                message: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    async refresh(): Promise<WorkspaceBootstrap> {
        const previous = await this.read();
        const fallback = previous ?? EMPTY_WORKSPACE_BOOTSTRAP;
        const [settings, auth, network, daily, marketProgress] = await Promise.all([
            settle(() => this.deps.settings.get(), fallback.settings),
            settle(() => this.deps.auth.status(), fallback.auth),
            settle(() => this.deps.network(), fallback.network),
            settle(() => this.deps.daily(), fallback.daily),
            settle(() => this.deps.marketProgress(), fallback.marketProgress),
        ]);
        let autoJobs: AutoJobsSnapshot | null = null;
        try {
            autoJobs = this.deps.autoJobs() ?? fallback.autoJobs;
        } catch (error) {
            this.deps.logger?.warn('workspace', 'Failed to read Auto Jobs snapshot for bootstrap', {
                message: error instanceof Error ? error.message : String(error),
            });
            autoJobs = fallback.autoJobs;
        }
        const snapshot: WorkspaceBootstrap = {
            at: this.deps.now(),
            settings,
            auth,
            network,
            autoJobs,
            daily,
            marketProgress,
        };
        try {
            await this.deps.store.set(snapshot);
        } catch (error) {
            this.deps.logger?.warn('workspace', 'Failed to persist workspace bootstrap cache', {
                message: error instanceof Error ? error.message : String(error),
            });
        }
        return snapshot;
    }
}
