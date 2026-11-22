import type { AutoRefreshState } from '../hooks/useAutoRefresh.js';
import type { SettingsState } from '../hooks/useSettings.js';
import { AutoRefreshPage } from '../../pages/AutoRefreshPage.js';

export interface AutoRefreshPanelProps {
    readonly settings: SettingsState;
    readonly autoRefresh: AutoRefreshState;
    readonly now: number;
}

export function AutoRefreshPanel({ settings, autoRefresh, now }: AutoRefreshPanelProps) {
    return (
        <AutoRefreshPage
            language={settings.language}
            settings={settings.settings}
            status={autoRefresh.status}
            now={now}
            onChangeEnabled={async (next) => {
                await settings.changeAutoPageRefreshEnabled(next);
                await autoRefresh.loadStatus();
            }}
            onChangeInterval={async (minutes) => {
                await settings.changeAutoPageRefreshInterval(minutes);
                await autoRefresh.loadStatus();
            }}
            onChangeWaitWhileWorking={async (next) => {
                await settings.changeAutoPageRefreshWaitWhileWorking(next);
                await autoRefresh.loadStatus();
            }}
        />
    );
}
