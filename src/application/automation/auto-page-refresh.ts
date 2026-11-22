import type { AutoPageRefreshBusyKey, AutoPageRefreshState, AutoPageRefreshStatus } from '../../contracts/auto-page-refresh.js';
import type { SettingsPort, SchedulerPort, AutomationLogger, EventPublisher } from './ports.js';
import type { SettingsV1 } from '../../contracts/storage.js';

const RETRY_MS = 30_000;
const MAX_WAIT_MS = 10 * 60_000;

export interface AutoPageRefreshStatePort {
    get(): Promise<AutoPageRefreshState>;
    set(patch: Partial<AutoPageRefreshState>): Promise<AutoPageRefreshState>;
}

export interface AutoPageRefreshTabPort {
    findCor3Tab(): Promise<number | null>;
    reload(tabId: number): Promise<void>;
}

export interface AutoPageRefreshBusyPort {
    check(): Promise<readonly AutoPageRefreshBusyKey[]>;
}

export interface AutoPageRefreshDeps {
    readonly settings: SettingsPort;
    readonly scheduler: SchedulerPort;
    readonly state: AutoPageRefreshStatePort;
    readonly tabs: AutoPageRefreshTabPort;
    readonly busy: AutoPageRefreshBusyPort;
    readonly logger: AutomationLogger;
    readonly events: EventPublisher;
    readonly clock: { now(): number };
    readonly alarm: string;
}

export interface AutoPageRefreshRunResult {
    readonly ok: boolean;
    readonly reason: 'refreshed' | 'forced' | 'idle' | 'waiting' | 'disabled' | 'no-tab' | 'failed';
    readonly message?: string;
}

function intervalMs(minutes: number): number {
    return Math.min(1440, Math.max(1, Math.round(minutes))) * 60_000;
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export class AutoPageRefreshCoordinator {
    private running = false;

    constructor(private readonly deps: AutoPageRefreshDeps) {}

    async restore(): Promise<void> {
        const settings = await this.deps.settings.get();
        if (!settings.autoPageRefreshEnabled || settings.helperMode) {
            await this.deps.scheduler.clear(this.deps.alarm);
            return;
        }
        const state = await this.deps.state.get();
        const now = this.deps.clock.now();
        const next = state.nextRefreshAt !== null && state.nextRefreshAt > now
            ? state.nextRefreshAt
            : now + intervalMs(settings.autoPageRefreshIntervalMinutes);
        if (next !== state.nextRefreshAt) {
            await this.deps.state.set({
                nextRefreshAt: next,
                waitStartedAt: null,
                waitUntil: null,
                lastError: null,
            });
        }
        this.schedule(next);
    }

    async applySettings(previous: SettingsV1, next: SettingsV1): Promise<void> {
        const becameEnabled = next.autoPageRefreshEnabled && !previous.autoPageRefreshEnabled;
        const intervalChanged = previous.autoPageRefreshIntervalMinutes !== next.autoPageRefreshIntervalMinutes;
        const becameDisabled = !next.autoPageRefreshEnabled || next.helperMode || previous.helperMode !== next.helperMode;
        if (!next.autoPageRefreshEnabled || next.helperMode) {
            await this.deps.scheduler.clear(this.deps.alarm);
            await this.deps.state.set({ nextRefreshAt: null, waitStartedAt: null, waitUntil: null });
            return;
        }
        if (becameDisabled && !becameEnabled && !intervalChanged) return;
        if (becameEnabled || intervalChanged || becameDisabled) {
            const at = this.deps.clock.now() + intervalMs(next.autoPageRefreshIntervalMinutes);
            await this.deps.state.set({
                nextRefreshAt: at,
                waitStartedAt: null,
                waitUntil: null,
                lastResult: null,
                lastError: null,
            });
            this.schedule(at);
        }
    }

    async status(): Promise<AutoPageRefreshStatus> {
        const [settings, state] = await Promise.all([
            this.deps.settings.get(),
            this.deps.state.get(),
        ]);
        const busyKeys = settings.autoPageRefreshEnabled && settings.autoPageRefreshWaitWhileWorking
            ? await this.deps.busy.check()
            : [];
        return {
            enabled: settings.autoPageRefreshEnabled,
            intervalMinutes: settings.autoPageRefreshIntervalMinutes,
            waitWhileWorking: settings.autoPageRefreshWaitWhileWorking,
            ...state,
            busyKeys: [...busyKeys],
        };
    }

    async run(): Promise<AutoPageRefreshRunResult> {
        if (this.running) return { ok: true, reason: 'idle' };
        this.running = true;
        try {
            const settings = await this.deps.settings.get();
            if (!settings.autoPageRefreshEnabled || settings.helperMode) {
                await this.deps.scheduler.clear(this.deps.alarm);
                return { ok: true, reason: 'disabled' };
            }
            const state = await this.deps.state.get();
            const now = this.deps.clock.now();
            if (state.nextRefreshAt === null) {
                const at = now + intervalMs(settings.autoPageRefreshIntervalMinutes);
                await this.deps.state.set({ nextRefreshAt: at });
                this.schedule(at);
                return { ok: true, reason: 'idle' };
            }
            if (state.nextRefreshAt > now) {
                this.schedule(state.nextRefreshAt);
                return { ok: true, reason: 'idle' };
            }

            let forced = false;
            if (settings.autoPageRefreshWaitWhileWorking) {
                const busyKeys = await this.deps.busy.check();
                if (busyKeys.length > 0) {
                    const startedAt = state.waitStartedAt ?? now;
                    const waitUntil = state.waitUntil ?? startedAt + MAX_WAIT_MS;
                    if (now < waitUntil) {
                        await this.deps.state.set({ waitStartedAt: startedAt, waitUntil });
                        this.schedule(Math.min(now + RETRY_MS, waitUntil));
                        this.deps.logger.info('auto-page-refresh', 'Waiting for automations before refreshing', {
                            busyKeys: [...busyKeys],
                            waitUntil,
                        });
                        return { ok: true, reason: 'waiting' };
                    }
                    forced = true;
                }
            }

            const tabId = await this.deps.tabs.findCor3Tab();
            if (tabId === null) {
                const nextAt = now + intervalMs(settings.autoPageRefreshIntervalMinutes);
                await this.deps.state.set({
                    nextRefreshAt: nextAt,
                    waitStartedAt: null,
                    waitUntil: null,
                    lastResult: 'failed',
                    lastError: 'No cor3.gg tab found',
                });
                this.schedule(nextAt);
                return { ok: false, reason: 'no-tab', message: 'No cor3.gg tab found' };
            }

            try {
                await this.deps.tabs.reload(tabId);
            } catch (error) {
                const message = errorText(error);
                const nextAt = now + intervalMs(settings.autoPageRefreshIntervalMinutes);
                await this.deps.state.set({
                    nextRefreshAt: nextAt,
                    waitStartedAt: null,
                    waitUntil: null,
                    lastResult: 'failed',
                    lastError: message,
                });
                this.schedule(nextAt);
                this.deps.logger.warn('auto-page-refresh', 'Game page reload failed', { message });
                return { ok: false, reason: 'failed', message };
            }

            const nextAt = now + intervalMs(settings.autoPageRefreshIntervalMinutes);
            const result = forced ? 'forced' : 'refreshed';
            await this.deps.state.set({
                nextRefreshAt: nextAt,
                lastRefreshAt: now,
                waitStartedAt: null,
                waitUntil: null,
                lastResult: result,
                lastError: null,
            });
            this.schedule(nextAt);
            this.deps.events.publish('auto-page-refresh', { at: now, result });
            return { ok: true, reason: result };
        } finally {
            this.running = false;
        }
    }

    private schedule(at: number): void {
        this.deps.scheduler.create(this.deps.alarm, { when: at });
    }
}
