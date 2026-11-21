import { DroneMissionPage } from '../../pages/DroneMissionPage.js';
import type { DroneMissionTrackerState } from '../hooks/useDroneMissionTracker.js';

export interface DroneMissionPanelProps {
    readonly tracker: DroneMissionTrackerState;
    readonly inventoryStatus: string;
    readonly inventoryBusy: boolean;
    readonly onRefreshInventory: () => void;
}

export function DroneMissionPanel({ tracker, inventoryStatus, inventoryBusy, onRefreshInventory }: DroneMissionPanelProps) {
    return (
        <DroneMissionPage
            tracker={tracker}
            inventoryStatus={inventoryStatus}
            inventoryBusy={inventoryBusy}
            onRefreshInventory={onRefreshInventory}
        />
    );
}
