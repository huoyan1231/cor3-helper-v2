import { describe, expect, it } from 'vitest';
import { DRONE_MISSION_STEPS } from './catalog.js';
import { computeDroneMission } from './compute.js';
import { EMPTY_MISSION_PROGRESS, type MissionStep } from './model.js';

function stepsOf(...definitions: MissionStep[]): readonly MissionStep[] {
    return definitions;
}

describe('computeDroneMission', () => {
    it('prefers itemConfigId over name when matching', () => {
        const steps = stepsOf({
            number: 1,
            title: 'single',
            groups: [{
                id: 'g1',
                kind: 'items',
                label: 'item',
                items: [{ name: '中文名', quantity: 2, itemConfigId: 'cfg-1' }],
                skipCr: 100,
            }],
        });
        const result = computeDroneMission(
            [
                { name: 'other', quantity: 2, itemConfigId: 'cfg-1' },
                { name: '中文名', quantity: 99, itemConfigId: null },
            ],
            EMPTY_MISSION_PROGRESS,
            steps,
        );
        expect(result.steps[0]?.itemGroups[0]?.items[0]).toMatchObject({ owned: 2, missing: 0, exactMatch: true });
    });

    it('falls back to name matching and reports unmatched kinds', () => {
        const steps = stepsOf({
            number: 1,
            title: 'single',
            groups: [{
                id: 'g1',
                kind: 'items',
                label: 'item',
                items: [{ name: '高负荷电缆', quantity: 5 }],
                skipCr: 100,
            }],
        });
        const result = computeDroneMission(
            [{ name: '高负荷电缆', quantity: 2, itemConfigId: null }],
            EMPTY_MISSION_PROGRESS,
            steps,
        );
        expect(result.steps[0]?.itemGroups[0]?.items[0]).toMatchObject({ owned: 2, missing: 3, exactMatch: false });
        expect(result.summary.unmatchedKinds).toBe(1);
    });

    it('merges duplicate items across steps into one shortage', () => {
        const duplicate = (number: number, groupId: string): MissionStep => ({
            number,
            title: `step ${number}`,
            groups: [{
                id: groupId,
                kind: 'items',
                label: 'electronics',
                items: [{ name: '电子元件', quantity: 2, itemConfigId: 'cfg-e' }],
                skipCr: 26000,
            }],
        });
        const result = computeDroneMission(
            [{ name: '电子元件', quantity: 3, itemConfigId: 'cfg-e' }],
            EMPTY_MISSION_PROGRESS,
            stepsOf(duplicate(8, 's8'), duplicate(9, 's9')),
        );
        expect(result.shortages).toHaveLength(1);
        expect(result.shortages[0]).toMatchObject({ required: 4, owned: 3, missing: 1, exactMatch: true });
        expect(result.shortages[0]?.groupIds).toEqual(['s8', 's9']);
    });

    it('separates required CR from skippable CR', () => {
        const steps = stepsOf(
            {
                number: 1,
                title: 'fee + items',
                groups: [
                    { id: 'debt', kind: 'cr-only', label: 'debt', requiredCr: 30000 },
                    { id: 'gift', kind: 'items', label: 'gift', items: [{ name: 'x', quantity: 1 }], skipCr: 27000 },
                ],
            },
            {
                number: 2,
                title: 'fee',
                groups: [{ id: 'fee2', kind: 'cr-only', label: 'fee', requiredCr: 10000 }],
            },
        );
        const result = computeDroneMission([], EMPTY_MISSION_PROGRESS, steps);
        expect(result.summary.requiredCr).toBe(40000);
        expect(result.summary.skippableCr).toBe(27000);
    });

    it('excludes completed steps and groups', () => {
        const steps = stepsOf({
            number: 1,
            title: 'mixed',
            groups: [
                { id: 'done-group', kind: 'cr-only', label: 'paid', requiredCr: 500 },
                { id: 'open-group', kind: 'items', label: 'open', items: [{ name: 'y', quantity: 2 }], skipCr: 900 },
            ],
        });
        const result = computeDroneMission([], {
            completedSteps: [],
            completedGroupIds: ['done-group'],
            skippedGroupIds: [],
            selectedChoices: {},
        }, steps);
        expect(result.summary.requiredCr).toBe(0);
        expect(result.summary.skippableCr).toBe(900);
    });

    it('excludes skipped item groups from shortages and skip cost', () => {
        const steps = stepsOf({
            number: 1,
            title: 'skippable',
            groups: [{ id: 'skip', kind: 'items', label: 'skip', items: [{ name: 'z', quantity: 2 }], skipCr: 900 }],
        });
        const result = computeDroneMission([], {
            completedSteps: [],
            completedGroupIds: [],
            skippedGroupIds: ['skip'],
            selectedChoices: {},
        }, steps);
        expect(result.shortages).toHaveLength(0);
        expect(result.summary.skippableCr).toBe(0);
        expect(result.steps[0]?.itemGroups[0]?.skipped).toBe(true);
    });

    it('normalizes the selected choice and keeps option metadata', () => {
        const result = computeDroneMission([], {
            ...EMPTY_MISSION_PROGRESS,
            selectedChoices: { 's2-choice': 'hangar', invalid: 'x' },
        }, DRONE_MISSION_STEPS);
        const choice = result.steps[1]?.choiceGroups[0];
        expect(choice?.selectedKey).toBe('hangar');
        expect(choice?.options.find((option) => option.key === 'cuu')?.waitMinutes).toBe(240);
    });
});
