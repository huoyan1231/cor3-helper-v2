import { z } from 'zod';
import { droneBuildSnapshotSchema } from '../../../contracts/drone-build.js';
import { ok } from '../../../kernel/result.js';
import type { CoreRuntime } from '../composition/core.js';

export interface DroneBuildHandlerDeps {
    readonly core: CoreRuntime;
}

/**
 * Reads the 15-step drone-build quest snapshot captured by the main-world
 * socket hub. The hub lives in the game tab, so this follows the same
 * background → content → main-world tab-proxy pattern as devtools.wsLogs.
 */
export function registerDroneBuildHandlers(server: CoreRuntime['server'], deps: DroneBuildHandlerDeps): void {
    const { core } = deps;
    server.register('droneBuild.view', z.object({}).strict(), async () => {
        const tabId = await core.tabs.findCor3Tab();
        if (tabId === null) return ok(null);
        try {
            const response = await core.tabs.send(tabId, { type: 'V2_DRONE_BUILD_VIEW' });
            if (response && typeof response === 'object' && (response as { ok?: unknown }).ok === true) {
                const parsed = droneBuildSnapshotSchema.safeParse((response as { value?: unknown }).value);
                return ok(parsed.success ? parsed.data : null);
            }
            return ok(null);
        } catch {
            return ok(null);
        }
    });
}
