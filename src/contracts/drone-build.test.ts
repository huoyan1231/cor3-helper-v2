import { describe, expect, it } from 'vitest';
import { normalizeDroneBuildSnapshot } from './drone-build.js';

const history = {
    items: [
        { step: 1, title: 'FARLINE Universal Crimper', note: 'tools', status: 'COMPLETED', completedSubtasks: 3, totalSubtasks: 3 },
        { step: 7, title: 'Shielding Element', note: 'container', status: 'ACTIVE', completedSubtasks: 1, totalSubtasks: 3 },
        { step: 15, title: 'Official Recognition', note: 'register', status: 'LOCKED', completedSubtasks: 0, totalSubtasks: 1 },
    ],
};

const page = {
    currentStep: 7,
    status: 'ACTIVE',
    workshopChoice: 'HANGAR',
    subtasks: [
        { stepNumber: 1, subtaskKey: '1A', variant: 'BUY', status: 'COMPLETED' },
        { stepNumber: 7, subtaskKey: '7C', variant: 'BARTER', status: 'COMPLETED' },
        { stepNumber: 7, subtaskKey: '7A', variant: null, status: 'PENDING' },
    ],
    currentStepSubtasks: [
        {
            key: '7A',
            title: 'Shielding Element',
            status: 'PENDING',
            variant: null,
            buyCost: 45000,
            barterItems: [{
                itemConfigId: '019d719f-84f4-71e8-a58e-983a7207e73e',
                title: 'Californium-252 slab',
                requiredQuantity: 1,
                availableQuantity: 0,
            }],
        },
        {
            key: '7B',
            title: 'Data Cable',
            status: 'PENDING',
            variant: null,
            buyCost: 17000,
            barterItems: [{
                itemConfigId: '019d719f-84f4-7114-bd53-7867ad546099',
                title: 'Holoscene Holographic cable',
                requiredQuantity: 1,
                availableQuantity: 2,
            }],
        },
    ],
};

describe('normalizeDroneBuildSnapshot', () => {
    it('returns null when neither payload is recognizable', () => {
        expect(normalizeDroneBuildSnapshot({}, {}, 1)).toBeNull();
    });

    it('normalizes history and page into a single snapshot', () => {
        const result = normalizeDroneBuildSnapshot(history, page, 12345);
        expect(result).not.toBeNull();
        expect(result!.capturedAt).toBe(12345);
        expect(result!.currentStep).toBe(7);
        expect(result!.workshopChoice).toBe('HANGAR');
        expect(result!.steps).toHaveLength(3);
        expect(result!.steps[1]!).toMatchObject({ step: 7, status: 'ACTIVE', completedSubtasks: 1, totalSubtasks: 3 });
    });

    it('keeps authoritative itemConfigIds and quantities from the current step', () => {
        const snapshot = normalizeDroneBuildSnapshot(history, page, 1);
        expect(snapshot).not.toBeNull();
        expect(snapshot!.currentStepSubtasks).toHaveLength(2);
        expect(snapshot!.currentStepSubtasks[0]!.barterItems[0]).toMatchObject({
            itemConfigId: '019d719f-84f4-71e8-a58e-983a7207e73e',
            requiredQuantity: 1,
            availableQuantity: 0,
        });
        expect(snapshot!.currentStepSubtasks[0]!.buyCost).toBe(45000);
    });

    it('normalizes pending subtasks without inventing completions', () => {
        const snapshot = normalizeDroneBuildSnapshot(history, page, 1);
        expect(snapshot).not.toBeNull();
        expect(snapshot!.completedSubtasks).toHaveLength(2);
        expect(snapshot!.completedSubtasks.map((entry) => entry.subtaskKey)).toEqual(['1A', '7C']);
        expect(snapshot!.completedSubtasks[1]!.variant).toBe('BARTER');
    });

    it('tolerates string numbers and unknown statuses', () => {
        const snapshot = normalizeDroneBuildSnapshot({
            items: [{ step: '3', title: 5, note: null, status: 'WEIRD', completedSubtasks: '1', totalSubtasks: 1 }],
        }, { currentStep: '2', status: 9, subtasks: [], currentStepSubtasks: [] }, 1);
        expect(snapshot).not.toBeNull();
        expect(snapshot!.steps[0]).toMatchObject({ step: 3, title: '', note: '', status: 'LOCKED', completedSubtasks: 1 });
        expect(snapshot!.currentStep).toBe(2);
    });
});
