import type { MissionProgress, MissionStep } from './model.js';

function normalizeName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Minimal inventory shape the sell-plan calculation depends on. */
export interface SurplusSellSourceItem {
    readonly id: string;
    readonly name: string;
    readonly itemConfigId: string | null;
    readonly tier: string;
    readonly quantity: number;
    readonly canSell: boolean;
    readonly sellPrice: number;
}

export interface SurplusSellEntry {
    readonly itemId: string;
    readonly name: string;
    readonly quantity: number;
    readonly sellValue: number;
}

export interface MissionSurplusSellPlan {
    /** Stacks to sell, each with the exact quantity above what the mission keeps. */
    readonly entries: readonly SurplusSellEntry[];
    readonly totalQuantity: number;
    readonly totalValue: number;
    /** Required item kinds that are present in the stash (kept, not sold). */
    readonly keptKinds: number;
}

interface RequirementBucket {
    required: number;
    requiredTotal: number;
    readonly nameKeys: readonly string[];
    readonly idMatched: boolean;
    readonly stacks: SurplusSellSourceItem[];
}

function canSellStack(item: SurplusSellSourceItem): boolean {
    const tier = item.tier.toUpperCase();
    return (tier === 'COMMON' || tier === 'RARE') && item.canSell && item.sellPrice > 0 && item.quantity > 0;
}

/**
 * Build a plan that sells every COMMON/RARE stack the drone mission does not
 * need, and only the surplus of stacks it does need. Requirement matching
 * mirrors `computeDroneMission`: exact itemConfigId first, then name/aliases.
 * Groups already done or skipped (and completed steps) no longer reserve any
 * items, so those stacks become surplus. Pure: no I/O or browser APIs.
 */
export function planMissionSurplusSell(
    inventory: readonly SurplusSellSourceItem[],
    steps: readonly MissionStep[],
    progress: MissionProgress,
): MissionSurplusSellPlan {
    const completedSteps = new Set(progress.completedSteps);
    const completedGroups = new Set(progress.completedGroupIds);
    const skippedGroups = new Set(progress.skippedGroupIds);

    const byId = new Map<string, number>();
    for (const item of inventory) {
        if (!item.itemConfigId || item.quantity <= 0) continue;
        const key = normalizeName(item.itemConfigId);
        byId.set(key, (byId.get(key) ?? 0) + Math.max(0, Math.floor(item.quantity)));
    }

    const buckets = new Map<string, RequirementBucket>();
    for (const step of steps) {
        if (completedSteps.has(step.number)) continue;
        for (const group of step.groups) {
            if (group.kind !== 'items') continue;
            if (completedGroups.has(group.id) || skippedGroups.has(group.id)) continue;
            for (const entry of group.items) {
                const key = entry.itemConfigId
                    ? `id:${normalizeName(entry.itemConfigId)}`
                    : `name:${normalizeName(entry.name)}`;
                let bucket = buckets.get(key);
                if (!bucket) {
                    const nameKeys = [entry.name, ...(entry.aliases ?? [])].map((name) => `name:${normalizeName(name)}`);
                    const idMatched = Boolean(entry.itemConfigId && byId.has(normalizeName(entry.itemConfigId)));
                    bucket = { required: 0, requiredTotal: 0, nameKeys, idMatched, stacks: [] };
                    buckets.set(key, bucket);
                }
                bucket.required += entry.quantity;
            }
        }
    }

    for (const item of inventory) {
        if (item.quantity <= 0) continue;
        let matched: RequirementBucket | null = null;
        if (item.itemConfigId) {
            matched = buckets.get(`id:${normalizeName(item.itemConfigId)}`) ?? null;
        }
        if (!matched) {
            const nameKey = `name:${normalizeName(item.name)}`;
            for (const bucket of buckets.values()) {
                if (bucket.idMatched) continue;
                if (bucket.nameKeys.includes(nameKey)) {
                    matched = bucket;
                    break;
                }
            }
        }
        if (matched) matched.stacks.push(item);
    }

    const entries: SurplusSellEntry[] = [];
    const assigned = new Set<SurplusSellSourceItem>();
    let keptKinds = 0;

    const addSurplus = (stack: SurplusSellSourceItem, quantity: number): void => {
        if (quantity <= 0 || !canSellStack(stack)) return;
        const qty = Math.min(Math.floor(quantity), Math.floor(stack.quantity));
        if (qty <= 0) return;
        entries.push({ itemId: stack.id, name: stack.name, quantity: qty, sellValue: stack.sellPrice * qty });
    };

    for (const bucket of buckets.values()) {
        let remainingNeed = bucket.required;
        for (const stack of bucket.stacks) {
            assigned.add(stack);
            const keep = Math.min(stack.quantity, Math.max(0, remainingNeed));
            remainingNeed -= keep;
            if (keep > 0) bucket.requiredTotal += keep;
            addSurplus(stack, stack.quantity - keep);
        }
        if (bucket.requiredTotal > 0) keptKinds++;
    }

    for (const item of inventory) {
        if (assigned.has(item) || item.quantity <= 0) continue;
        addSurplus(item, item.quantity);
    }

    return {
        entries,
        totalQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
        totalValue: entries.reduce((sum, entry) => sum + entry.sellValue, 0),
        keptKinds,
    };
}
