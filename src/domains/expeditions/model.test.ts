import { describe, expect, it } from 'vitest';
import { isExpeditionReady, isExpeditionSettled, type ActiveExpedition } from './model.js';

function expedition(overrides: Partial<ActiveExpedition> = {}): ActiveExpedition {
    return {
        id: 'exp-1',
        status: 'COMPLETED',
        locationName: 'Skylift Remains',
        mercenaryName: 'Nova',
        totalCost: null,
        riskScore: null,
        lootScore: null,
        hasInsurance: null,
        endsAt: null,
        ...overrides,
    };
}

describe('expedition payout state', () => {
    it('treats a completed expedition with no container opened as ready', () => {
        const entry = expedition({ containerOpenedAt: null });
        expect(isExpeditionSettled(entry)).toBe(false);
        expect(isExpeditionReady(entry)).toBe(true);
    });

    it('treats a completed expedition with an opened container as settled, not ready', () => {
        const entry = expedition({ containerOpenedAt: '2026-11-20T06:29:14.010Z', outcome: 'FULL_SUCCESS' });
        expect(isExpeditionSettled(entry)).toBe(true);
        expect(isExpeditionReady(entry)).toBe(false);
    });

    it('does not treat an empty containerOpenedAt string as settled', () => {
        const entry = expedition({ containerOpenedAt: '' });
        expect(isExpeditionSettled(entry)).toBe(false);
        expect(isExpeditionReady(entry)).toBe(true);
    });

    it('does not treat in-progress expeditions as ready', () => {
        const entry = expedition({ status: 'IN_PROGRESS', containerOpenedAt: null });
        expect(isExpeditionSettled(entry)).toBe(false);
        expect(isExpeditionReady(entry)).toBe(false);
    });
});
