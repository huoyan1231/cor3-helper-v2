import { z } from 'zod';
import { workspaceBootstrapSchema, type WorkspaceBootstrap } from '../../contracts/workspace-bootstrap.js';
import type { WorkspaceBootstrapStorePort } from '../../application/workspace/bootstrap-service.js';
import type { StorageArea } from './storage-area.js';
import { VersionedRepository } from './versioned-repository.js';

const KEY = 'v2.workspace.bootstrap';
const SCHEMA_VERSION = 1;
type StoredBootstrap = z.infer<typeof workspaceBootstrapSchema>;

export class WorkspaceBootstrapStore implements WorkspaceBootstrapStorePort {
    private readonly repository: VersionedRepository<StoredBootstrap>;

    constructor(area: StorageArea, clock?: { now(): number }, logger?: { warn(scope: string, message: string, data?: unknown): void }) {
        this.repository = new VersionedRepository({
            area,
            key: KEY,
            schema: workspaceBootstrapSchema,
            schemaVersion: SCHEMA_VERSION,
            ...(clock ? { clock } : {}),
            ...(logger ? { logger } : {}),
        });
    }

    async get(): Promise<WorkspaceBootstrap | null> {
        return await this.repository.get() as WorkspaceBootstrap | null;
    }

    async set(value: WorkspaceBootstrap): Promise<void> {
        await this.repository.set(workspaceBootstrapSchema.parse(value) as StoredBootstrap);
    }
}
