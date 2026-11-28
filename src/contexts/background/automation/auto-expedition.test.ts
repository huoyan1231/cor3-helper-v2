import { describe, expect, it, vi } from 'vitest';
import { settingsV1Schema, type SettingsV1 } from '../../../contracts/storage.js';
import type { ExpeditionOverview } from '../../../domains/expeditions/model.js';
import { jobMarketByKey } from '../../../domains/jobs/markets.js';
import { AutomationStateStore } from '../../../infrastructure/storage/automation-state-store.js';
import { MemoryStorageArea } from '../../../infrastructure/storage/storage-area.js';
import { ok } from '../../../kernel/result.js';
import { AUTO_EXPEDITION_RETRY_ALARM } from './alarm-ids.js';
import { AutoExpeditionCoordinator } from './auto-expedition.js';
import { AUTO_EXPEDITION_CREDIT_WAIT_REASON } from './expedition-types.js';

const homeMarketId = jobMarketByKey('home')!.marketId;
const darkMarketId = jobMarketByKey('dark')!.marketId;
const NOW = 1_000;

function harness(overrides: { readonly settings?: Partial<SettingsV1> } = {}) {
    const settings: SettingsV1 = {
        ...settingsV1Schema.parse({}),
        helperMode: false,
        autoExpeditionEnabled: true,
        mercDecisionPolicy: 'off',
        mercDecisionMode: 'simple',
        mercMinCreditsEnabled: true,
        mercMinCredits: 5_000,
        mercAutoPayEnabled: false,
        ...overrides.settings,
    };
    const state = new AutomationStateStore(new MemoryStorageArea(), () => NOW);
    const clear = vi.fn(async () => undefined);
    const create = vi.fn();
    const overview = vi.fn(async () => ok({
        active: [{
            id: 'active-1',
            status: 'IN_PROGRESS',
            outcome: null,
            locationName: 'Mars',
            mercenaryName: 'Merc',
            totalCost: null,
            riskScore: null,
            lootScore: null,
            hasInsurance: null,
            endsAt: null,
        }],
        archived: [],
        mercenaries: [],
        locations: [],
        decisions: [],
    } satisfies ExpeditionOverview));
    const marketCacheGet = vi.fn(async () => ({ at: 0, view: { credits: 1_000 } }) as never);
    const coordinator = new AutoExpeditionCoordinator({
        settings: {
            get: async () => settings,
            update: async (patch) => ({ ...settings, ...patch }),
        },
        scheduler: { create, clear, get: async () => null },
        logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
        clock: { now: () => NOW },
        events: { publish: () => undefined },
        state,
        snapshots: { get: async () => ok(null as never) },
        service: {
            autoRespond: async () => ok(0),
            respond: async () => ok(undefined),
            payout: async () => ok({ ready: 0, opened: 0, failed: [], payouts: [] }),
            overview,
            locations: async () => ok([]),
            candidates: async () => ok([]),
            configure: async () => ok(undefined),
            launch: async () => ok(undefined),
        } as never,
        configCache: { get: async () => null, set: async () => undefined } as never,
        marketCache: { get: marketCacheGet } as never,
        marketSync: { fetchOptionsView: async () => ok({} as never) } as never,
        routing: { routeToServer: async () => ok(undefined) } as never,
        runAutoMail: async () => undefined,
    });
    return { coordinator, state, clear, create, overview, marketCacheGet };
}

async function seedWait(state: AutomationStateStore, waitReason: string = AUTO_EXPEDITION_CREDIT_WAIT_REASON): Promise<void> {
    await state.set('auto-expedition', {
        phase: 'waiting',
        nextActionAt: NOW + 3 * 60 * 60_000,
        lastError: 'Credits 1,000 below threshold 5,000',
        payload: {
            waitReason,
            last: { at: NOW, decisions: 0, launched: false, error: 'Credits 1,000 below threshold 5,000' },
        },
    });
}

describe('AutoExpeditionCoordinator credit-refresh recheck', () => {
    it('ignores a refresh for a non-home market', async () => {
        const { coordinator, state, clear, overview } = harness();
        await seedWait(state);
        await coordinator.recheckCredits(darkMarketId, 10_000);
        expect(clear).not.toHaveBeenCalled();
        expect(overview).not.toHaveBeenCalled();
        expect((await state.get('auto-expedition')).phase).toBe('waiting');
    });

    it('does not interrupt a wait that is not credit-related', async () => {
        const { coordinator, state, clear, overview } = harness();
        await seedWait(state, 'active');
        await coordinator.recheckCredits(homeMarketId, 10_000);
        expect(clear).not.toHaveBeenCalled();
        expect(overview).not.toHaveBeenCalled();
    });

    it('keeps waiting when the refreshed balance is still below the floor', async () => {
        const { coordinator, state, clear, overview } = harness();
        await seedWait(state);
        await coordinator.recheckCredits(homeMarketId, 1_000);
        expect(clear).not.toHaveBeenCalled();
        expect(overview).not.toHaveBeenCalled();
        expect((await state.get('auto-expedition')).phase).toBe('waiting');
    });

    it('clears the wait and reruns with the refreshed value when credits now fit', async () => {
        const { coordinator, state, clear, overview, marketCacheGet } = harness();
        await seedWait(state);
        await coordinator.recheckCredits(homeMarketId, 10_000);
        expect(clear).toHaveBeenCalledWith(AUTO_EXPEDITION_RETRY_ALARM);
        expect(overview).toHaveBeenCalledTimes(1);
        expect(marketCacheGet).not.toHaveBeenCalled();
        expect((await state.get('auto-expedition')).phase).toBe('running');
    });

    it('does nothing when Auto Expedition is disabled', async () => {
        const { coordinator, state, clear, overview } = harness({ settings: { autoExpeditionEnabled: false } });
        await seedWait(state);
        await coordinator.recheckCredits(homeMarketId, 10_000);
        expect(clear).not.toHaveBeenCalled();
        expect(overview).not.toHaveBeenCalled();
    });

    it('does nothing outside a waiting phase', async () => {
        const { coordinator, state, clear, overview } = harness();
        await state.set('auto-expedition', {
            phase: 'running',
            nextActionAt: null,
            payload: { waitReason: AUTO_EXPEDITION_CREDIT_WAIT_REASON },
        });
        await coordinator.recheckCredits(homeMarketId, 10_000);
        expect(clear).not.toHaveBeenCalled();
        expect(overview).not.toHaveBeenCalled();
    });
});
