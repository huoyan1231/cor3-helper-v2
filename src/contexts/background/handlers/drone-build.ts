import { z } from 'zod';
import { droneBuildSnapshotSchema, type DroneBuildView } from '../../../contracts/drone-build.js';
import { ok } from '../../../kernel/result.js';
import type { CoreRuntime } from '../composition/core.js';

export interface DroneBuildHandlerDeps {
    readonly core: CoreRuntime;
}

/**
 * Reads the 15-step drone-build quest snapshot from the game tab and persists
 * it. The handler first asks the game to refresh the state actively (the game
 * only emits get.page/list.history at certain moments, so passive capture is
 * unreliable), then falls back to the passively captured cache, then to the
 * last persisted snapshot.
 */
export function registerDroneBuildHandlers(server: CoreRuntime['server'], deps: DroneBuildHandlerDeps): void {
    const { core } = deps;
    const store = core.stores.droneBuildSnapshot;

    const parseSnapshot = (value: unknown) => droneBuildSnapshotSchema.safeParse(value);

    const askGame = async (type: 'V2_DRONE_BUILD_REFRESH' | 'V2_DRONE_BUILD_VIEW') => {
        const tabId = await core.tabs.findCor3Tab();
        if (tabId === null) return null;
        try {
            const response = await core.tabs.send(tabId, { type });
            if (response && typeof response === 'object' && (response as { ok?: unknown }).ok === true) {
                const parsed = parseSnapshot((response as { value?: unknown }).value);
                return parsed.success ? parsed.data : null;
            }
        } catch {
            // Game tab did not answer; try the other path or the persisted store.
        }
        return null;
    };

    const persistAndWrap = async (snapshot: NonNullable<ReturnType<typeof parseSnapshot>['data']>): Promise<DroneBuildView> => {
        try {
            await store.set(snapshot);
            const entry = await store.get();
            return { snapshot, source: 'live', storedAt: entry?.at ?? null };
        } catch {
            return { snapshot, source: 'live', storedAt: null };
        }
    };

    server.register('droneBuild.view', z.object({}).strict(), async () => {
        // 1) Actively refresh from the game (authoritative, works even if the
        //    game has not pushed the frames recently).
        const refreshed = await askGame('V2_DRONE_BUILD_REFRESH');
        if (refreshed) return ok(await persistAndWrap(refreshed));

        // 2) Passive cache already captured in the main-world hub.
        const passive = await askGame('V2_DRONE_BUILD_VIEW');
        if (passive) return ok(await persistAndWrap(passive));

        // 3) Last persisted snapshot.
        const stored = await store.get().catch(() => null);
        if (stored) return ok({ snapshot: stored.value, source: 'persisted', storedAt: stored.at });
        return ok({ snapshot: null, source: 'none', storedAt: null });
    });
}
