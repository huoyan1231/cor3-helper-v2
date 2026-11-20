import {
    computeDroneMission,
    DRONE_MISSION_STEPS,
    progressFromDroneBuild,
    shouldPreferWsProgress,
    EMPTY_WS_STATUS,
} from '../../domains/drone-mission/index.js';
import type {
    DroneBuildSnapshot,
    InventoryQuantity,
    MissionProgress,
    MissionViewModel,
    MissionWsStatus,
} from '../../domains/drone-mission/index.js';
import type { InventoryItemView } from '../popup/portal.js';

/** Map the existing inventory.view items to the minimal shape the mission
 * computation needs, skipping entries with a non-positive quantity. */
export function toInventoryQuantities(items: readonly InventoryItemView[]): readonly InventoryQuantity[] {
    return items
        .filter((entry) => entry.quantity > 0)
        .map((entry) => ({
            name: entry.name,
            quantity: entry.quantity,
            itemConfigId: entry.itemConfigId,
        }));
}

function wsStatus(snapshot: DroneBuildSnapshot | null, automatic: boolean): MissionWsStatus {
    if (!automatic || !snapshot) return EMPTY_WS_STATUS;
    const currentSubtaskVariants: Record<string, string | null> = {};
    for (const subtask of snapshot.currentStepSubtasks) {
        currentSubtaskVariants[subtask.key] = subtask.variant;
    }
    return {
        automatic: true,
        currentStep: snapshot.currentStep,
        capturedAt: snapshot.capturedAt,
        currentSubtaskVariants,
    };
}

export interface BuildViewModelOptions {
    /** Manual checkbox progress; used when no live WS progress is available. */
    readonly manualProgress: MissionProgress;
    /** Snapshot captured from the game's drone-build WS frames. */
    readonly snapshot?: DroneBuildSnapshot | null;
}

export function buildDroneMissionViewModel(
    inventoryItems: readonly InventoryItemView[],
    options: BuildViewModelOptions | MissionProgress,
): MissionViewModel {
    // Backward-compatible: a bare MissionProgress behaves as before.
    const opts: BuildViewModelOptions = 'manualProgress' in options
        ? options
        : { manualProgress: options };
    const snapshot = opts.snapshot ?? null;
    const wsProgress = progressFromDroneBuild(snapshot, DRONE_MISSION_STEPS);
    const automatic = shouldPreferWsProgress(snapshot) && wsProgress !== null;
    const progress = automatic && wsProgress ? wsProgress : opts.manualProgress;
    return computeDroneMission(
        toInventoryQuantities(inventoryItems),
        progress,
        DRONE_MISSION_STEPS,
        wsStatus(snapshot, automatic),
    );
}
