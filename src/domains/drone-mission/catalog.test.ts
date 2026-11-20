import { describe, expect, it } from 'vitest';
import { DRONE_MISSION_STEPS } from './catalog.js';

describe('drone mission catalog', () => {
    it('has 15 steps with continuous numbering', () => {
        expect(DRONE_MISSION_STEPS).toHaveLength(15);
        expect(DRONE_MISSION_STEPS.map((step) => step.number)).toEqual(
            Array.from({ length: 15 }, (_, index) => index + 1),
        );
    });

    it('every step carries a WS title and Chinese note', () => {
        for (const step of DRONE_MISSION_STEPS) {
            expect(step.title.length).toBeGreaterThan(0);
            expect(step.note?.length ?? 0).toBeGreaterThan(0);
        }
    });

    it('step 7 has confirmed itemConfigIds from the live get.page frame', () => {
        const step7 = DRONE_MISSION_STEPS.find((step) => step.number === 7);
        const ids = (step7?.groups ?? []).flatMap((group) =>
            group.kind === 'items' ? group.items.flatMap((entry) => entry.itemConfigId ? [entry.itemConfigId] : []) : []);
        expect(ids).toContain('019d719f-84f4-71e8-a58e-983a7207e73e');
        expect(ids).toContain('019d719f-84f4-7114-bd53-7867ad546099');
        expect(ids.length).toBeGreaterThanOrEqual(5);
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
