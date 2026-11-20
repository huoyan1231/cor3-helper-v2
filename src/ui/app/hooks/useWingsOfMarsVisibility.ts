import { useEffect, useRef } from 'preact/hooks';
import type { PopupPortal } from '../../../application/popup/portal.js';
import type { DroneBuildView } from '../../../contracts/drone-build.js';
import type { DroneState } from '../../../domains/drone/model.js';
import type { SettingsState } from './useSettings.js';

/**
 * The drone reports durability and battery capacity only once it has been
 * built. Seeing both capacities means the Wings of Mars quest is complete.
 */
export function hasDroneVitals(drone: DroneState | null): boolean {
    const status = drone?.drone;
    if (!status) return false;
    return status.maxDurability > 0 && status.maxBattery > 0;
}

/** A live build snapshot means the player is still working through the quest. */
export function hasLiveBuild(view: DroneBuildView | null): boolean {
    return view?.source === 'live';
}

/**
 * Runs once per popup/session from the composition root so it works while the
 * tab is hidden. The drone query comes first: when the drone is already built
 * we hide the tab and skip the build query entirely, avoiding extra WS commands.
 */
export function useWingsOfMarsVisibility(portal: PopupPortal, settings: SettingsState): void {
    const checked = useRef(false);
    const settingsValue = settings.settings;

    useEffect(() => {
        if (checked.current || !settingsValue) return;
        checked.current = true;

        const apply = async (hidden: boolean): Promise<void> => {
            if (settingsValue.hideWingsOfMars === hidden) return;
            const update = await portal.updateSettings({ hideWingsOfMars: hidden });
            if (update.ok) settings.setSettings(update.value);
        };

        void (async () => {
            const droneRes = await portal.droneView();
            if (hasDroneVitals(droneRes.ok ? droneRes.value : null)) {
                await apply(true);
                return;
            }
            const buildRes = await portal.droneBuildView();
            if (hasLiveBuild(buildRes.ok ? buildRes.value : null)) {
                await apply(false);
            }
        })();
    }, [portal, settingsValue, settings.setSettings]);
}
