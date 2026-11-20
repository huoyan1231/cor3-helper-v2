import type { DroneBuildSnapshot, MissionProgress, MissionStep } from './index.js';

/**
 * Derive mission progress from a live drone-build snapshot. Progress is a
 * dependency-free "source of truth"; swapping the manual checkbox source for
 * this WS-driven one does not touch compute.ts or the UI.
 *
 * Returns null when there is no usable snapshot (no game frames captured yet),
 * so callers can keep manual progress as a fallback.
 */
export function progressFromDroneBuild(
    snapshot: DroneBuildSnapshot | null,
    steps: readonly MissionStep[],
): MissionProgress | null {
    if (!snapshot || (snapshot.steps.length === 0 && snapshot.currentStep === 0)) return null;

    const completedSteps = snapshot.steps
        .filter((step) => step.status === 'COMPLETED')
        .map((step) => step.step);

    // Map subtask keys (e.g. `7C`) to the group that carries that key.
    const groupIdBySubtask = new Map<string, string>();
    for (const step of steps) {
        for (const group of step.groups) {
            if (group.subtaskKey) groupIdBySubtask.set(group.subtaskKey, group.id);
        }
    }

    const completedGroupIds = new Set<string>();
    for (const subtask of snapshot.completedSubtasks) {
        const groupId = groupIdBySubtask.get(subtask.subtaskKey);
        if (groupId) completedGroupIds.add(groupId);
    }

    const selectedChoices: Record<string, string> = {};
    if (snapshot.workshopChoice) {
        const choice = snapshot.workshopChoice.toLowerCase();
        const step2 = steps.find((step) => step.number === 2);
        const choiceGroup = step2?.groups.find((group) => group.kind === 'choice');
        if (choiceGroup && choiceGroup.kind === 'choice') {
            if (choiceGroup.options.some((option) => option.key === choice)) {
                selectedChoices[choiceGroup.id] = choice;
            }
        }
    }

    return {
        completedSteps: [...new Set(completedSteps)],
        completedGroupIds: [...completedGroupIds],
        skippedGroupIds: [],
        selectedChoices,
    };
}

/**
 * Whether the WS snapshot should take precedence over manual progress. It does
 * once the game has reported at least one completed step or an active step.
 */
export function shouldPreferWsProgress(snapshot: DroneBuildSnapshot | null): boolean {
    if (!snapshot) return false;
    return snapshot.steps.some((step) => step.status === 'COMPLETED' || step.status === 'ACTIVE');
}
