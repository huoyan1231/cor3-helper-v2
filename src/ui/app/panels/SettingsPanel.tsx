import type { GameStatusState } from '../hooks/useGameStatus.js';
import type { NetworkState } from '../hooks/useNetwork.js';
import type { PortalConnection } from '../hooks/usePortalConnection.js';
import type { SettingsState } from '../hooks/useSettings.js';
import { SettingsPage } from '../../pages/SettingsPage.js';

export interface SettingsPanelProps {
    readonly settings: SettingsState;
    readonly connection: PortalConnection;
    readonly network: NetworkState;
    readonly gameStatus: GameStatusState;
    readonly onOpenDeveloper: () => void;
}

export function SettingsPanel({ settings, connection, network, gameStatus, onOpenDeveloper }: SettingsPanelProps) {
    return (
        <SettingsPage
            language={settings.language}
            versionName={connection.version?.versionName ?? null}
            settings={settings.settings}
            auth={settings.auth}
            hasEndpoint={Boolean(network.network?.endpoint)}
            snapshotAgeMs={network.networkDiag?.snapshotAgeMs ?? null}
            gameTabReady={gameStatus.gameTabReady}
            panelOpen={settings.panelOpen}
            onPanelOpenChange={settings.updatePanelOpen}
            panelOrder={settings.panelOrder}
            onReorderPanels={settings.reorderPanels}
            onResetPanelOrder={settings.resetPanelOrder}
            onChangeLanguage={settings.changeLanguage}
            onChangeHelperMode={settings.changeHelperMode}
            onChangeDeveloperMode={settings.changeDeveloperMode}
            onChangeAutoExpeditionInterval={settings.changeAutoExpeditionInterval}
            onChangeMysteryEgg={settings.changeMysteryEgg}
            onChangeQol={settings.changeQol}
            onExportSettings={settings.exportSettings}
            onImportSettings={settings.importSettings}
            onResetSettings={settings.resetSettings}
            onOpenDeveloper={onOpenDeveloper}
            updateResult={settings.updateResult}
            updateStatusError={settings.updateStatusError}
            updateChecking={settings.updateChecking}
            onCheckUpdates={settings.checkUpdates}
        />
    );
}
