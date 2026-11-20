import { describe, expect, it } from 'vitest';
import type { DroneBuildView } from '../../contracts/drone-build.js';
import { buildDroneMissionViewModel } from './view-model.js';
import { EMPTY_MISSION_PROGRESS } from '../../domains/drone-mission/index.js';

const snapshot = {
    currentStep: 7,
    status: 'ACTIVE',
    workshopChoice: 'HANGAR',
    steps: [
        { step: 1, title: 'a', note: '', status: 'COMPLETED' as const, completedSubtasks: 3, totalSubtasks: 3 },
        { step: 2, title: 'b', note: '', status: 'COMPLETED' as const, completedSubtasks: 1, totalSubtasks: 1 },
        { step: 7, title: 'g', note: '', status: 'ACTIVE' as const, completedSubtasks: 1, totalSubtasks: 3 },
    ],
    currentStepSubtasks: [],
    completedSubtasks: [],
    capturedAt: 500,
};

function view(overrides: Partial<DroneBuildView> = {}): DroneBuildView {
    return { snapshot, source: 'live', storedAt: 600, ...overrides };
}

describe('buildDroneMissionViewModel diagnostics', () => {
    it('reports none when no view is provided', () => {
        const result = buildDroneMissionViewModel([], { manualProgress: EMPTY_MISSION_PROGRESS });
        expect(result.diagnostics).toMatchObject({ source: 'none', hasHistory: false, hasPage: false, detectedCompletedSteps: 0 });
    });

    it('reports the live source and frame availability', () => {
        const result = buildDroneMissionViewModel([], { manualProgress: EMPTY_MISSION_PROGRESS, view: view() });
        expect(result.diagnostics).toMatchObject({
            source: 'live', capturedAt: 500, storedAt: 600,
            hasHistory: true, hasPage: true, detectedCompletedSteps: 2,
        });
    });

    it('reports persisted source when the snapshot came from storage', () => {
        const result = buildDroneMissionViewModel([], {
            manualProgress: EMPTY_MISSION_PROGRESS,
            view: view({ source: 'persisted' }),
        });
        expect(result.diagnostics.source).toBe('persisted');
    });

    it('flags a missing page frame', () => {
        const result = buildDroneMissionViewModel([], {
            manualProgress: EMPTY_MISSION_PROGRESS,
            view: view({ snapshot: { ...snapshot, currentStep: 0, currentStepSubtasks: [] } }),
        });
        expect(result.diagnostics.hasHistory).toBe(true);
        expect(result.diagnostics.hasPage).toBe(false);
    });
});
