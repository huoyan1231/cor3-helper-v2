import { useEffect, useRef } from 'preact/hooks';
import type { PopupPortal } from '../../../application/popup/portal.js';
import type { DroneBuildView } from '../../../contracts/drone-build.js';
import type { SettingsState } from './useSettings.js';

/**
 * A captured live quest should reveal the Wings of Mars tab even when it is
 * hidden by default. A persisted snapshot alone does not count: it is only a
 * previous session's cache and must not undo a deliberate hide on every launch.
 */
export function shouldRevealWingsOfMars(view: DroneBuildView | null, hidden: boolean): boolean {
    return hidden && view?.source === 'live';
}

/**
 * Runs once per popup/session from the composition root, so it works even when
 * the tab is hidden and the tracker page is never mounted.
 */
export function useWingsOfMarsAutoReveal(portal: PopupPortal, settings: SettingsState): void {
    const checked = useRef(false);
    const settingsValue = settings.settings;

    useEffect(() => {
        if (checked.current || !settingsValue) return;
        checked.current = true;
        if (!settingsValue.hideWingsOfMars) return;

        void portal.droneBuildView().then((response) => {
            if (!shouldRevealWingsOfMars(response.ok ? response.value : null, settingsValue.hideWingsOfMars)) return;
            void portal.updateSettings({ hideWingsOfMars: false }).then((update) => {
                if (update.ok) settings.setSettings(update.value);
            });
        });
    }, [portal, settingsValue, settings.setSettings]);
}
