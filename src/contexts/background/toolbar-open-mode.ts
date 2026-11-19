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
            logger.warn(LOG_SCOPE, 'Toolbar mode update failed', { error });
        });
        return stateQueue;
    }

    function enqueueMenu(task: () => Promise<void>): Promise<void> {
        menuQueue = menuQueue.then(task).catch((error: unknown) => {
            logger.warn(LOG_SCOPE, 'Toolbar menu update failed', { error });
        });
        return menuQueue;
    }

    function checkMenuError(operation: string, itemId: string): void {
        const error = chrome.runtime.lastError;
        if (error) {
            logger.warn(LOG_SCOPE, `contextMenus.${operation} failed`, { itemId, message: error.message });
        }
    }

    async function applyMode(mode: ToolbarOpenMode): Promise<void> {
        try {
            await chrome.action.setPopup({ popup: toolbarOpenModePopup(mode) });
        } catch (error) {
            logger.warn(LOG_SCOPE, 'Failed to set the action popup', { error });
        }
        try {
            await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: mode === 'sidePanel' });
        } catch (error) {
            logger.warn(LOG_SCOPE, 'Failed to set the side panel behavior', { error });
        }
    }

    async function syncMenuChecked(mode: ToolbarOpenMode): Promise<void> {
        for (const item of TOOLBAR_OPEN_MODES) {
            try {
                await chrome.contextMenus.update(toolbarOpenModeMenuItemId(item), { checked: item === mode });
                checkMenuError('update', toolbarOpenModeMenuItemId(item));
            } catch (error) {
                logger.warn(LOG_SCOPE, 'Failed to update a toolbar menu item', { error });
            }
        }
    }

    async function rebuildMenu(current: SettingsV1): Promise<void> {
        const labels = toolbarOpenModeLabels(current.uiLanguage);
        try {
            await chrome.contextMenus.removeAll();
            checkMenuError('removeAll', MENU_ROOT_ID);
            chrome.contextMenus.create({
                id: MENU_ROOT_ID,
                title: labels.parent,
                contexts: ['action'],
            });
            checkMenuError('create', MENU_ROOT_ID);
            for (const mode of TOOLBAR_OPEN_MODES) {
                const itemId = toolbarOpenModeMenuItemId(mode);
                chrome.contextMenus.create({
                    id: itemId,
                    parentId: MENU_ROOT_ID,
                    title: labels.items[mode],
                    type: 'radio',
                    checked: mode === currentMode,
                    contexts: ['action'],
                });
                checkMenuError('create', itemId);
            }
        } catch (error) {
            logger.warn(LOG_SCOPE, 'Failed to rebuild the toolbar menu', { error });
        }
    }

    async function refresh(): Promise<void> {
        try {
            const current = await settings.get();
            currentMode = current.toolbarOpenMode;
            await applyMode(currentMode);
            await enqueueMenu(() => rebuildMenu(current));
        } catch (error) {
            logger.warn(LOG_SCOPE, 'Failed to read toolbar mode settings', { error });
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
            logger.warn(LOG_SCOPE, 'Failed to save toolbar mode', { error });
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
