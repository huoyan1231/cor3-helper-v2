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

function port(configure: ReturnType<typeof vi.fn>, price = 100, rank: string | null = null): ExpeditionPort {
    return {
        getActive: async () => ({ ok: true, value: [] }),
        getArchived: async () => ({ ok: true, value: [] }),
        getMercenaries: async () => ({ ok: true, value: { mercenaries: [{ id: 'merc-1', name: 'Merc', price, rank }] } }),
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

    it('insures veterans regardless of price threshold when insureVeterans is on', async () => {
        const configure = vi.fn().mockResolvedValue({ ok: true, value: { totalCost: 250 } });
        const service = new ExpeditionService(port(configure, 100, 'VETERAN'), async () => undefined);
        const result = await service.candidates({
            marketId: 'home',
            marketKey: 'core',
            hasInsurance: false,
            insuranceMinPriceEnabled: true,
            insuranceMinPrice: 10000,
            insureVeterans: true,
            locations,
        });
        expect(configure).toHaveBeenCalledWith(expect.objectContaining({ hasInsurance: true }));
        if (result.ok) expect(result.value[0]?.insurance).toBe(true);
    });

    it('does not insure non-veterans via insureVeterans', async () => {
        const configure = vi.fn().mockResolvedValue({ ok: true, value: { totalCost: 250 } });
        const service = new ExpeditionService(port(configure, 100, 'ELITE'), async () => undefined);
        const result = await service.candidates({
            marketId: 'home',
            marketKey: 'core',
            hasInsurance: false,
            insuranceMinPriceEnabled: true,
            insuranceMinPrice: 10000,
            insureVeterans: true,
            locations,
        });
        expect(configure).toHaveBeenCalledWith(expect.objectContaining({ hasInsurance: false }));
        if (result.ok) expect(result.value[0]?.insurance).toBe(false);
    });
});

describe('ExpeditionService auto decisions', () => {
    function decisionPort(respond: ReturnType<typeof vi.fn>): ExpeditionPort {
        return {
            getActive: async () => ({
                ok: true,
                value: {
                    expeditions: [],
                    decisions: [{
                        id: 'decision-1',
                        expeditionId: 'exp-1',
                        content: 'Pick',
                        riskScore: 20,
                        decisionDeadline: new Date(Date.now() + 60_000).toISOString(),
                        decisionOptions: [
                            { id: 'safe', label: 'Safe', lootModifier: 1, riskModifier: -5 },
                            { id: 'loot', label: 'Loot', lootModifier: 5, riskModifier: 3 },
                        ],
                    }],
                },
            }),
            getArchived: async () => ({ ok: true, value: {} }),
            getMercenaries: async () => ({ ok: true, value: {} }),
            getConfig: async () => ({ ok: true, value: {} }),
            respond,
            configure: async () => ({ ok: true, value: {} }),
            launch: async () => ({ ok: true, value: undefined }),
            openContainer: async () => ({ ok: true, value: undefined }),
        };
    }

    it('uses score mode and responds with the highest-scoring option', async () => {
        const respond = vi.fn(async () => ({ ok: true as const, value: undefined }));
        const service = new ExpeditionService(decisionPort(respond), async () => undefined);
        const result = await service.autoRespond('home', { policy: 'off', mode: 'score', weights: { loot: 1, risk: -5 } });

        expect(result.ok).toBe(true);
        expect(respond).toHaveBeenCalledWith('exp-1', 'decision-1', 'safe');
    });
});

describe('ExpeditionService insurance candidates', () => {
    it('carries the requested insurance into configure and the selected candidate', async () => {
        const configure = vi.fn().mockResolvedValue({ ok: true, value: { totalCost: 250, hasInsurance: true } });
        const service = new ExpeditionService(port(configure), async () => undefined);
        const result = await service.candidates({
            marketId: 'home',
            marketKey: 'core',
            hasInsurance: true,
            locations,
            locationConfigId: 'loc-a',
            zoneConfigId: 'zone-a',
            goalId: 'goal-b',
        });

        expect(configure).toHaveBeenCalledWith(expect.objectContaining({ hasInsurance: true }));
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value[0]).toMatchObject({ insurance: true, totalCost: 250 });
    });
});

describe('expedition payout state', () => {
    function payoutPort(openContainer: ExpeditionPort['openContainer']): ExpeditionPort {
        return {
            getActive: async () => ({
                ok: true as const,
                value: {
                    expeditions: [
                        { id: 'paid', status: 'COMPLETED', containerOpenedAt: '2026-11-27T10:00:00.000Z' },
                        { id: 'unpaid', status: 'COMPLETED', containerOpenedAt: null },
                    ],
                },
            }),
            getArchived: async () => ({ ok: true as const, value: {} }),
            getMercenaries: async () => ({ ok: true as const, value: {} }),
            getConfig: async () => ({ ok: true as const, value: {} }),
            respond: async () => ({ ok: true as const, value: undefined }),
            configure: async () => ({ ok: true as const, value: {} }),
            launch: async () => ({ ok: true as const, value: undefined }),
            openContainer,
        };
    }

    it('does not treat an already collected expedition as ready', async () => {
        const service = new ExpeditionService(payoutPort(async () => ({ ok: true, value: undefined })));
        const ready = await service.readyExpeditions('home');
        expect(ready.ok).toBe(true);
        if (ready.ok) expect(ready.value.map((entry) => entry.id)).toEqual(['unpaid']);
    });

    it('treats expired loot as settled instead of blocking later launches', async () => {
        const service = new ExpeditionService(payoutPort(async () => ({
            ok: false,
            error: { code: 'EXPEDITION_FAILED', message: 'Loot has expired' },
        })));
        const result = await service.payout('home');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toMatchObject({ ready: 1, opened: 1, failed: [] });
            expect(result.value.payouts[0]).toMatchObject({ expeditionId: 'unpaid', opened: true, error: null });
        }
    });

    it('treats "already fully collected" as a successful payment instead of blocking the cycle', async () => {
        const service = new ExpeditionService(payoutPort(async () => ({
            ok: false,
            error: { code: 'EXPEDITION_FAILED', message: 'Expedition already fully collected' },
        })));
        const result = await service.payout('home');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toMatchObject({ ready: 1, opened: 1, failed: [] });
            expect(result.value.payouts[0]).toMatchObject({ expeditionId: 'unpaid', opened: true, error: null });
        }
    });
});

describe('ExpeditionService payout details', () => {
    function payoutPort(openContainer: ExpeditionPort['openContainer']): ExpeditionPort {
        return {
            getActive: async () => ({
                ok: true,
                value: {
                    expeditions: [{
                        id: 'exp-1',
                        status: 'COMPLETED',
                        outcome: 'FULL_SUCCESS',
                        riskScore: 91,
                    }],
                },
            }),
            getArchived: async () => ({ ok: true, value: {} }),
            getMercenaries: async () => ({ ok: true, value: {} }),
            getConfig: async () => ({ ok: true, value: {} }),
            respond: async () => ({ ok: true, value: undefined }),
            configure: async () => ({ ok: true, value: {} }),
            launch: async () => ({ ok: true, value: undefined }),
            openContainer,
        };
    }

    it('keeps the loot and final risk from the payment response', async () => {
        const service = new ExpeditionService(payoutPort(async () => ({
            ok: true,
            value: {
                id: 'exp-1',
                riskScore: 94,
                outcome: 'FULL_SUCCESS',
                completedAt: '2026-11-27T10:00:00.000Z',
                containerData: [
                    { name: 'Artificial milk', quantity: 1, tier: 'RARE' },
                    { name: 'CCS "Kaloshi" Utility boots', quantity: 1, tier: 'EPIC' },
                ],
            },
        })));
        const result = await service.payout('home');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toMatchObject({ ready: 1, opened: 1, failed: [] });
            expect(result.value.payouts[0]).toMatchObject({
                expeditionId: 'exp-1',
                riskScore: 94,
                outcome: 'FULL_SUCCESS',
                opened: true,
                error: null,
            });
            expect(result.value.payouts[0]?.items.map((item) => item.name)).toEqual([
                'Artificial milk',
                'CCS "Kaloshi" Utility boots',
            ]);
        }
    });

    it('records a failed payment without loot', async () => {
        const service = new ExpeditionService(payoutPort(async () => ({
            ok: false,
            error: { code: 'EXPEDITION_FAILED', message: 'insufficient-credits' },
        })));
        const result = await service.payout('home');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toMatchObject({ ready: 1, opened: 0 });
            expect(result.value.payouts[0]).toMatchObject({
                expeditionId: 'exp-1',
                items: [],
                opened: false,
                error: 'insufficient-credits',
            });
        }
    });
});
