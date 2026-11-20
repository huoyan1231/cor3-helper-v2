import { z } from 'zod';
import {
    droneBuildSnapshotSchema,
    type DroneBuildSnapshotView,
} from '../../contracts/drone-build.js';
import type { StorageArea } from './storage-area.js';
import { VersionedRepository } from './versioned-repository.js';

const KEY = 'v2.droneBuild.snapshot';
const SCHEMA_VERSION = 1;

/**
 * Persisted drone-build snapshot. The game's WS frames are in-memory only and
 * vanish on tab reload; this store keeps the last captured snapshot so progress
 * and item ids survive across reloads and extension restarts.
 */
const entrySchema = z.object({
    at: z.number(),
    value: droneBuildSnapshotSchema,
}).strict();

export interface DroneBuildSnapshotEntry {
    readonly at: number;
    readonly value: DroneBuildSnapshotView;
}

export class DroneBuildSnapshotStore {
    private memory: DroneBuildSnapshotEntry | null = null;
    private readonly repository: VersionedRepository<DroneBuildSnapshotEntry>;

    constructor(area: StorageArea) {
        this.repository = new VersionedRepository({
            area,
            key: KEY,
            schema: entrySchema,
            schemaVersion: SCHEMA_VERSION,
            migrate: (data) => {
                const parsed = entrySchema.safeParse(data);
                return parsed.success ? parsed.data : null;
            },
        });
    }

    async get(): Promise<DroneBuildSnapshotEntry | null> {
        if (this.memory) return this.memory;
        const stored = await this.repository.get();
        if (stored) this.memory = stored;
        return stored;
    }

    async set(value: DroneBuildSnapshotView): Promise<void> {
        const entry = entrySchema.parse({ at: Date.now(), value });
        this.memory = entry;
        await this.repository.set(entry);
    }

    async clear(): Promise<void> {
        this.memory = null;
        await this.repository.clear();
    }
}
