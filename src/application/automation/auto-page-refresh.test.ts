import { describe, expect, it } from 'vitest';
import { AutoPageRefreshCoordinator, type AutoPageRefreshTabPort } from './auto-page-refresh.js';
import { autoPageRefreshStateSchema, type AutoPageRefreshBusyKey, type AutoPageRefreshState } from '../../contracts/auto-page-refresh.js';
import { settingsV1Schema, type SettingsV1 } from '../../contracts/storage.js';
import type { AlarmTiming, AutomationLogger, EventPublisher, SchedulerPort, SettingsPort } from './ports.js';
import type { AutoPageRefreshStatePort } from './auto-page-refresh.js';

function settings(overrides: Partial<SettingsV1> = {}): SettingsV1 {
    return settingsV1Schema.parse({
        helperMode: false,
        autoPageRefreshEnabled: true,
        autoPageRefreshIntervalMinutes: 60,
        autoPageRefreshWaitWhileWorking: false,
        ...overrides,
    });
}

function initialState(overrides: Partial<AutoPageRefreshState> = {}): AutoPageRefreshState {
    return autoPageRefreshStateSchema.parse({
        nextRefreshAt: 1_000,
        lastRefreshAt: null,
        waitStartedAt: null,
        waitUntil: null,
        lastResult: null,
        lastError: null,
        ...overrides,
    });
}

const logger: AutomationLogger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};
const events: EventPublisher = { publish: () => undefined };

interface Harness {
    coordinator: AutoPageRefreshCoordinator;
    state: AutoPageRefreshState;
    scheduled: Array<{ alarm: string; timing: AlarmTiming }>;
    cleared: string[];
    tabId: number | null;
    reloaded: number[];
    setBusy: (keys: readonly AutoPageRefreshBusyKey[]) => void;
    setNow: (now: number) => void;
    setSettings: (next: SettingsV1) => Promise<void>;
}

function harness(options: {
    now?: number;
    current?: SettingsV1;
    state?: AutoPageRefreshState;
    tabId?: number | null;
    busy?: readonly AutoPageRefreshBusyKey[];
    reloadError?: Error;
} = {}): Harness {
    let now = options.now ?? 10_000;
    let current = options.current ?? settings();
    let state = options.state ?? initialState();
    let busyKeys: readonly AutoPageRefreshBusyKey[] = options.busy ?? [];
    const scheduled: Array<{ alarm: string; timing: AlarmTiming }> = [];
    const cleared: string[] = [];
    const reloaded: number[] = [];

    const statePort: AutoPageRefreshStatePort = {
        get: async () => state,
        set: async (patch) => {
            state = autoPageRefreshStateSchema.parse({ ...state, ...patch });
            return state;
        },
    };
    const settingsPort: SettingsPort = {
        get: async () => current,
        update: async (patch) => {
            current = settingsV1Schema.parse({ ...current, ...patch });
            return current;
        },
    };
    const scheduler: SchedulerPort = {
        create: (alarm, timing) => scheduled.push({ alarm, timing }),
        clear: async (alarm) => { cleared.push(alarm); },
        get: async () => null,
    };
    const tabs: AutoPageRefreshTabPort = {
        findCor3Tab: async () => options.tabId === undefined ? 42 : options.tabId,
        reload: async (tabId) => {
            if (options.reloadError) throw options.reloadError;
            reloaded.push(tabId);
        },
    };

    const coordinator = new AutoPageRefreshCoordinator({
        settings: settingsPort,
        scheduler,
        state: statePort,
        tabs,
        busy: { check: async () => busyKeys },
        logger,
        events,
        clock: { now: () => now },
        alarm: 'test-alarm',
    });

    return {
        coordinator,
        get state() { return state; },
        scheduled,
        cleared,
        tabId: options.tabId ?? 42,
        reloaded,
        setBusy: (keys) => { busyKeys = keys; },
        setNow: (value) => { now = value; },
        setSettings: async (next) => { current = next; },
    };
}

function whenOf(h: Harness): number | undefined {
    const last = h.scheduled.at(-1);
    return last && 'when' in last.timing ? last.timing.when : undefined;
}

describe('AutoPageRefreshCoordinator', () => {
    it('restores a future timer without resetting it', async () => {
        const h = harness({ state: initialState({ nextRefreshAt: 20_000 }) });
        await h.coordinator.restore();
        expect(whenOf(h)).toBe(20_000);
    });

    it('resets an overdue timer on restore', async () => {
        const h = harness();
        await h.coordinator.restore();
        expect(h.state.nextRefreshAt).toBe(3_610_000);
        expect(whenOf(h)).toBe(3_610_000);
    });

    it('clears the alarm while disabled', async () => {
        const h = harness({ current: settings({ autoPageRefreshEnabled: false }) });
        await h.coordinator.restore();
        expect(h.cleared).toEqual(['test-alarm']);
    });

    it('refreshes an idle game tab and schedules the next countdown', async () => {
        const h = harness();
        const result = await h.coordinator.run();
        expect(result).toMatchObject({ ok: true, reason: 'refreshed' });
        expect(h.reloaded).toEqual([42]);
        expect(h.state.lastRefreshAt).toBe(10_000);
        expect(h.state.nextRefreshAt).toBe(3_610_000);
        expect(whenOf(h)).toBe(3_610_000);
    });

    it('waits up to 10 minutes while selected automations run', async () => {
        const h = harness({
            current: settings({ autoPageRefreshWaitWhileWorking: true }),
            busy: ['auto-expedition', 'auto-jobs'],
        });
        const result = await h.coordinator.run();
        expect(result.reason).toBe('waiting');
        expect(h.reloaded).toEqual([]);
        expect(h.state.waitStartedAt).toBe(10_000);
        expect(h.state.waitUntil).toBe(610_000);
        expect(whenOf(h)).toBe(40_000);
    });

    it('forces a refresh when the busy timeout expires', async () => {
        const h = harness({
            now: 610_000,
            current: settings({ autoPageRefreshWaitWhileWorking: true }),
            state: initialState({ waitStartedAt: 10_000, waitUntil: 610_000 }),
            busy: ['auto-daily'],
        });
        const result = await h.coordinator.run();
        expect(result.reason).toBe('forced');
        expect(h.reloaded).toEqual([42]);
        expect(h.state.lastResult).toBe('forced');
        expect(h.state.waitUntil).toBeNull();
    });

    it('reports a missing game tab and schedules a retry interval', async () => {
        const h = harness({ tabId: null });
        const result = await h.coordinator.run();
        expect(result).toMatchObject({ ok: false, reason: 'no-tab' });
        expect(h.state.lastResult).toBe('failed');
        expect(h.state.lastError).toBe('No cor3.gg tab found');
        expect(whenOf(h)).toBe(3_610_000);
    });

    it('resets the countdown when the interval changes', async () => {
        const h = harness();
        await h.coordinator.applySettings(settings(), settings({ autoPageRefreshIntervalMinutes: 15 }));
        expect(h.state.nextRefreshAt).toBe(910_000);
        expect(h.state.lastResult).toBeNull();
        expect(whenOf(h)).toBe(910_000);
    });

    it('clears the countdown and alarm when disabled', async () => {
        const h = harness();
        await h.coordinator.applySettings(settings(), settings({ autoPageRefreshEnabled: false }));
        expect(h.state.nextRefreshAt).toBeNull();
        expect(h.cleared).toEqual(['test-alarm']);
    });

    it('reports busy automations in status', async () => {
        const h = harness({
            current: settings({ autoPageRefreshWaitWhileWorking: true }),
            busy: ['auto-hack'],
        });
        const status = await h.coordinator.status();
        expect(status.busyKeys).toEqual(['auto-hack']);
        expect(status).toMatchObject({ enabled: true, intervalMinutes: 60, waitWhileWorking: true });
    });
});
