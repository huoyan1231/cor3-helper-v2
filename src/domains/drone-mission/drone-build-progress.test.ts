import { describe, expect, it } from 'vitest';
import { DRONE_MISSION_STEPS } from './catalog.js';
import {
    progressFromDroneBuild,
    shouldPreferWsProgress,
} from './drone-build-progress.js';
import type { DroneBuildSnapshot } from './drone-build.js';

function snapshot(overrides: Partial<DroneBuildSnapshot> = {}): DroneBuildSnapshot {
    return {
        currentStep: 7,
        status: 'ACTIVE',
        workshopChoice: 'HANGAR',
        steps: [
            { step: 1, title: 'a', note: '', status: 'COMPLETED', completedSubtasks: 3, totalSubtasks: 3 },
            { step: 7, title: 'b', note: '', status: 'ACTIVE', completedSubtasks: 1, totalSubtasks: 3 },
        ],
        currentStepSubtasks: [],
        completedSubtasks: [
            { stepNumber: 1, subtaskKey: '1A', variant: 'BUY' },
            { stepNumber: 7, subtaskKey: '7C', variant: 'BARTER' },
        ],
        capturedAt: 1,
        ...overrides,
    };
}

describe('progressFromDroneBuild', () => {
    it('returns null for an empty snapshot', () => {
        expect(progressFromDroneBuild(null, DRONE_MISSION_STEPS)).toBeNull();
        expect(progressFromDroneBuild({
            currentStep: 0, status: 'UNKNOWN', workshopChoice: null, steps: [],
            currentStepSubtasks: [], completedSubtasks: [], capturedAt: 0,
        }, DRONE_MISSION_STEPS)).toBeNull();
    });

    it('maps COMPLETED steps to completedSteps', () => {
        const progress = progressFromDroneBuild(snapshot(), DRONE_MISSION_STEPS)!;
        expect(progress.completedSteps).toEqual([1]);
    });

    it('maps completed subtask keys to group ids via the catalog', () => {
        const progress = progressFromDroneBuild(snapshot(), DRONE_MISSION_STEPS)!;
        expect(progress.completedGroupIds).toContain('s1-tool');
        expect(progress.completedGroupIds).toContain('s7-tools');
    });

    it('maps workshopChoice HANGAR to the choice option key', () => {
        const progress = progressFromDroneBuild(snapshot(), DRONE_MISSION_STEPS)!;
        expect(progress.selectedChoices['s2-choice']).toBe('hangar');
    });

    it('ignores an unknown workshop choice', () => {
        const progress = progressFromDroneBuild(snapshot({ workshopChoice: 'MYSTERY' }), DRONE_MISSION_STEPS)!;
        expect(progress.selectedChoices['s2-choice']).toBeUndefined();
    });
});

describe('shouldPreferWsProgress', () => {
    it('is false without a snapshot or without any reported step', () => {
        expect(shouldPreferWsProgress(null)).toBe(false);
        expect(shouldPreferWsProgress(snapshot({ steps: [] }))).toBe(false);
    });

    it('is true once the game reports completed or active steps', () => {
        expect(shouldPreferWsProgress(snapshot())).toBe(true);
    });
});
