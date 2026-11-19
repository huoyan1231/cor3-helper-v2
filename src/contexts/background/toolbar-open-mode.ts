import {
    parseToolbarOpenMode,
    toolbarOpenModeLabels,
    toolbarOpenModeMenuItemId,
    toolbarOpenModePopup,
    type ToolbarOpenMode,
} from '../../application/settings/toolbar-open-mode.js';
import { settingsV1Schema, storageEnvelopeSchema, TOOLBAR_OPEN_MODES, type SettingsPatch, type SettingsV1 } from '../../contracts/storage.js';
import { openWorkspaceWindow } from '../../infrastructure/browser/workspace-opener.js';
import type { Logger } from '../../infrastructure/logging/logger.js';
import { SETTINGS_KEY } from '../../infrastructure/storage/settings-repository.js';

const MENU_ROOT_ID = 'cor3-toolbar-open-mode';
const LOG_SCOPE = 'toolbar-open-mode';

interface SettingsPort {
    get(): Promise<SettingsV1>;
    update(patch: SettingsPatch): Promise<SettingsV1>;
}

export interface ToolbarOpenModeDeps {
    readonly settings: SettingsPort;
    readonly logger: Logger;
}

export function registerToolbarOpenMode({ settings, logger }: ToolbarOpenModeDeps): void {
    let currentMode: ToolbarOpenMode = 'none';
    let stateQueue: Promise<void> = Promise.resolve();
    let menuQueue: Promise<void> = Promise.resolve();
    let ready: Promise<void> = Promise.resolve();

    function enqueueState(task: () => Promise<void>): Promise<void> {
        stateQueue = stateQueue.then(task).catch((error: unknown) => {
            logger.warn(LOG_SCOPE, `Toolbar mode update failed: ${errorText(error)}`);
        });
        return stateQueue;
    }

    function enqueueMenu(task: () => Promise<void>): Promise<void> {
        menuQueue = menuQueue.then(task).catch((error: unknown) => {
            logger.warn(LOG_SCOPE, `Toolbar menu update failed: ${errorText(error)}`);
        });
        return menuQueue;
    }

    function errorText(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    async function updateMenuItem(id: string, properties: Parameters<typeof chrome.contextMenus.update>[1]): Promise<boolean> {
        try {
            await chrome.contextMenus.update(id, properties);
            return !chrome.runtime.lastError;
        } catch {
            return false;
        }
    }

    function createMenuItem(properties: chrome.contextMenus.CreateProperties): void {
        const id = String(properties.id);
        try {
            chrome.contextMenus.create(properties);
            const error = chrome.runtime.lastError;
            if (error) logger.warn(LOG_SCOPE, `contextMenus.create failed for ${id}: ${error.message}`);
        } catch (error) {
            logger.warn(LOG_SCOPE, `contextMenus.create failed for ${id}: ${errorText(error)}`);
        }
    }

    async function applyMode(mode: ToolbarOpenMode): Promise<void> {
        try {
            await chrome.action.setPopup({ popup: toolbarOpenModePopup(mode) });
        } catch (error) {
            logger.warn(LOG_SCOPE, `Failed to set the action popup: ${errorText(error)}`);
        }
        try {
            await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: mode === 'sidePanel' });
        } catch (error) {
            logger.warn(LOG_SCOPE, `Failed to set the side panel behavior: ${errorText(error)}`);
        }
    }

    async function syncMenuChecked(mode: ToolbarOpenMode): Promise<void> {
        for (const item of TOOLBAR_OPEN_MODES) {
            await updateMenuItem(toolbarOpenModeMenuItemId(item), { checked: item === mode });
        }
    }

    async function syncMenu(current: SettingsV1): Promise<void> {
        const labels = toolbarOpenModeLabels(current.uiLanguage);
        if (!(await updateMenuItem(MENU_ROOT_ID, { title: labels.parent, contexts: ['action'] }))) {
            createMenuItem({ id: MENU_ROOT_ID, title: labels.parent, contexts: ['action'] });
        }

        for (const mode of TOOLBAR_OPEN_MODES) {
            const itemId = toolbarOpenModeMenuItemId(mode);
            const title = labels.items[mode];
            const checked = mode === currentMode;
            if (!(await updateMenuItem(itemId, {
                parentId: MENU_ROOT_ID,
                title,
                type: 'radio',
                checked,
                contexts: ['action'],
            }))) {
                createMenuItem({
                    id: itemId,
                    parentId: MENU_ROOT_ID,
                    title,
                    type: 'radio',
                    checked,
                    contexts: ['action'],
                });
            }
        }
    }

    async function refresh(): Promise<void> {
        try {
            const current = await settings.get();
            currentMode = current.toolbarOpenMode;
            await applyMode(currentMode);
            await enqueueMenu(() => syncMenu(current));
        } catch (error) {
            logger.warn(LOG_SCOPE, `Failed to read toolbar mode settings: ${errorText(error)}`);
        }
    }

    function enqueueRefresh(): Promise<void> {
        ready = enqueueState(refresh);
        return ready;
    }

    chrome.contextMenus.onClicked.addListener((info) => {
        const mode = parseToolbarOpenMode(String(info.menuItemId));
        if (!mode) return;
        void enqueueState(async () => {
            currentMode = mode;
            await applyMode(mode);
            await enqueueMenu(() => syncMenuChecked(mode));
        });
        void settings.update({ toolbarOpenMode: mode }).catch((error: unknown) => {
            logger.warn(LOG_SCOPE, `Failed to save toolbar mode: ${errorText(error)}`);
        });
    });

    chrome.action.onClicked.addListener(() => {
        void ready.then(() => {
            if (currentMode === 'window') void openWorkspaceWindow();
        });
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        const change = changes[SETTINGS_KEY];
        if (!change?.newValue) return;
        const parsed = storageEnvelopeSchema(settingsV1Schema).safeParse(change.newValue);
        if (!parsed.success) return;
        void enqueueRefresh();
    });

    chrome.runtime.onInstalled.addListener(() => {
        void enqueueRefresh();
    });
    chrome.runtime.onStartup?.addListener(() => {
        void enqueueRefresh();
    });

    ready = enqueueRefresh();
}
