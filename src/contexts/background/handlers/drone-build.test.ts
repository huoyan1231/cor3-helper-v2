import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { droneBuildViewSchema, type DroneBuildSnapshotView } from '../../../contracts/drone-build.js';
import type { CoreRuntime } from '../composition/core.js';
import { MemoryStorageArea } from '../../../infrastructure/storage/storage-area.js';
import { DroneBuildSnapshotStore } from '../../../infrastructure/storage/drone-build-snapshot-store.js';
import { registerDroneBuildHandlers } from './drone-build.js';

const snapshot: DroneBuildSnapshotView = {
    currentStep: 7,
    status: 'ACTIVE',
    workshopChoice: 'HANGAR',
    steps: [
        { step: 1, title: 'a', note: '', status: 'COMPLETED', completedSubtasks: 3, totalSubtasks: 3 },
        { step: 7, title: 'b', note: '', status: 'ACTIVE', completedSubtasks: 1, totalSubtasks: 3 },
    ],
    currentStepSubtasks: [],
    completedSubtasks: [],
    capturedAt: 42,
};

type Handler = (payload: unknown, request: unknown) => Promise<unknown>;

function setup(options: { readonly tabId: number | null; readonly liveValue?: unknown; readonly sendThrows?: boolean }) {
    let captured: Handler | null = null;
    const server = {
        register: (_type: string, _schema: z.ZodTypeAny, handler: Handler) => {
            captured = handler;
        },
    } as unknown as CoreRuntime['server'];
    const store = new DroneBuildSnapshotStore(new MemoryStorageArea());
    const tabs = {
        findCor3Tab: vi.fn(async () => options.tabId),
        send: vi.fn(async () => {
            if (options.sendThrows) throw new Error('no tab');
            return { ok: true, value: options.liveValue };
        }),
    };
    const core = { server, tabs, stores: { droneBuildSnapshot: store } } as unknown as CoreRuntime;
    registerDroneBuildHandlers(server, { core });
    const handler = captured as unknown as Handler;
    return { handler, store };
}

async function call(handler: Handler): Promise<{ value: unknown }> {
    const result = await handler({}, {}) as { value: unknown };
    return result;
}

describe('droneBuild.view persistence', () => {
    it('returns live snapshot as source=live and persists it', async () => {
        const { handler, store } = setup({ tabId: 1, liveValue: snapshot });
        const { value } = await call(handler);
        const parsed = droneBuildViewSchema.parse(value);
        expect(parsed.source).toBe('live');
        expect(parsed.snapshot?.currentStep).toBe(7);
        expect(parsed.storedAt).toBeGreaterThan(0);
        expect((await store.get())?.value).toEqual(snapshot);
    });

    it('falls back to the persisted snapshot when no game tab is available', async () => {
        const { handler, store } = setup({ tabId: null });
        await store.set(snapshot);
        const { value } = await call(handler);
        const parsed = droneBuildViewSchema.parse(value);
        expect(parsed.source).toBe('persisted');
        expect(parsed.snapshot?.currentStep).toBe(7);
    });

    it('returns source=none when there is no live or persisted data', async () => {
        const { handler } = setup({ tabId: null });
        const { value } = await call(handler);
        const parsed = droneBuildViewSchema.parse(value);
        expect(parsed.source).toBe('none');
        expect(parsed.snapshot).toBeNull();
    });
});
