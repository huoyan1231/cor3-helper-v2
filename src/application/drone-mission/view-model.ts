import { computeDroneMission, DRONE_MISSION_STEPS } from '../../domains/drone-mission/index.js';
import type { InventoryQuantity, MissionProgress, MissionViewModel } from '../../domains/drone-mission/index.js';
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

export function buildDroneMissionViewModel(
    inventoryItems: readonly InventoryItemView[],
    progress: MissionProgress,
): MissionViewModel {
    return computeDroneMission(toInventoryQuantities(inventoryItems), progress, DRONE_MISSION_STEPS);
}
