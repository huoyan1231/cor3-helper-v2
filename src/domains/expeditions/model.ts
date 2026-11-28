export interface ExpeditionGoal {
    readonly id: string;
    readonly name: string;
}

export interface ExpeditionZone {
    readonly id: string;
    readonly name: string;
    readonly goals: readonly ExpeditionGoal[];
}

export interface ExpeditionLocation {
    readonly id: string;
    readonly name: string;
    readonly zones: readonly ExpeditionZone[];
}

export type DecisionPolicy = 'off' | 'veterans' | 'loot' | 'risk';
export type DecisionMode = 'simple' | 'score';

export interface ExpeditionMercenary {
    readonly id: string;
    readonly name: string;
    readonly level: number;
    readonly rank?: string | null;
    readonly rarity: string;
    readonly price: number;
    readonly totalCost: number | null;
    readonly riskScore: number | null;
    readonly status: string;
    readonly faction: string;
    readonly elite: boolean;
    readonly restUntil?: string | null;
}

export interface ExpeditionDecisionOption {
    readonly id: string;
    readonly label: string;
    readonly successChance: number | null;
    readonly risk: number | null;
    readonly loot: number | null;
    readonly lootModifier: number;
    readonly riskModifier: number;
    readonly requiredModuleId: string | null;
}

export interface ExpeditionDecision {
    readonly id: string;
    readonly expeditionId: string;
    readonly message: string;
    readonly riskScore: number | null;
    readonly lootScore: number | null;
    readonly deadline: string | null;
    readonly options: readonly ExpeditionDecisionOption[];
}

export interface ExpeditionLootItem {
    readonly name: string;
    readonly quantity: number;
    readonly tier: string | null;
    readonly imageUrl: string | null;
    readonly isCollected: boolean | null;
    readonly isDeleted: boolean | null;
}

export interface ActiveExpedition {
    readonly id: string;
    readonly status: string;
    readonly outcome: string | null;
    readonly locationName: string;
    readonly mercenaryName: string | null;
    readonly mercenaryRank?: string | null;
    readonly totalCost: number | null;
    readonly riskScore: number | null;
    readonly lootScore: number | null;
    readonly hasInsurance: boolean | null;
    readonly endsAt: string | null;
    /** Non-null once the game opened the reward container (payout already done). */
    readonly containerOpenedAt?: string | null;
    readonly completedAt?: string | null;
    readonly loot?: readonly ExpeditionLootItem[];
}

export interface ExpeditionOverview {
    readonly active: readonly ActiveExpedition[];
    readonly archived: readonly ActiveExpedition[];
    readonly mercenaries: readonly ExpeditionMercenary[];
    readonly locations: readonly ExpeditionLocation[];
    readonly decisions: readonly ExpeditionDecision[];
}

export function chooseDecisionOption(
    options: readonly ExpeditionDecisionOption[],
    policy: DecisionPolicy = 'loot',
): ExpeditionDecisionOption | null {
    if (policy === 'off') return null;
    const usable = options.filter((option) => option.requiredModuleId === null);
    const pool = usable.length > 0 ? usable : [...options];
    pool.sort((left, right) => {
        if (policy === 'veterans') {
            return right.riskModifier - left.riskModifier
                || right.lootModifier - left.lootModifier
                || (right.successChance ?? 0) - (left.successChance ?? 0);
        }
        if (policy === 'risk') {
            return left.riskModifier - right.riskModifier
                || right.lootModifier - left.lootModifier
                || (right.successChance ?? 0) - (left.successChance ?? 0);
        }
        // 'loot' and the legacy default
        return right.lootModifier - left.lootModifier
            || left.riskModifier - right.riskModifier
            || (right.successChance ?? 0) - (left.successChance ?? 0);
    });
    return pool[0] ?? null;
}

export function isVeteranRank(rank: string | null | undefined): boolean {
    return typeof rank === 'string' && rank.trim().toUpperCase() === 'VETERAN';
}

export interface EffectiveDecisionPolicyInput {
    readonly policy: DecisionPolicy;
    readonly getRidOfVeterans: boolean;
    readonly isVeteran: boolean;
}

export function resolveEffectiveDecisionPolicy(input: EffectiveDecisionPolicyInput): DecisionPolicy {
    if (input.policy === 'off' || !input.getRidOfVeterans || !input.isVeteran) return input.policy;
    return 'veterans';
}

export interface DecisionScoreWeights {
    readonly loot: number;
    readonly risk: number;
}

/** v1 ratio score: loot modifier weight plus risk modifier scaled by expedition risk. */
export function decisionScore(
    option: Pick<ExpeditionDecisionOption, 'lootModifier' | 'riskModifier'>,
    expeditionRiskScore: number | null,
    weights: DecisionScoreWeights,
): number {
    const riskScore = expeditionRiskScore ?? 0;
    return Math.round(
        (option.lootModifier * weights.loot)
        + (option.riskModifier * weights.risk * (((riskScore + Math.abs(option.riskModifier)) / 10) || 1)),
    );
}

/**
 * Score mode: highest score wins; on a tie the first option wins because only
 * a strictly higher score replaces the incumbent. Unusable module-locked
 * options stay behind usable ones.
 */
export function chooseScoredDecisionOption(
    options: readonly ExpeditionDecisionOption[],
    expeditionRiskScore: number | null,
    weights: DecisionScoreWeights,
): ExpeditionDecisionOption | null {
    const usable = options.filter((option) => option.requiredModuleId === null);
    const pool = usable.length > 0 ? usable : options;
    let best: ExpeditionDecisionOption | null = null;
    let bestScore = -Infinity;
    for (const option of pool) {
        const score = decisionScore(option, expeditionRiskScore, weights);
        if (score > bestScore) {
            best = option;
            bestScore = score;
        }
    }
    return best;
}


export function chooseExpeditionMercenary(mercenaries: readonly ExpeditionMercenary[]): ExpeditionMercenary | null {
    const sorted = [...mercenaries].sort((left, right) =>
        right.level - left.level
        || left.price - right.price
        || left.name.localeCompare(right.name),
    );
    return sorted[0] ?? null;
}


/**
 * The game keeps finished expeditions in the archived room with `status: COMPLETED`
 * forever. A non-empty `containerOpenedAt` means the reward container was already
 * opened (loot collected / in mailbox), so the expedition is settled and must not
 * be shown as "awaiting payment" or handed to the payout loop again.
 */
export function isExpeditionSettled(expedition: ActiveExpedition): boolean {
    return typeof expedition.containerOpenedAt === 'string' && expedition.containerOpenedAt.length > 0;
}

export function isExpeditionReady(expedition: ActiveExpedition): boolean {
    if (isExpeditionSettled(expedition)) return false;
    const status = expedition.status.toUpperCase();
    return status.includes('COMPLETE')
        || status.includes('READY')
        || status.includes('CLAIM')
        || status.includes('SUCCESS');
}
