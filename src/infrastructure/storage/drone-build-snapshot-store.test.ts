import { describe, expect, it } from 'vitest';
import type { DroneBuildSnapshotView } from '../../contracts/drone-build.js';
import { DroneBuildSnapshotStore } from './drone-build-snapshot-store.js';
import { MemoryStorageArea } from './storage-area.js';

const snapshot: DroneBuildSnapshotView = {
    currentStep: 7,
    status: 'ACTIVE',
    workshopChoice: 'HANGAR',
    steps: [
        { step: 1, title: 'a', note: '', status: 'COMPLETED', completedSubtasks: 3, totalSubtasks: 3 },
        { step: 7, title: 'b', note: '', status: 'ACTIVE', completedSubtasks: 1, totalSubtasks: 3 },
    ],
    currentStepSubtasks: [],
    completedSubtasks: [{ stepNumber: 1, subtaskKey: '1A', variant: 'BUY' }],
    capturedAt: 123,
};

describe('DroneBuildSnapshotStore', () => {
    it('returns null when nothing has been stored', async () => {
        const store = new DroneBuildSnapshotStore(new MemoryStorageArea());
        expect(await store.get()).toBeNull();
    });

    it('persists and reads back a snapshot', async () => {
        const store = new DroneBuildSnapshotStore(new MemoryStorageArea());
        await store.set(snapshot);
        const entry = await store.get();
        expect(entry).not.toBeNull();
        expect(entry!.value).toEqual(snapshot);
        expect(entry!.at).toBeGreaterThan(0);
    });

    it('reads the persisted value from a fresh store instance', async () => {
        const area = new MemoryStorageArea();
        const first = new DroneBuildSnapshotStore(area);
        await first.set(snapshot);
        const second = new DroneBuildSnapshotStore(area);
        expect((await second.get())?.value).toEqual(snapshot);
    });

    it('clears the persisted value', async () => {
        const store = new DroneBuildSnapshotStore(new MemoryStorageArea());
        await store.set(snapshot);
        await store.clear();
        expect(await store.get()).toBeNull();
    });
});
