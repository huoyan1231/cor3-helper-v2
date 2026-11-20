import type {
    InventoryQuantity,
    ItemShortage,
    MissionProgress,
    MissionStep,
    MissionStepView,
    MissionViewModel,
} from './model.js';

function normalizeName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface InventoryIndex {
    readonly byId: ReadonlyMap<string, number>;
    readonly byName: ReadonlyMap<string, number>;
}

function buildInventoryIndex(items: readonly InventoryQuantity[]): InventoryIndex {
    const byId = new Map<string, number>();
    const byName = new Map<string, number>();
    for (const entry of items) {
        const quantity = Math.max(0, Math.floor(entry.quantity));
        if (entry.itemConfigId) {
            const key = normalizeName(entry.itemConfigId);
            byId.set(key, (byId.get(key) ?? 0) + quantity);
        }
        const nameKey = normalizeName(entry.name);
        byName.set(nameKey, (byName.get(nameKey) ?? 0) + quantity);
    }
    return { byId, byName };
}

interface MatchResult {
    readonly owned: number;
    readonly exactMatch: boolean;
}

function matchQuantity(entry: { name: string; itemConfigId?: string; aliases?: readonly string[] }, index: InventoryIndex): MatchResult {
    if (entry.itemConfigId) {
        const byId = index.byId.get(normalizeName(entry.itemConfigId));
        if (byId !== undefined) return { owned: byId, exactMatch: true };
    }
    const names = [entry.name, ...(entry.aliases ?? [])];
    let owned = 0;
    for (const name of names) {
        const key = normalizeName(name);
        owned = Math.max(owned, index.byName.get(key) ?? 0);
    }
    return { owned, exactMatch: false };
}

interface ShortageAccumulator {
    readonly key: string;
    readonly name: string;
    required: number;
    readonly owned: number;
    exactMatch: boolean;
    readonly groupIds: Set<string>;
}

/**
 * Combine the static catalog, live inventory quantities and persisted user
 * progress into the page view model. Pure: no browser APIs, no I/O.
 */
export function computeDroneMission(
    inventory: readonly InventoryQuantity[],
    progress: MissionProgress,
    steps: readonly MissionStep[],
): MissionViewModel {
    const index = buildInventoryIndex(inventory);
    const completedSteps = new Set(progress.completedSteps);
    const completedGroups = new Set(progress.completedGroupIds);
    const skippedGroups = new Set(progress.skippedGroupIds);

    const accumulators = new Map<string, ShortageAccumulator>();
    let requiredCr = 0;
    let skippableCr = 0;

    const stepViews: MissionStepView[] = steps.map((step) => {
        const stepCompleted = completedSteps.has(step.number);
        const itemGroups = [];
        const crOnlyGroups = [];
        const choiceGroups = [];

        for (const group of step.groups) {
            if (group.kind === 'items') {
                const done = stepCompleted || completedGroups.has(group.id);
                const skipped = !stepCompleted && skippedGroups.has(group.id);
                const items = group.items.map((entry) => {
                    const match = matchQuantity(entry, index);
                    const missing = done || skipped ? 0 : Math.max(0, entry.quantity - match.owned);
                    if (!done && !skipped) {
                        const key = entry.itemConfigId
                            ? `id:${normalizeName(entry.itemConfigId)}`
                            : `name:${normalizeName(entry.name)}`;
                        const existing = accumulators.get(key);
                        if (existing) {
                            existing.required += entry.quantity;
                            existing.groupIds.add(group.id);
                            existing.exactMatch = existing.exactMatch || match.exactMatch;
                        } else {
                            accumulators.set(key, {
                                key,
                                name: entry.name,
                                required: entry.quantity,
                                owned: match.owned,
                                exactMatch: match.exactMatch,
                                groupIds: new Set([group.id]),
                            });
                        }
                    }
                    return {
                        name: entry.name,
                        required: entry.quantity,
                        owned: match.owned,
                        missing,
                        exactMatch: match.exactMatch,
                    };
                });
                if (!done && !skipped) skippableCr += group.skipCr;
                itemGroups.push({
                    groupId: group.id,
                    label: group.label,
                    skipCr: group.skipCr,
                    done,
                    skipped,
                    items,
                });
                continue;
            }

            if (group.kind === 'cr-only') {
                const done = stepCompleted || completedGroups.has(group.id);
                if (!done) requiredCr += group.requiredCr;
                crOnlyGroups.push({
                    groupId: group.id,
                    label: group.label,
                    requiredCr: group.requiredCr,
                    waitMinutes: group.waitMinutes ?? null,
                    done,
                });
                continue;
            }

            const selected = progress.selectedChoices[group.id];
            const validSelection = selected !== undefined && group.options.some((option) => option.key === selected)
                ? selected
                : null;
            choiceGroups.push({
                groupId: group.id,
                label: group.label,
                selectedKey: validSelection,
                options: group.options.map((option) => ({
                    key: option.key,
                    label: option.label,
                    skipCr: option.skipCr,
                    waitMinutes: option.waitMinutes ?? null,
                })),
            });
        }

        return {
            number: step.number,
            title: step.title,
            completed: stepCompleted,
            itemGroups,
            crOnlyGroups,
            choiceGroups,
        };
    });

    const shortages: ItemShortage[] = [...accumulators.values()]
        .map((entry) => ({
            key: entry.key,
            name: entry.name,
            required: entry.required,
            owned: entry.owned,
            missing: Math.max(0, entry.required - entry.owned),
            exactMatch: entry.exactMatch,
            groupIds: [...entry.groupIds],
        }))
        .sort((left, right) => right.missing - left.missing || left.name.localeCompare(right.name));

    return {
        steps: stepViews,
        shortages,
        summary: {
            totalSteps: steps.length,
            completedSteps: steps.filter((step) => completedSteps.has(step.number)).length,
            requiredCr,
            skippableCr,
            missingKinds: shortages.filter((entry) => entry.missing > 0).length,
            unmatchedKinds: shortages.filter((entry) => !entry.exactMatch).length,
        },
    };
}
