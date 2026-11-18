import { describe, expect, it, vi } from 'vitest';
import { ExpeditionService, totalCostInfo, type ExpeditionPort } from './service.js';
import type { ExpeditionLocation } from '../../domains/expeditions/model.js';

const locations: ExpeditionLocation[] = [{
    id: 'loc-a',
    name: 'Location A',
    zones: [{
        id: 'zone-a',
        name: 'Zone A',
        goals: [
            { id: 'goal-a', name: 'Goal A' },
            { id: 'goal-b', name: 'Goal B' },
        ],
    }],
}];

function port(configure: ReturnType<typeof vi.fn>, price = 100): ExpeditionPort {
    return {
        getActive: async () => ({ ok: true, value: [] }),
        getArchived: async () => ({ ok: true, value: [] }),
        getMercenaries: async () => ({ ok: true, value: { mercenaries: [{ id: 'merc-1', name: 'Merc', price }] } }),
        getConfig: async () => ({ ok: true, value: {} }),
        respond: async () => ({ ok: true, value: undefined }),
        configure,
        launch: async () => ({ ok: true, value: undefined }),
        openContainer: async () => ({ ok: true, value: undefined }),
    };
}

describe('totalCostInfo', () => {
    it('prefers an explicit nested totalCost over a root initial cost', () => {
        expect(totalCostInfo({ cost: 3000, selection: { totalCost: 5179 } })).toEqual({ total: 5179, explicit: true });
    });

    it('marks a price-only response as estimated', () => {
        expect(totalCostInfo({ mercenary: { price: 3000 } })).toEqual({ total: 3000, explicit: false });
    });
});

function autoRespondPort(rank: string | null, respond: ReturnType<typeof vi.fn>): ExpeditionPort {
    return {
        ...port(vi.fn()),
        getActive: async () => ({
            ok: true,
            value: {
                expeditions: [{
                    id: 'exp-1',
                    status: 'IN_PROGRESS',
                    mercenary: { callsign: 'Nova', rank },
                    messages: null,
                }],
                decisions: [{
                    id: 'msg-1',
                    expeditionId: 'exp-1',
                    message: 'Pick one',
                    isResolved: false,
                    options: [
                        { id: 'risky', label: 'Risky', riskModifier: 5, lootModifier: 1, successChance: 0.5, requiredModuleId: null },
                        { id: 'loot', label: 'Loot', riskModifier: 1, lootModifier: 5, successChance: 0.5, requiredModuleId: null },
                    ],
                }],
            },
        }),
        respond,
    };
}

describe('ExpeditionService autoRespond', () => {
    it('uses high-risk choices for veteran expeditions when the switch is on', async () => {
        const respond = vi.fn().mockResolvedValue({ ok: true, value: undefined });
        const service = new ExpeditionService(autoRespondPort('VETERAN', respond));
        const result = await service.autoRespond('home', { policy: 'loot', getRidOfVeterans: true });
        expect(result.ok && result.value).toBe(1);
        expect(respond).toHaveBeenCalledWith('exp-1', 'msg-1', 'risky');
    });

    it('keeps the configured policy for veteran expeditions when the switch is off', async () => {
        const respond = vi.fn().mockResolvedValue({ ok: true, value: undefined });
        const service = new ExpeditionService(autoRespondPort('VETERAN', respond));
        const result = await service.autoRespond('home', { policy: 'loot', getRidOfVeterans: false });
        expect(result.ok && result.value).toBe(1);
        expect(respond).toHaveBeenCalledWith('exp-1', 'msg-1', 'loot');
    });

    it('does not change non-veteran expeditions when the switch is on', async () => {
        const respond = vi.fn().mockResolvedValue({ ok: true, value: undefined });
        const service = new ExpeditionService(autoRespondPort('ELITE', respond));
        const result = await service.autoRespond('home', { policy: 'loot', getRidOfVeterans: true });
        expect(result.ok && result.value).toBe(1);
        expect(respond).toHaveBeenCalledWith('exp-1', 'msg-1', 'loot');
    });

    it('never responds when the decision policy is off', async () => {
        const respond = vi.fn().mockResolvedValue({ ok: true, value: undefined });
        const service = new ExpeditionService(autoRespondPort('VETERAN', respond));
        const result = await service.autoRespond('home', { policy: 'off', getRidOfVeterans: true });
        expect(result.ok && result.value).toBe(0);
        expect(respond).not.toHaveBeenCalled();
    });
});

describe('ExpeditionService candidates', () => {
    it('configures candidates with the requested location and goal', async () => {
        const configure = vi.fn().mockResolvedValue({ ok: true, value: { totalCost: 250, riskScore: 40 } });
        const service = new ExpeditionService(port(configure), async () => undefined);
        const result = await service.candidates({
            marketId: 'home',
            marketKey: 'core',
            hasInsurance: false,
            locations,
            locationConfigId: 'loc-a',
            zoneConfigId: 'zone-a',
            goalId: 'goal-b',
        });
        expect(result.ok).toBe(true);
        expect(configure).toHaveBeenCalledWith(expect.objectContaining({
            mercenaryId: 'merc-1',
            locationConfigId: 'loc-a',
            zoneConfigId: 'zone-a',
            goalId: 'goal-b',
        }));
        if (result.ok) expect(result.value[0]).toMatchObject({ totalCost: 250, riskScore: 40 });
    });

    it('uses the configured total cost instead of the initial hire cost', async () => {
        const configure = vi.fn().mockResolvedValue({ ok: true, value: { cost: 3000, selection: { totalCost: 5179 } } });
        const service = new ExpeditionService(port(configure), async () => undefined);
        const result = await service.candidates({
            marketId: 'home',
            marketKey: 'core',
            hasInsurance: false,
            locations,
            locationConfigId: 'loc-a',
            zoneConfigId: 'zone-a',
            goalId: 'goal-b',
        });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value[0]).toMatchObject({ totalCost: 5179, costEstimated: false });
    });

    it('keeps plain insurance behavior when the price condition is off', async () => {
        const configure = vi.fn().mockResolvedValue({ ok: true, value: { totalCost: 250 } });
        const service = new ExpeditionService(port(configure), async () => undefined);
        const result = await service.candidates({
            marketId: 'home',
            marketKey: 'core',
            hasInsurance: true,
            locations,
        });
        expect(configure).toHaveBeenCalledWith(expect.objectContaining({ hasInsurance: true }));
        if (result.ok) expect(result.value[0]?.insurance).toBe(true);
    });

    it('disables insurance at or below the configured hire price threshold', async () => {
        const configure = vi.fn().mockResolvedValue({ ok: true, value: { totalCost: 250 } });
        const service = new ExpeditionService(port(configure, 10000), async () => undefined);
        const result = await service.candidates({
            marketId: 'home',
            marketKey: 'core',
            hasInsurance: true,
            insuranceMinPriceEnabled: true,
            insuranceMinPrice: 10000,
            locations,
        });
        expect(configure).toHaveBeenCalledWith(expect.objectContaining({ hasInsurance: false }));
        if (result.ok) expect(result.value[0]?.insurance).toBe(false);
    });

    it('enables insurance above the configured hire price threshold', async () => {
        const configure = vi.fn().mockResolvedValue({ ok: true, value: { totalCost: 250 } });
        const service = new ExpeditionService(port(configure, 12000), async () => undefined);
        const result = await service.candidates({
            marketId: 'home',
            marketKey: 'core',
            hasInsurance: true,
            insuranceMinPriceEnabled: true,
            insuranceMinPrice: 10000,
            locations,
        });
        expect(configure).toHaveBeenCalledWith(expect.objectContaining({ hasInsurance: true }));
        if (result.ok) expect(result.value[0]?.insurance).toBe(true);
    });
});
