import { DroneMissionPage } from '../../pages/DroneMissionPage.js';
import type { DroneMissionTrackerState } from '../hooks/useDroneMissionTracker.js';
import type { SettingsState } from '../hooks/useSettings.js';

export interface DroneMissionPanelProps {
    readonly tracker: DroneMissionTrackerState;
    readonly inventoryStatus: string;
    readonly inventoryBusy: boolean;
    readonly onRefreshInventory: () => void;
    readonly settings: SettingsState;
}

export function DroneMissionPanel({ tracker, inventoryStatus, inventoryBusy, onRefreshInventory, settings }: DroneMissionPanelProps) {
    return (
        <DroneMissionPage
            tracker={tracker}
            inventoryStatus={inventoryStatus}
            inventoryBusy={inventoryBusy}
            onRefreshInventory={onRefreshInventory}
            panelOpen={settings.panelOpen}
            onPanelOpenChange={settings.updatePanelOpen}
        />
    );
}
