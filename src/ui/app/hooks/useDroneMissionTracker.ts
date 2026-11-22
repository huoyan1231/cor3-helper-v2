import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { PopupPortal } from '../../../application/popup/portal.js';
import { buildDroneMissionViewModel, effectiveMissionProgress } from '../../../application/drone-mission/view-model.js';
import {
    DRONE_MISSION_STEPS,
    EMPTY_MISSION_PROGRESS,
    planMissionSurplusSell,
    type MissionProgress,
    type MissionSurplusSellPlan,
} from '../../../domains/drone-mission/index.js';
import type { DroneBuildView } from '../../../contracts/drone-build.js';
import type { InventoryItemView } from '../../../application/popup/portal.js';
import type { SettingsState } from './useSettings.js';

export interface DroneMissionTrackerState {
    readonly progress: MissionProgress;
    readonly viewModel: ReturnType<typeof buildDroneMissionViewModel>;
    readonly wsView: DroneBuildView | null;
    readonly busy: boolean;
    readonly error: string | null;
    readonly status: string | null;
    readonly surplusPlan: MissionSurplusSellPlan;
    readonly sellingSurplus: boolean;
    readonly sellSurplus: () => Promise<void>;
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
    reloadInventory: () => Promise<void>,
): DroneMissionTrackerState {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [wsView, setWsView] = useState<DroneBuildView | null>(null);
    const [sellingSurplus, setSellingSurplus] = useState(false);

    const stored = settings.settings?.droneMissionTracker;
    const progress: MissionProgress = useMemo(() => ({
        completedSteps: stored?.completedSteps ?? EMPTY_MISSION_PROGRESS.completedSteps,
        completedGroupIds: stored?.completedGroupIds ?? EMPTY_MISSION_PROGRESS.completedGroupIds,
        skippedGroupIds: stored?.skippedGroupIds ?? EMPTY_MISSION_PROGRESS.skippedGroupIds,
        selectedChoices: stored?.selectedChoices ?? EMPTY_MISSION_PROGRESS.selectedChoices,
    }), [stored]);

    const trackerOptions = useMemo(() => ({ manualProgress: progress, view: wsView }), [progress, wsView]);
    const viewModel = useMemo(
        () => buildDroneMissionViewModel(inventoryItems, trackerOptions),
        [inventoryItems, trackerOptions],
    );
    const surplusPlan = useMemo(
        () => planMissionSurplusSell(inventoryItems, DRONE_MISSION_STEPS, effectiveMissionProgress(trackerOptions)),
        [inventoryItems, trackerOptions],
    );

    const loadWs = useCallback(async (cachedOnly: boolean) => {
        const response = await portal.droneBuildView(cachedOnly);
        if (response.ok) setWsView(response.value);
    }, [portal]);

    const reloadWs = useCallback(async () => {
        await loadWs(false);
    }, [loadWs]);

    useEffect(() => {
        void (async () => {
            // Paint the persisted snapshot first, then refresh from the game.
            await loadWs(true);
            await loadWs(false);
        })();
    }, [loadWs]);

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

    const sellSurplus = useCallback(async () => {
        if (sellingSurplus || surplusPlan.entries.length === 0) return;
        setSellingSurplus(true);
        setError(null);
        setStatus(null);
        let soldQuantity = 0;
        let soldValue = 0;
        const failed: string[] = [];
        try {
            for (const entry of surplusPlan.entries) {
                const response = await portal.sellInventoryItem(entry.itemId, entry.quantity);
                if (response.ok) {
                    soldQuantity += response.value.quantity;
                    soldValue += response.value.sellValue;
                } else {
                    failed.push(`${entry.name}: ${response.error.message}`);
                }
            }
            await reloadInventory();
            const result = settings.tt('Sold {quantity} item(s) for {value} cr', { quantity: soldQuantity, value: soldValue });
            setStatus(result);
            setError(failed.length > 0 ? failed.join('; ') : null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setSellingSurplus(false);
        }
    }, [portal, sellingSurplus, surplusPlan, reloadInventory, settings.tt]);

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

    return {
        progress,
        viewModel,
        wsView,
        busy,
        error,
        status,
        surplusPlan,
        sellingSurplus,
        sellSurplus,
        reloadWs,
        toggleStep,
        toggleGroup,
        toggleSkip,
        selectChoice,
        clear,
    };
}
