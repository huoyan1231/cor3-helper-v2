import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { PopupPortal } from '../../../application/popup/portal.js';
import { buildDroneMissionViewModel } from '../../../application/drone-mission/view-model.js';
import { EMPTY_MISSION_PROGRESS, type MissionProgress } from '../../../domains/drone-mission/index.js';
import type { DroneBuildView } from '../../../contracts/drone-build.js';
import type { InventoryItemView } from '../../../application/popup/portal.js';
import type { SettingsState } from './useSettings.js';

export interface DroneMissionTrackerState {
    readonly progress: MissionProgress;
    readonly viewModel: ReturnType<typeof buildDroneMissionViewModel>;
    readonly wsView: DroneBuildView | null;
    readonly busy: boolean;
    readonly error: string | null;
    readonly reloadWs: () => Promise<void>;
    readonly toggleStep: (step: number) => Promise<void>;
    readonly toggleGroup: (groupId: string) => Promise<void>;
    readonly toggleSkip: (groupId: string) => Promise<void>;
    readonly selectChoice: (groupId: string, key: string) => Promise<void>;
    readonly clear: () => Promise<void>;
}

function toggleInList(list: readonly number[], value: number): readonly number[] {
    return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function toggleInStrings(list: readonly string[], value: string): readonly string[] {
    return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export function useDroneMissionTracker(
    portal: PopupPortal,
    settings: SettingsState,
    inventoryItems: readonly InventoryItemView[],
): DroneMissionTrackerState {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [wsView, setWsView] = useState<DroneBuildView | null>(null);

    const stored = settings.settings?.droneMissionTracker;
    const progress: MissionProgress = useMemo(() => ({
        completedSteps: stored?.completedSteps ?? EMPTY_MISSION_PROGRESS.completedSteps,
        completedGroupIds: stored?.completedGroupIds ?? EMPTY_MISSION_PROGRESS.completedGroupIds,
        skippedGroupIds: stored?.skippedGroupIds ?? EMPTY_MISSION_PROGRESS.skippedGroupIds,
        selectedChoices: stored?.selectedChoices ?? EMPTY_MISSION_PROGRESS.selectedChoices,
    }), [stored]);

    const reloadWs = useCallback(async () => {
        const response = await portal.droneBuildView();
        if (response.ok) setWsView(response.value);
    }, [portal]);

    useEffect(() => {
        void reloadWs();
    }, [reloadWs]);

    const viewModel = useMemo(
        () => buildDroneMissionViewModel(inventoryItems, { manualProgress: progress, view: wsView }),
        [inventoryItems, progress, wsView],
    );

    const persist = useCallback(async (next: MissionProgress) => {
        setBusy(true);
        setError(null);
        try {
            const response = await portal.updateSettings({ droneMissionTracker: next });
            if (response.ok) settings.setSettings(response.value);
            else setError(response.error.message);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setBusy(false);
        }
    }, [portal, settings]);

    const toggleStep = useCallback((step: number) => persist({
        ...progress,
        completedSteps: toggleInList(progress.completedSteps, step),
    }), [persist, progress]);

    const toggleGroup = useCallback((groupId: string) => persist({
        ...progress,
        completedGroupIds: toggleInStrings(progress.completedGroupIds, groupId),
    }), [persist, progress]);

    const toggleSkip = useCallback((groupId: string) => persist({
        ...progress,
        skippedGroupIds: toggleInStrings(progress.skippedGroupIds, groupId),
    }), [persist, progress]);

    const selectChoice = useCallback((groupId: string, key: string) => persist({
        ...progress,
        selectedChoices: { ...progress.selectedChoices, [groupId]: key },
    }), [persist, progress]);

    const clear = useCallback(() => persist(EMPTY_MISSION_PROGRESS), [persist]);

    return { progress, viewModel, wsView, busy, error, reloadWs, toggleStep, toggleGroup, toggleSkip, selectChoice, clear };
}
