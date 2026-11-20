import { describe, expect, it } from 'vitest';
import { DRONE_MISSION_STEPS } from './catalog.js';

describe('drone mission catalog', () => {
    it('has 14 steps with continuous numbering', () => {
        expect(DRONE_MISSION_STEPS).toHaveLength(14);
        expect(DRONE_MISSION_STEPS.map((step) => step.number)).toEqual(
            Array.from({ length: 14 }, (_, index) => index + 1),
        );
    });

    it('has unique group ids', () => {
        const ids = DRONE_MISSION_STEPS.flatMap((step) => step.groups.map((group) => group.id));
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('every item group has items and a skip cost', () => {
        for (const step of DRONE_MISSION_STEPS) {
            for (const group of step.groups) {
                if (group.kind === 'items') {
                    expect(group.items.length).toBeGreaterThan(0);
                    expect(group.skipCr).toBeGreaterThan(0);
                    for (const entry of group.items) {
                        expect(entry.quantity).toBeGreaterThan(0);
                    }
                }
            }
        }
    });

    it('every choice has at least two options with unique keys', () => {
        for (const step of DRONE_MISSION_STEPS) {
            for (const group of step.groups) {
                if (group.kind === 'choice') {
                    expect(group.options.length).toBeGreaterThanOrEqual(2);
                    expect(new Set(group.options.map((option) => option.key)).size).toBe(group.options.length);
                }
            }
        }
    });

    it('CR-only groups always carry a positive requiredCr', () => {
        for (const step of DRONE_MISSION_STEPS) {
            for (const group of step.groups) {
                if (group.kind === 'cr-only') expect(group.requiredCr).toBeGreaterThan(0);
            }
        }
    });
});
