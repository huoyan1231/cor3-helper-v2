import type { MaintenanceForceProgress, ValuableOperation, ValuableProgress, ValuableRunState } from '../../../application/popup/portal.js';

export interface ReportRunState {
    readonly runId: string | null;
    readonly operation: ValuableOperation | null;
    readonly progress: ValuableProgress | MaintenanceForceProgress | null;
}

/**
 * A completed background run leaves `active: null`; adopting only truthy
 * active states would keep the UI's `runId` stuck and disable every action.
 * While a local run is starting, the report must not clobber its optimistic
 * state, so return null to mean "leave current state alone".
 */
export function resolveReportRunState(
    active: ValuableRunState | null,
    localStartInProgress: boolean,
): ReportRunState | null {
    if (localStartInProgress) return null;
    if (active) return { runId: active.runId, operation: active.operation, progress: active.progress };
    return { runId: null, operation: null, progress: null };
}
