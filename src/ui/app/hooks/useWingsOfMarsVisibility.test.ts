import { describe, expect, it } from 'vitest';
import type { DroneBuildView } from '../../../contracts/drone-build.js';
import type { DroneState } from '../../../domains/drone/model.js';
import { hasDroneVitals, hasLiveBuild } from './useWingsOfMarsVisibility.js';

const droneView = (source: DroneBuildView['source']): DroneBuildView => ({
    snapshot: null,
    source,
    storedAt: null,
});

const stateWith = (drone: DroneState['drone']): DroneState => ({
    drone,
    battery: drone?.battery ?? 0,
    maxBattery: drone?.maxBattery ?? 0,
    activeMissionId: null,
    missions: [],
    archived: [],
});

const builtDrone = {
    id: 'd1',
    name: 'Drone',
    durability: 100,
    maxDurability: 100,
    battery: 50,
    maxBattery: 100,
    repairing: false,
    destroyed: false,
    repairSecondsRemaining: null,
};

describe('hasDroneVitals', () => {
    it('is true only when the drone reports both durability and battery capacity', () => {
        expect(hasDroneVitals(stateWith(builtDrone))).toBe(true);
    });

    it('is false when no drone was ever built', () => {
        expect(hasDroneVitals(stateWith(null))).toBe(false);
        expect(hasDroneVitals(null)).toBe(false);
    });

    it('is false when durability or battery capacity is missing', () => {
        expect(hasDroneVitals(stateWith({ ...builtDrone, maxDurability: 0 }))).toBe(false);
        expect(hasDroneVitals(stateWith({ ...builtDrone, maxBattery: 0 }))).toBe(false);
    });
});

describe('hasLiveBuild', () => {
    it('is true only for a live build snapshot', () => {
        expect(hasLiveBuild(droneView('live'))).toBe(true);
    });

    it('is false for persisted, none or missing snapshots', () => {
        expect(hasLiveBuild(droneView('persisted'))).toBe(false);
        expect(hasLiveBuild(droneView('none'))).toBe(false);
        expect(hasLiveBuild(null)).toBe(false);
    });
});
