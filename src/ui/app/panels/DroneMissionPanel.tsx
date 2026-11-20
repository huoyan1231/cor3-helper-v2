import type { PopupPortal } from '../../../application/popup/portal.js';
import { DroneMissionPage } from '../../pages/DroneMissionPage.js';
import { useDroneMissionTracker } from '../hooks/useDroneMissionTracker.js';
import type { InventoryState } from '../hooks/useInventory.js';
import type { SettingsState } from '../hooks/useSettings.js';

export interface DroneMissionPanelProps {
    readonly portal: PopupPortal;
    readonly settings: SettingsState;
    readonly inventory: InventoryState;
}

export function DroneMissionPanel({ portal, settings, inventory }: DroneMissionPanelProps) {
    const tracker = useDroneMissionTracker(portal, settings, inventory.inventoryItems);
    return (
        <DroneMissionPage
            tracker={tracker}
            inventoryStatus={inventory.inventoryStatus}
            inventoryBusy={inventory.inventoryBusy}
            onRefreshInventory={() => void inventory.loadInventory()}
        />
    );
}
