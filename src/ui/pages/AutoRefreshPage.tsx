import { useEffect, useState } from 'preact/hooks';
import type { SettingsV1 } from '../../contracts/storage.js';
import type { AutoPageRefreshBusyKey, AutoPageRefreshStatus } from '../../contracts/auto-page-refresh.js';
import { ToggleSwitch } from '../components/ToggleSwitch.js';
import { t, type MessageKey, type UiLanguage } from '../i18n.js';

export interface AutoRefreshPageProps {
    readonly language: UiLanguage;
    readonly settings: SettingsV1 | null;
    readonly status: AutoPageRefreshStatus | null;
    readonly now: number;
    readonly onChangeEnabled: (enabled: boolean) => Promise<void>;
    readonly onChangeInterval: (minutes: number) => Promise<void>;
    readonly onChangeWaitWhileWorking: (enabled: boolean) => Promise<void>;
}

function formatCountdown(target: number | null, now: number, fallback: string): string {
    if (target === null) return fallback;
    const seconds = Math.max(0, Math.ceil((target - now) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    const pad = (value: number) => String(value).padStart(2, '0');
    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(rest)}`
        : `${pad(minutes)}:${pad(rest)}`;
}

function formatTimestamp(value: number | null, never: string): string {
    if (value === null) return never;
    return new Date(value).toLocaleString();
}

const BUSY_KEY_LABELS: Readonly<Record<AutoPageRefreshBusyKey, MessageKey>> = {
    'auto-expedition': 'autoRefresh.busy.auto-expedition',
    'auto-jobs': 'autoRefresh.busy.auto-jobs',
    'auto-daily': 'autoRefresh.busy.auto-daily',
    'auto-hack': 'autoRefresh.busy.auto-hack',
};

export function AutoRefreshPage({
    language,
    settings,
    status,
    now,
    onChangeEnabled,
    onChangeInterval,
    onChangeWaitWhileWorking,
}: AutoRefreshPageProps) {
    const [intervalDraft, setIntervalDraft] = useState('');
    useEffect(() => {
        setIntervalDraft(String(settings?.autoPageRefreshIntervalMinutes ?? 60));
    }, [settings?.autoPageRefreshIntervalMinutes]);

    const enabled = settings?.autoPageRefreshEnabled ?? false;
    const helperMode = settings?.helperMode ?? false;
    const waitWhileWorking = settings?.autoPageRefreshWaitWhileWorking ?? false;
    const busyKeys = status?.busyKeys ?? [];
    const waiting = enabled && waitWhileWorking && busyKeys.length > 0 && status?.waitUntil !== null && status?.waitUntil !== undefined;
    const nextLabel = waiting
        ? t(language, 'autoRefresh.state.waiting')
        : enabled
            ? t(language, 'autoRefresh.state.scheduled')
            : t(language, 'autoRefresh.state.disabled');
    const resultKey = status?.lastResult === null || status?.lastResult === undefined
        ? null
        : `autoRefresh.result.${status.lastResult}`;

    const commitInterval = () => {
        const parsed = Number(intervalDraft);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1440) {
            setIntervalDraft(String(settings?.autoPageRefreshIntervalMinutes ?? 60));
            return;
        }
        void onChangeInterval(parsed);
    };

    return (
        <section class="v2-page">
            <div class="v2-card">
                <h2>{t(language, 'autoRefresh.title')}</h2>
                <p class="v2-muted">{t(language, 'autoRefresh.description')}</p>

                <div class="v2-divider" />

                <div class="v2-settings-row">
                    <div class="v2-settings-copy">
                        <strong>{t(language, 'autoRefresh.enabled')}</strong>
                        {helperMode ? <span class="v2-text-warn">{t(language, 'autoRefresh.helperMode')}</span> : null}
                    </div>
                    <ToggleSwitch
                        checked={enabled}
                        disabled={!settings || helperMode}
                        label={t(language, 'autoRefresh.enabled')}
                        onChange={(next) => void onChangeEnabled(next)}
                    />
                </div>

                <div class="v2-settings-row">
                    <div class="v2-settings-copy">
                        <strong>{t(language, 'autoRefresh.interval')}</strong>
                        <span class="v2-muted">{t(language, 'autoRefresh.interval.description')}</span>
                    </div>
                    <div class="v2-settings-number-wrap">
                        <input
                            class="v2-settings-number"
                            type="number"
                            min={1}
                            max={1440}
                            step={1}
                            value={intervalDraft}
                            disabled={!settings || helperMode}
                            aria-label={t(language, 'autoRefresh.interval')}
                            onInput={(event) => setIntervalDraft((event.currentTarget as HTMLInputElement).value)}
                            onBlur={commitInterval}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur();
                            }}
                        />
                        <span class="v2-muted">min</span>
                    </div>
                </div>

                <div class="v2-settings-row">
                    <div class="v2-settings-copy">
                        <strong>{t(language, 'autoRefresh.waitWhileWorking')}</strong>
                        <span class="v2-muted">{t(language, 'autoRefresh.waitWhileWorking.description')}</span>
                    </div>
                    <ToggleSwitch
                        checked={waitWhileWorking}
                        disabled={!settings || helperMode}
                        label={t(language, 'autoRefresh.waitWhileWorking')}
                        onChange={(next) => void onChangeWaitWhileWorking(next)}
                    />
                </div>

                <div class="v2-divider" />

                <div class="v2-settings-row">
                    <div class="v2-settings-copy">
                        <strong>{t(language, 'autoRefresh.status')}</strong>
                        <span class="v2-countdown">{formatCountdown(waiting ? status?.waitUntil ?? null : status?.nextRefreshAt ?? null, now, '--:--')}</span>
                    </div>
                    <span class="v2-tag">{nextLabel}</span>
                </div>

                <div class="v2-settings-row">
                    <div class="v2-settings-copy">
                        <strong>{t(language, 'autoRefresh.nextRefresh')}</strong>
                    </div>
                    <span>{formatTimestamp(status?.nextRefreshAt ?? null, t(language, 'autoRefresh.never'))}</span>
                </div>

                <div class="v2-settings-row">
                    <div class="v2-settings-copy">
                        <strong>{t(language, 'autoRefresh.lastRefresh')}</strong>
                    </div>
                    <span>{formatTimestamp(status?.lastRefreshAt ?? null, t(language, 'autoRefresh.never'))}</span>
                </div>

                {resultKey ? (
                    <div class="v2-settings-row">
                        <div class="v2-settings-copy">
                            <strong>{t(language, 'autoRefresh.status')}</strong>
                        </div>
                        <span class={status?.lastResult === 'failed' ? 'v2-text-error' : ''}>{t(language, resultKey as 'autoRefresh.result.refreshed' | 'autoRefresh.result.forced' | 'autoRefresh.result.failed')}</span>
                    </div>
                ) : null}

                {busyKeys.length > 0 ? (
                    <div class="v2-settings-row">
                        <div class="v2-settings-copy">
                            <strong>{t(language, 'autoRefresh.busy')}</strong>
                        </div>
                        <span>{busyKeys.map((key) => t(language, BUSY_KEY_LABELS[key])).join(', ')}</span>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
