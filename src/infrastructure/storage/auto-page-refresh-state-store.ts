import type { StorageArea } from './storage-area.js';
import { VersionedRepository } from './versioned-repository.js';
import { autoPageRefreshStateSchema, type AutoPageRefreshState } from '../../contracts/auto-page-refresh.js';

const KEY = 'v2.autoPageRefreshState';
const SCHEMA_VERSION = 1;

const DEFAULT_STATE: AutoPageRefreshState = {
    nextRefreshAt: null,
    lastRefreshAt: null,
    waitStartedAt: null,
    waitUntil: null,
    lastResult: null,
    lastError: null,
};

export class AutoPageRefreshStateStore {
    private readonly repository: VersionedRepository<AutoPageRefreshState>;

    constructor(area: StorageArea) {
        this.repository = new VersionedRepository({
            area,
            key: KEY,
            schema: autoPageRefreshStateSchema,
            schemaVersion: SCHEMA_VERSION,
            migrate: (data) => autoPageRefreshStateSchema.safeParse(data).data ?? null,
        });
    }

    async get(): Promise<AutoPageRefreshState> {
        return await this.repository.get() ?? DEFAULT_STATE;
    }

    async set(patch: Partial<AutoPageRefreshState>): Promise<AutoPageRefreshState> {
        const current = await this.get();
        const next = autoPageRefreshStateSchema.parse({ ...current, ...patch });
        await this.repository.set(next);
        return next;
    }

    async clear(): Promise<void> {
        await this.repository.clear();
    }
}
