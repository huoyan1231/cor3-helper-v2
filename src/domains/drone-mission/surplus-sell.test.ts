import { describe, expect, it } from 'vitest';
import type { MissionProgress, MissionStep } from './model.js';
import { planMissionSurplusSell, type SurplusSellSourceItem } from './surplus-sell.js';

const EMPTY_PROGRESS: MissionProgress = {
    completedSteps: [],
    completedGroupIds: [],
    skippedGroupIds: [],
    selectedChoices: {},
};

function stack(id: string, name: string, quantity: number, extra: Partial<SurplusSellSourceItem> = {}): SurplusSellSourceItem {
    return {
        id, name, quantity,
        itemConfigId: null,
        tier: 'COMMON',
        canSell: true,
        sellPrice: 10,
        ...extra,
    };
}

function stepsWith(requirement: { name: string; quantity: number; itemConfigId?: string; aliases?: readonly string[] }): readonly MissionStep[] {
    return [{
        number: 1,
        title: 'Step 1',
        groups: [{
            id: 'g1',
            kind: 'items',
            label: 'Group 1',
            items: [{
                name: requirement.name,
                quantity: requirement.quantity,
                ...(requirement.itemConfigId ? { itemConfigId: requirement.itemConfigId } : {}),
                ...(requirement.aliases ? { aliases: requirement.aliases } : {}),
            }],
            skipCr: 0,
        }],
    }];
}

describe('planMissionSurplusSell', () => {
    it('keeps the required quantity and sells only the surplus', () => {
        const plan = planMissionSurplusSell(
            [stack('a', 'Beanie', 5), stack('b', 'Beanie', 3)],
            stepsWith({ name: 'Beanie', quantity: 4 }),
            EMPTY_PROGRESS,
        );
        expect(plan.entries).toEqual([
            { itemId: 'a', name: 'Beanie', quantity: 1, sellValue: 10 },
            { itemId: 'b', name: 'Beanie', quantity: 3, sellValue: 30 },
        ]);
        expect(plan.totalQuantity).toBe(4);
        expect(plan.totalValue).toBe(40);
        expect(plan.keptKinds).toBe(1);
    });

    it('sells all of an item the mission does not need', () => {
        const plan = planMissionSurplusSell(
            [stack('junk', 'Random scrap', 7)],
            stepsWith({ name: 'Beanie', quantity: 1 }),
            EMPTY_PROGRESS,
        );
        expect(plan.entries).toEqual([{ itemId: 'junk', name: 'Random scrap', quantity: 7, sellValue: 70 }]);
        expect(plan.keptKinds).toBe(0);
    });

    it('matches by itemConfigId ahead of name and ignores name-only items for a taken group', () => {
        const plan = planMissionSurplusSell(
            [
                stack('exact', 'Holocene Holographic cable', 1, { itemConfigId: 'CFG-1', sellPrice: 100 }),
                stack('alias', 'Holoscene Holographic cable', 4, { sellPrice: 100 }),
            ],
            stepsWith({ name: 'Holocene Holographic cable', itemConfigId: 'CFG-1', aliases: ['Holoscene Holographic cable'], quantity: 1 }),
            EMPTY_PROGRESS,
        );
        // The exact-id stack covers the requirement; the alias-named stack has no
        // itemConfigId, so the id-matched requirement does not reserve it and it is sold.
        expect(plan.entries).toEqual([{ itemId: 'alias', name: 'Holoscene Holographic cable', quantity: 4, sellValue: 400 }]);
        expect(plan.keptKinds).toBe(1);
    });

    it('only sells COMMON and RARE items', () => {
        const plan = planMissionSurplusSell(
            [
                stack('c', 'Common junk', 2),
                stack('r', 'Rare junk', 2, { tier: 'RARE', sellPrice: 50 }),
                stack('e', 'Epic keep', 2, { tier: 'EPIC', sellPrice: 500 }),
                stack('q', 'Quest keep', 2, { tier: 'QUEST', sellPrice: 900 }),
            ],
            stepsWith({ name: 'Beanie', quantity: 1 }),
            EMPTY_PROGRESS,
        );
        expect(plan.entries.map((entry) => entry.itemId)).toEqual(['c', 'r']);
        expect(plan.totalValue).toBe(120);
    });

    it('skips non-sellable and zero-price stacks', () => {
        const plan = planMissionSurplusSell(
            [
                stack('no-sell', 'Bound item', 2, { canSell: false }),
                stack('no-price', 'Priceless', 2, { sellPrice: 0 }),
                stack('ok', 'Sellable', 2),
            ],
            stepsWith({ name: 'Beanie', quantity: 1 }),
            EMPTY_PROGRESS,
        );
        expect(plan.entries.map((entry) => entry.itemId)).toEqual(['ok']);
    });

    it('releases reserved items for done groups and completed steps', () => {
        const inventory = [stack('m', 'Beanie', 3)];
        const requirements = stepsWith({ name: 'Beanie', quantity: 3 });
        const doneGroup = planMissionSurplusSell(inventory, requirements, {
            ...EMPTY_PROGRESS,
            completedGroupIds: ['g1'],
        });
        const doneStep = planMissionSurplusSell(inventory, requirements, {
            ...EMPTY_PROGRESS,
            completedSteps: [1],
        });
        expect(doneGroup.entries).toEqual([{ itemId: 'm', name: 'Beanie', quantity: 3, sellValue: 30 }]);
        expect(doneStep.entries).toEqual([{ itemId: 'm', name: 'Beanie', quantity: 3, sellValue: 30 }]);
    });
});
