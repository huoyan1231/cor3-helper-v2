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
    MissionDiagnostics,
    MissionProgress,
    MissionViewModel,
    MissionWsStatus,
} from '../../domains/drone-mission/index.js';
import type { DroneBuildView } from '../../contracts/drone-build.js';
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

function diagnosticsFrom(view: DroneBuildView | null): MissionDiagnostics {
    if (!view || !view.snapshot) {
        return { source: 'none', capturedAt: 0, storedAt: view?.storedAt ?? null, hasHistory: false, hasPage: false, detectedCompletedSteps: 0 };
    }
    const snapshot = view.snapshot;
    return {
        source: view.source,
        capturedAt: snapshot.capturedAt,
        storedAt: view.storedAt,
        hasHistory: snapshot.steps.length > 0,
        hasPage: snapshot.currentStep > 0 || snapshot.currentStepSubtasks.length > 0,
        detectedCompletedSteps: snapshot.steps.filter((step) => step.status === 'COMPLETED').length,
    };
}

export interface BuildViewModelOptions {
    /** Manual checkbox progress; used when no live WS progress is available. */
    readonly manualProgress: MissionProgress;
    /** Drone-build view (live/persisted/none) from the portal. */
    readonly view?: DroneBuildView | null;
    /** Deprecated alias kept for callers that only have a snapshot. */
    readonly snapshot?: DroneBuildSnapshot | null;
}

/** The progress the page actually renders (WS-driven when available). */
export function effectiveMissionProgress(options: BuildViewModelOptions): MissionProgress {
    const snapshot = options.view?.snapshot ?? options.snapshot ?? null;
    const wsProgress = progressFromDroneBuild(snapshot, DRONE_MISSION_STEPS);
    return shouldPreferWsProgress(snapshot) && wsProgress ? wsProgress : options.manualProgress;
}

export function buildDroneMissionViewModel(
    inventoryItems: readonly InventoryItemView[],
    options: BuildViewModelOptions | MissionProgress,
): MissionViewModel {
    // Backward-compatible: a bare MissionProgress behaves as before.
    const opts: BuildViewModelOptions = 'manualProgress' in options
        ? options
        : { manualProgress: options };
    const view = opts.view ?? null;
    const snapshot = view?.snapshot ?? opts.snapshot ?? null;
    const progress = effectiveMissionProgress(opts);
    const wsProgress = progressFromDroneBuild(snapshot, DRONE_MISSION_STEPS);
    const automatic = shouldPreferWsProgress(snapshot) && wsProgress !== null;
    const result = computeDroneMission(
        toInventoryQuantities(inventoryItems),
        progress,
        DRONE_MISSION_STEPS,
        wsStatus(snapshot, automatic),
    );
    return { ...result, diagnostics: diagnosticsFrom(view) };
}
