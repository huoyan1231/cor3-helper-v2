import { z } from 'zod';
import { droneBuildSnapshotSchema, type DroneBuildView } from '../../../contracts/drone-build.js';
import { ok } from '../../../kernel/result.js';
import type { CoreRuntime } from '../composition/core.js';

export interface DroneBuildHandlerDeps {
    readonly core: CoreRuntime;
}

/**
 * Reads the 15-step drone-build quest snapshot captured by the main-world
 * socket hub. The hub lives in the game tab, so this follows the same
 * background → content → main-world tab-proxy pattern as devtools.wsLogs.
 *
 * A live snapshot is persisted so progress survives tab reloads and extension
 * restarts. When the game tab is unavailable or has not emitted the frames,
 * the last persisted snapshot is returned with `source: 'persisted'`.
 */
export function registerDroneBuildHandlers(server: CoreRuntime['server'], deps: DroneBuildHandlerDeps): void {
    const { core } = deps;
    const store = core.stores.droneBuildSnapshot;

    server.register('droneBuild.view', z.object({}).strict(), async () => {
        let live: DroneBuildView | null = null;
        const tabId = await core.tabs.findCor3Tab();
        if (tabId !== null) {
            try {
                const response = await core.tabs.send(tabId, { type: 'V2_DRONE_BUILD_VIEW' });
                if (response && typeof response === 'object' && (response as { ok?: unknown }).ok === true) {
                    const parsed = droneBuildSnapshotSchema.safeParse((response as { value?: unknown }).value);
                    if (parsed.success) {
                        try {
                            await store.set(parsed.data);
                            const entry = await store.get();
                            live = { snapshot: parsed.data, source: 'live', storedAt: entry?.at ?? null };
                        } catch {
                            live = { snapshot: parsed.data, source: 'live', storedAt: null };
                        }
                    }
                }
            } catch {
                // Game tab did not answer; fall back to the persisted snapshot.
            }
        }

        if (live) return ok(live);

        const stored = await store.get().catch(() => null);
        if (stored) return ok({ snapshot: stored.value, source: 'persisted', storedAt: stored.at });
        return ok({ snapshot: null, source: 'none', storedAt: null });
    });
}
