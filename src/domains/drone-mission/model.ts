/** One item required by a mission group. `itemConfigId` is filled in once the
 * user supplies the game config ids; until then matching falls back to name. */
export interface MissionItemRequirement {
    readonly name: string;
    readonly quantity: number;
    readonly itemConfigId?: string;
    readonly aliases?: readonly string[];
}

export interface MissionItemsGroup {
    readonly id: string;
    readonly kind: 'items';
    readonly label: string;
    readonly items: readonly MissionItemRequirement[];
    /** CR cost to skip handing in this whole group. */
    readonly skipCr: number;
}

/** A group that can only be satisfied by handing in credits (debt / fee). */
export interface MissionCrOnlyGroup {
    readonly id: string;
    readonly kind: 'cr-only';
    readonly label: string;
    readonly requiredCr: number;
    readonly waitMinutes?: number;
}

export interface MissionChoiceOption {
    readonly key: string;
    readonly label: string;
    readonly skipCr: number;
    readonly waitMinutes?: number;
}

/** A step offering mutually exclusive options (e.g. CUU line or hangar). */
export interface MissionChoiceGroup {
    readonly id: string;
    readonly kind: 'choice';
    readonly label: string;
    readonly options: readonly MissionChoiceOption[];
}

export type MissionGroup = MissionItemsGroup | MissionCrOnlyGroup | MissionChoiceGroup;

export interface MissionStep {
    readonly number: number;
    readonly title: string;
    readonly groups: readonly MissionGroup[];
}

/** Persisted progress. Kept dependency-free so it can be replaced by a WS-driven
 * source later without touching aggregation or UI. */
export interface MissionProgress {
    readonly completedSteps: readonly number[];
    readonly completedGroupIds: readonly string[];
    readonly skippedGroupIds: readonly string[];
    readonly selectedChoices: Readonly<Record<string, string>>;
}

export const EMPTY_MISSION_PROGRESS: MissionProgress = {
    completedSteps: [],
    completedGroupIds: [],
    skippedGroupIds: [],
    selectedChoices: {},
};

export interface InventoryQuantity {
    readonly name: string;
    readonly quantity: number;
    readonly itemConfigId: string | null;
}

export interface ItemShortage {
    readonly key: string;
    readonly name: string;
    readonly required: number;
    readonly owned: number;
    readonly missing: number;
    /** Whether any requirement used an exact itemConfigId match. */
    readonly exactMatch: boolean;
    /** Group ids this item contributes to (for UI cross-reference). */
    readonly groupIds: readonly string[];
}

export interface StepItemGroupView {
    readonly groupId: string;
    readonly label: string;
    readonly skipCr: number;
    readonly done: boolean;
    readonly skipped: boolean;
    readonly items: readonly {
        readonly name: string;
        readonly required: number;
        readonly owned: number;
        readonly missing: number;
        readonly exactMatch: boolean;
    }[];
}

export interface StepCrOnlyView {
    readonly groupId: string;
    readonly label: string;
    readonly requiredCr: number;
    readonly waitMinutes: number | null;
    readonly done: boolean;
}

export interface StepChoiceView {
    readonly groupId: string;
    readonly label: string;
    readonly selectedKey: string | null;
    readonly options: readonly {
        readonly key: string;
        readonly label: string;
        readonly skipCr: number;
        readonly waitMinutes: number | null;
    }[];
}

export interface MissionStepView {
    readonly number: number;
    readonly title: string;
    readonly completed: boolean;
    readonly itemGroups: readonly StepItemGroupView[];
    readonly crOnlyGroups: readonly StepCrOnlyView[];
    readonly choiceGroups: readonly StepChoiceView[];
}

export interface MissionSummary {
    readonly totalSteps: number;
    readonly completedSteps: number;
    /** CR that must be handed in for unfinished CR-only groups. */
    readonly requiredCr: number;
    /** CR needed to skip all unfinished item groups. */
    readonly skippableCr: number;
    /** Number of distinct items still missing. */
    readonly missingKinds: number;
    /** Items whose requirements have no itemConfigId yet. */
    readonly unmatchedKinds: number;
}

export interface MissionViewModel {
    readonly steps: readonly MissionStepView[];
    readonly shortages: readonly ItemShortage[];
    readonly summary: MissionSummary;
}
