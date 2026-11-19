import { afterEach, describe, expect, it, vi } from 'vitest';
import { toolbarOpenModeMenuItemId } from '../../application/settings/toolbar-open-mode.js';
import { settingsV1Schema, type SettingsPatch, type SettingsV1 } from '../../contracts/storage.js';
import { registerToolbarOpenMode } from './toolbar-open-mode.js';

function fakeSettings(initial: SettingsV1 = settingsV1Schema.parse({}), getDelay = 0) {
    let value = initial;
    return {
        get: vi.fn(async () => {
            if (getDelay > 0) await new Promise((resolve) => setTimeout(resolve, getDelay));
            return value;
        }),
        update: vi.fn(async (patch: SettingsPatch) => {
            value = settingsV1Schema.parse({ ...value, ...patch });
            return value;
        }),
    };
}

function stubChrome(options: { readonly failCreateId?: string } = {}) {
    const listeners = {
        menuClick: vi.fn(),
        actionClick: vi.fn(),
        storageChanged: vi.fn(),
        installed: vi.fn(),
        startup: vi.fn(),
    };
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const setPopup = vi.fn().mockResolvedValue(undefined);
    const setPanelBehavior = vi.fn().mockResolvedValue(undefined);
    const removeAll = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn((properties: { readonly id?: string }) => {
        runtime.lastError = options.failCreateId && properties.id === options.failCreateId
            ? { message: 'duplicate id' }
            : undefined;
        return 1;
    });
    const update = vi.fn().mockResolvedValue(undefined);
    const sidePanelOpen = vi.fn().mockResolvedValue(undefined);
    const windowsCreate = vi.fn().mockResolvedValue({ id: 2 });
    const runtime: {
        lastError?: { readonly message: string } | undefined;
        getURL: (path: string) => string;
        onInstalled: { addListener: typeof listeners.installed };
        onStartup: { addListener: typeof listeners.startup };
    } = {
        getURL: (path: string) => `chrome-extension://test-id/${path}`,
        onInstalled: { addListener: listeners.installed },
        onStartup: { addListener: listeners.startup },
    };

    vi.stubGlobal('chrome', {
        action: { setPopup, onClicked: { addListener: listeners.actionClick } },
        contextMenus: { removeAll, create, update, onClicked: { addListener: listeners.menuClick } },
        storage: { onChanged: { addListener: listeners.storageChanged } },
        runtime,
        windows: {
            getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
            getAll: vi.fn().mockResolvedValue([]),
            create: windowsCreate,
            update: vi.fn().mockResolvedValue(undefined),
        },
        sidePanel: { open: sidePanelOpen, setPanelBehavior },
    });

    return { listeners, logger, setPopup, setPanelBehavior, removeAll, create, update, sidePanelOpen, windowsCreate };
}

function envelope(data: SettingsV1): { readonly newValue: unknown } {
    return { newValue: { schemaVersion: 1, writtenAt: Date.now(), data } };
}

describe('toolbar open mode router', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('applies the saved mode, panel behavior and localized menu on registration', async () => {
        const chromeApi = stubChrome();
        const settings = fakeSettings({
            ...settingsV1Schema.parse({}),
            toolbarOpenMode: 'popup',
            uiLanguage: 'zh',
        });

        registerToolbarOpenMode({ settings, logger: chromeApi.logger });

        await vi.waitFor(() => expect(chromeApi.setPopup).toHaveBeenCalledWith({ popup: 'sidepanel.html?mode=popup' }));
        expect(chromeApi.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: false });
        expect(chromeApi.create).toHaveBeenCalledWith(expect.objectContaining({
            id: 'cor3-toolbar-open-mode',
            title: '默认打开方式',
        }));
        expect(chromeApi.create).toHaveBeenCalledWith(expect.objectContaining({
            id: toolbarOpenModeMenuItemId('popup'),
            title: '弹窗',
            checked: true,
        }));
    });

    it('opens the side panel natively without calling the opener on icon click', async () => {
        const chromeApi = stubChrome();
        const settings = fakeSettings();
        registerToolbarOpenMode({ settings, logger: chromeApi.logger });
        await vi.waitFor(() => expect(chromeApi.create).toHaveBeenCalled());

        const onMenuClick = chromeApi.listeners.menuClick.mock.calls[0]?.[0] as (info: { menuItemId: string }) => void;
        onMenuClick({ menuItemId: toolbarOpenModeMenuItemId('sidePanel') });

        expect(settings.update).toHaveBeenCalledWith({ toolbarOpenMode: 'sidePanel' });
        await vi.waitFor(() => expect(chromeApi.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true }));
        expect(chromeApi.setPopup).toHaveBeenCalledWith({ popup: '' });

        const onActionClick = chromeApi.listeners.actionClick.mock.calls[0]?.[0] as () => void;
        onActionClick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(chromeApi.sidePanelOpen).not.toHaveBeenCalled();
        expect(chromeApi.windowsCreate).not.toHaveBeenCalled();
    });

    it('opens a detached window on icon click after the menu selection', async () => {
        const chromeApi = stubChrome();
        registerToolbarOpenMode({ settings: fakeSettings(), logger: chromeApi.logger });
        await vi.waitFor(() => expect(chromeApi.create).toHaveBeenCalled());

        const onMenuClick = chromeApi.listeners.menuClick.mock.calls[0]?.[0] as (info: { menuItemId: string }) => void;
        onMenuClick({ menuItemId: toolbarOpenModeMenuItemId('window') });
        await vi.waitFor(() => expect(chromeApi.setPopup).toHaveBeenCalledWith({ popup: '' }));

        const onActionClick = chromeApi.listeners.actionClick.mock.calls[0]?.[0] as () => void;
        onActionClick();
        await vi.waitFor(() => expect(chromeApi.windowsCreate).toHaveBeenCalledWith(expect.objectContaining({
            url: expect.stringContaining('?mode=window'),
        })));
    });

    it('waits for the initial settings load on a cold-start icon click', async () => {
        const chromeApi = stubChrome();
        const settings = fakeSettings({
            ...settingsV1Schema.parse({}),
            toolbarOpenMode: 'window',
        }, 60);
        registerToolbarOpenMode({ settings, logger: chromeApi.logger });

        const onActionClick = chromeApi.listeners.actionClick.mock.calls[0]?.[0] as () => void;
        onActionClick();
        expect(chromeApi.windowsCreate).not.toHaveBeenCalled();

        await vi.waitFor(() => expect(chromeApi.windowsCreate).toHaveBeenCalledTimes(1), { timeout: 1000 });
    });

    it('rebuilds menu labels when the interface language changes', async () => {
        const chromeApi = stubChrome();
        const settings = fakeSettings();
        registerToolbarOpenMode({ settings, logger: chromeApi.logger });
        await vi.waitFor(() => expect(chromeApi.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Default open mode' })));

        const changed = settingsV1Schema.parse({ ...settingsV1Schema.parse({}), uiLanguage: 'zh' });
        await settings.update({ uiLanguage: 'zh' });
        const onStorageChanged = chromeApi.listeners.storageChanged.mock.calls[0]?.[0] as (
            changes: Record<string, unknown>,
            area: string,
        ) => void;
        onStorageChanged({ [ 'v2.settings' ]: envelope(changed) }, 'local');

        await vi.waitFor(() => expect(chromeApi.create).toHaveBeenCalledWith(expect.objectContaining({ title: '默认打开方式' })));
    });

    it('serializes menu rebuilds and logs context menu creation errors', async () => {
        const chromeApi = stubChrome({ failCreateId: toolbarOpenModeMenuItemId('window') });
        registerToolbarOpenMode({ settings: fakeSettings(), logger: chromeApi.logger });
        await vi.waitFor(() => expect(chromeApi.removeAll).toHaveBeenCalledTimes(1));

        const onInstalled = chromeApi.listeners.installed.mock.calls[0]?.[0] as () => void;
        const onStartup = chromeApi.listeners.startup.mock.calls[0]?.[0] as () => void;
        onInstalled();
        onStartup();

        await vi.waitFor(() => expect(chromeApi.removeAll).toHaveBeenCalledTimes(3));
        const firstCreateOrder = chromeApi.create.mock.invocationCallOrder[0] ?? 0;
        const secondRemoveOrder = chromeApi.removeAll.mock.invocationCallOrder[1] ?? 0;
        expect(secondRemoveOrder).toBeGreaterThan(firstCreateOrder);
        expect(chromeApi.logger.warn).toHaveBeenCalledWith(
            'toolbar-open-mode',
            'contextMenus.create failed',
            expect.objectContaining({ itemId: toolbarOpenModeMenuItemId('window') }),
        );
    });
});
