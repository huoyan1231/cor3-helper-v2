import { describe, expect, it, vi } from 'vitest';
import { alarmRoutes, automationAlarmNames, clearAutomationAlarms, workspaceWarmRoute } from './alarms.js';
import { AUTOMATION_ALARM_IDS } from './automation/alarm-ids.js';
import type { AutomationRuntime } from './composition/automation.js';
import type { AutomationLogger } from '../../application/automation/ports.js';

const logger: AutomationLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

describe('alarm route table', () => {
    // Route construction only closes over the runtime; it does not call it.
    const automation = {} as AutomationRuntime;

    it('declares every automation alarm exactly once', () => {
        const routes = alarmRoutes(automation, logger);
        const names = automationAlarmNames(routes);
        expect(new Set(names).size).toBe(names.length);
        expect([...names].sort()).toEqual(Object.values(AUTOMATION_ALARM_IDS).sort());
    });

    it('derives the Helper Mode clear list from the route table', async () => {
        const routes = alarmRoutes(automation, logger);
        const cleared: string[] = [];
        const scheduler = {
            create: () => undefined,
            clear: async (alarm: string) => { cleared.push(alarm); },
            get: async () => null,
        };
        await clearAutomationAlarms(scheduler, routes);
        expect(cleared.sort()).toEqual(Object.values(AUTOMATION_ALARM_IDS).sort());
    });

    it('keeps the workspace warm cache out of the automation clear list', async () => {
        const refresh = vi.fn(async () => undefined);
        const warm = workspaceWarmRoute({ workspaceBootstrap: { refresh } } as unknown as AutomationRuntime, logger);
        const cleared: string[] = [];
        const scheduler = {
            create: () => undefined,
            clear: async (alarm: string) => { cleared.push(alarm); },
            get: async () => null,
        };
        await clearAutomationAlarms(scheduler, alarmRoutes(automation, logger));

        expect(cleared).not.toContain(warm.alarm);
        expect(alarmRoutes(automation, logger).some((route) => route.id === warm.id)).toBe(false);
        await warm.run();
        expect(refresh).toHaveBeenCalledOnce();
    });
});
