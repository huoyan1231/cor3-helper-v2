import { describe, expect, it, vi } from 'vitest';
import { startSchedulers } from './bootstrap.js';
import { WORKSPACE_WARM_ALARM } from './automation/alarm-ids.js';

describe('startSchedulers', () => {
    it('clears a stale workspace warm alarm instead of recreating it', async () => {
        const clear = vi.fn(async (_alarm: string) => undefined);
        const create = vi.fn((_alarm: string, _info: unknown) => undefined);
        const refresh = vi.fn(async () => undefined);
        const core = {
            settings: { get: async () => ({ helperMode: true }) },
            syncAutoSolvers: vi.fn(),
            logger: {},
        };
        const automation = {
            scheduler: { clear, create, get: async () => null },
            workspaceBootstrap: { refresh },
            autoJobs: { scheduleNextRefresh: vi.fn(), ensureInfo: vi.fn() },
        };

        await startSchedulers(core as never, automation as never, true);

        expect(clear).toHaveBeenCalledWith(WORKSPACE_WARM_ALARM);
        expect(create.mock.calls.every(([alarm]) => alarm !== WORKSPACE_WARM_ALARM)).toBe(true);
        expect(refresh).toHaveBeenCalledOnce();
    });
});
