import { useCallback, useState } from 'preact/hooks';
import type { PopupPortal, AutoPageRefreshStatus } from '../../../application/popup/portal.js';
import type { PopupPage } from '../AppShell.js';
import { usePolling } from './usePolling.js';

export interface AutoRefreshState {
    readonly status: AutoPageRefreshStatus | null;
    readonly loadStatus: () => Promise<void>;
}

export function useAutoRefresh(portal: PopupPortal, activePage: PopupPage): AutoRefreshState {
    const [status, setStatus] = useState<AutoPageRefreshStatus | null>(null);

    const loadStatus = useCallback(async () => {
        const response = await portal.autoPageRefreshStatus();
        if (response.ok) setStatus(response.value);
    }, [portal]);

    usePolling(loadStatus, 3000, { enabled: activePage === 'autoRefresh' });

    return { status, loadStatus };
}
