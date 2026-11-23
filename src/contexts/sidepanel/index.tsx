import { render } from 'preact';
import { SidePanelApp } from '../../ui/app/SidePanelApp.js';
import { DEFAULT_WORKSPACE_VIEW, type WorkspaceViewState } from '../../contracts/workspace-view.js';
import type { WorkspaceBootstrap } from '../../contracts/workspace-bootstrap.js';
import { BridgeClient } from '../../infrastructure/bridge/bridge-client.js';
import { ChromeRuntimeBridgeTransport } from '../../infrastructure/bridge/chrome-runtime-transport.js';
import { ChromePopupPortal } from '../../infrastructure/browser/chrome-popup-portal.js';

const rootElement = document.getElementById('app');
if (!rootElement) throw new Error('Missing #app root');
const root: HTMLElement = rootElement;

const transport = new ChromeRuntimeBridgeTransport('background');
const client = new BridgeClient(transport, 'popup', 'background');
const portal = new ChromePopupPortal(client);
const mode = new URLSearchParams(window.location.search).get('mode');
const windowMode = mode === 'window';
const popupMode = mode === 'popup';

if (popupMode) document.body.classList.add('v2-popup-mode');

function readScrollTop(): number {
    return document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function writeScrollTop(value: number): void {
    document.documentElement.scrollTop = value;
    document.body.scrollTop = value;
}

function start(view: WorkspaceViewState, bootstrap: WorkspaceBootstrap | null): void {
    let currentPage = view.page;
    let saveTimer: number | undefined;

    const saveView = (scrollTop: number) => {
        void portal.saveWorkspaceView({ page: currentPage, scrollTop });
    };

    render(
        <SidePanelApp
            portal={portal}
            windowMode={windowMode}
            popupMode={popupMode}
            initialPage={view.page}
            initialBootstrap={bootstrap}
            onPageChange={(page) => {
                currentPage = page;
                requestAnimationFrame(() => saveView(readScrollTop()));
            }}
        />,
        root,
    );

    requestAnimationFrame(() => {
        writeScrollTop(view.scrollTop);
        window.setTimeout(() => writeScrollTop(view.scrollTop), 120);
    });

    window.addEventListener('scroll', () => {
        if (saveTimer !== undefined) clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => saveView(readScrollTop()), 400);
    }, { passive: true });
}

async function readBootstrap(): Promise<WorkspaceBootstrap | null> {
    try {
        const response = await portal.workspaceBootstrap();
        return response.ok ? response.value : null;
    } catch {
        return null;
    }
}

void Promise.all([portal.getWorkspaceView(), readBootstrap()]).then(
    ([view, bootstrap]) => start(view, bootstrap),
    () => start(DEFAULT_WORKSPACE_VIEW, null),
);
