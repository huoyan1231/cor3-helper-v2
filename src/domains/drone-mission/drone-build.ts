/**
 * Pure, dependency-free types for the game's `drone-build` WebSocket snapshot.
 *
 * The game emits two frames that together describe the 15-step build quest:
 *   - `list.history`: one row per step (step number, title, note, status and
 *     completed/total subtask counts).
 *   - `get.page`: the current step and its detailed subtasks, each carrying the
 *     authoritative `itemConfigId`s, required quantities and CR buy costs.
 *
 * Nothing in this file touches Zod or the browser. Boundary parsing lives in
 * contracts; these types are what domain computation and the UI consume.
 */

export type DroneBuildStepStatus = 'COMPLETED' | 'ACTIVE' | 'LOCKED';

export interface DroneBuildHistoryStep {
    readonly step: number;
    readonly title: string;
    readonly note: string;
    readonly status: DroneBuildStepStatus;
    readonly completedSubtasks: number;
    readonly totalSubtasks: number;
}

export interface DroneBuildBarterItem {
    readonly itemConfigId: string;
    readonly title: string;
    readonly requiredQuantity: number;
    readonly availableQuantity: number;
}

export interface DroneBuildSubtask {
    readonly key: string;
    readonly title: string;
    readonly status: string;
    /** `BUY` = pay CR, `BARTER` = hand in items, null = no choice yet. */
    readonly variant: string | null;
    readonly buyCost: number;
    readonly barterItems: readonly DroneBuildBarterItem[];
}

export interface DroneBuildSnapshot {
    readonly currentStep: number;
    readonly status: string;
    readonly workshopChoice: string | null;
    readonly steps: readonly DroneBuildHistoryStep[];
    /** Only the current step's subtasks carry itemConfigId data. */
    readonly currentStepSubtasks: readonly DroneBuildSubtask[];
    /** Completed subtasks across all steps, including the chosen variant. */
    readonly completedSubtasks: readonly {
        readonly stepNumber: number;
        readonly subtaskKey: string;
        readonly variant: string | null;
    }[];
    readonly capturedAt: number;
}

/** Empty snapshot used when the game has not emitted any drone-build frame yet. */
export const EMPTY_DRONE_BUILD_SNAPSHOT: DroneBuildSnapshot = {
    currentStep: 0,
    status: 'UNKNOWN',
    workshopChoice: null,
    steps: [],
    currentStepSubtasks: [],
    completedSubtasks: [],
    capturedAt: 0,
};
