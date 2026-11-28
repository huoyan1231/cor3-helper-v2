import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { resolveReportRunState } from './valuable-run-state.js';
import type {
    MaintenanceForceProgress,
    MaintenanceTarget,
    PopupPortal,
    ValuableMaintenanceServer,
    ValuableProgress,
    ValuableReport,
    ValuableRunState,
    ValuableSellOptions,
} from '../../../application/popup/portal.js';
import type { TranslateSource } from '../../i18n-context.js';
import type { PopupPage } from '../AppShell.js';
import { usePolling } from './usePolling.js';

/**
 * Valuable search/sale runs, server maintenance selection and force runs
 * (H8 phase 7).
 */

export interface ValuableDeps {
    readonly activePage: PopupPage;
    readonly tt: TranslateSource;
    readonly reportDetail: (message: string) => void;
}

export interface ValuableState {
    readonly valuableStatus: string;
    readonly valuableReport: ValuableReport | null;
    readonly valuableRunId: string | null;
    readonly valuableOperation: ValuableRunState['operation'] | null;
    readonly valuableCanceling: boolean;
    readonly valuableProgress: ValuableProgress | MaintenanceForceProgress | null;
    readonly maintenanceTargets: readonly MaintenanceTarget[];
    readonly maintenanceServers: readonly ValuableMaintenanceServer[];
    readonly maintenanceLoading: boolean;
    readonly selectedMaintenanceIds: ReadonlySet<string>;
    readonly loadValuableReport: () => Promise<void>;
    readonly loadMaintenanceTargets: () => Promise<void>;
    readonly loadValuableMaintenance: (force?: boolean) => Promise<void>;
    readonly startValuableOperation: (
        operation: ValuableRunState['operation'],
        optionsOrServerIds?: ValuableSellOptions | readonly string[],
    ) => Promise<void>;
    readonly startForceMaintenance: (serverIds: readonly string[]) => Promise<void>;
    readonly cancelValuableOperation: () => Promise<void>;
    readonly toggleForceMaintenance: (enabled: boolean) => Promise<void>;
    readonly toggleMaintenanceServer: (serverId: string) => void;
    readonly selectAllUpcoming: () => void;
}

export function useValuable(portal: PopupPortal, deps: ValuableDeps): ValuableState {
    const { activePage, tt, reportDetail } = deps;
    const [valuableStatus, setValuableStatus] = useState('Idle');
    const [valuableReport, setValuableReport] = useState<ValuableReport | null>(null);
    const [valuableRunId, setValuableRunId] = useState<string | null>(null);
    const [valuableOperation, setValuableOperation] = useState<ValuableRunState['operation'] | null>(null);
    const [valuableCanceling, setValuableCanceling] = useState(false);
    const [valuableProgress, setValuableProgress] = useState<ValuableProgress | MaintenanceForceProgress | null>(null);
    const [maintenanceTargets, setMaintenanceTargets] = useState<readonly MaintenanceTarget[]>([]);
    const [maintenanceServers, setMaintenanceServers] = useState<readonly ValuableMaintenanceServer[]>([]);
    const [maintenanceLoading, setMaintenanceLoading] = useState(false);
    const [selectedMaintenanceIds, setSelectedMaintenanceIds] = useState<ReadonlySet<string>>(new Set());
    const valuableStartLock = useRef(false);
    const maintenanceRequestSeq = useRef(0);

    const loadValuableReport = useCallback(async () => {
        const response = await portal.valuableReport();
        if (!response.ok) {
            reportDetail(response.error.message);
            return;
        }
        setValuableReport(response.value);
        const active = response.value.active;
        const runState = resolveReportRunState(active, valuableStartLock.current);
        if (!runState) return;
        setValuableRunId(runState.runId);
        setValuableOperation(runState.operation);
        setValuableProgress(runState.progress);
        if (runState.runId === null) setValuableCanceling(false);
        if (active) {
            // `resolveReportRunState` above already adopts the active run while
            // respecting the local start lock; do not clobber optimistic state.
            setValuableStatus((current) => {
                if (active.operation === 'force-maintenance') return tt('Forcing server maintenance...');
                if (current !== tt('Idle')) return current;
                if (active.operation === 'search') return tt('Searching all servers...');
                if (active.operation === 'sell') return tt('Selling downloaded valuables...');
                if (active.operation === 'maintenance') return tt('Forcing maintenance on upcoming servers...');
                return current;
            });
        }
    }, [portal, reportDetail, tt]);

    const loadMaintenanceTargets = useCallback(async () => {
        const response = await portal.maintenanceTargets();
        if (response.ok) setMaintenanceTargets(response.value);
    }, [portal]);

    const loadValuableMaintenance = useCallback(async (force = false) => {
        const sequence = ++maintenanceRequestSeq.current;
        setMaintenanceLoading(true);
        try {
            const response = await portal.valuableMaintenance(force);
            if (sequence !== maintenanceRequestSeq.current) return;
            if (!response.ok) {
                reportDetail(response.error.message);
                return;
            }
            setMaintenanceServers(response.value);
            const selectable = new Set(response.value
                .filter((server) => !server.active && Boolean(server.timeUntil))
                .map((server) => server.id));
            setSelectedMaintenanceIds((current) => {
                const next = new Set([...current].filter((id) => selectable.has(id)));
                return next.size === current.size && [...next].every((id) => current.has(id)) ? current : next;
            });
        } finally {
            if (sequence === maintenanceRequestSeq.current) setMaintenanceLoading(false);
        }
    }, [portal, reportDetail]);

    useEffect(() => {
        void loadValuableReport();
    }, [loadValuableReport]);

    useEffect(() => {
        void loadMaintenanceTargets();
        if (activePage === 'automation') void loadValuableMaintenance();
    }, [activePage, loadMaintenanceTargets, loadValuableMaintenance]);

    const startValuableOperation = useCallback(async (
        operation: ValuableRunState['operation'],
        optionsOrServerIds?: ValuableSellOptions | readonly string[],
    ) => {
        const serverIds = Array.isArray(optionsOrServerIds) ? (optionsOrServerIds as readonly string[]) : undefined;
        const options = serverIds ? undefined : (optionsOrServerIds as ValuableSellOptions | undefined);
        if (valuableRunId !== null || valuableStartLock.current) return;
        valuableStartLock.current = true;
        const runId = crypto.randomUUID();
        setValuableRunId(runId);
        setValuableOperation(operation);
        setValuableProgress(null);
        setValuableCanceling(false);
        setValuableStatus(operation === 'search'
            ? tt('Searching all servers...')
            : operation === 'sell'
                ? tt('Selling downloaded valuables...')
                : serverIds && serverIds.length > 0
                    ? tt('Forcing maintenance on selected servers...')
                    : tt('Forcing maintenance on upcoming servers...'));
        try {
            if (operation === 'search') {
                const response = await portal.searchValuable(runId);
                if (!response.ok) {
                    setValuableStatus(response.error.message);
                    return;
                }
                const value = response.value;
                const failures = value.serverFailures.length > 0 ? ` · ${value.serverFailures.length} ${tt('failed')}` : '';
                setValuableStatus(value.stopped
                    ? `${tt('Search cancelled: downloaded {files} file(s), {logs} log(s)', { files: value.downloadedFiles, logs: value.downloadedLogs })}${failures}`
                    : `${tt('Downloaded {files} file(s) and {logs} log(s) from {servers} server(s)', { files: value.downloadedFiles, logs: value.downloadedLogs, servers: value.serversScanned })}${failures}`);
            } else if (operation === 'sell') {
                // The background may start an automatic force-maintenance run
                // right after the sale. `loadValuableReport` below adopts it.
                const response = await portal.sellValuable(runId, options);
                if (!response.ok) {
                    setValuableStatus(response.error.message);
                    return;
                }
                const value = response.value;
                const failures = value.marketFailures.length > 0 ? ` · ${value.marketFailures.length} ${tt('failed')}` : '';
                setValuableStatus(value.stopped
                    ? `${tt('Sale cancelled after {items} item(s) for {credits} credits', { items: value.soldItems, credits: Math.round(value.credits).toLocaleString() })}${failures}`
                    : `${tt('Sold {items} item(s) for {credits} credits and ⭐ {reputation}', { items: value.soldItems, credits: Math.round(value.credits).toLocaleString(), reputation: Math.round(value.reputation) })}${failures}`);
            } else {
                const response = await portal.forceMaintenance(runId, serverIds);
                if (!response.ok) {
                    setValuableStatus(response.error.message);
                    return;
                }
                const value = response.value;
                const failures = value.failed.length > 0 ? ` · ${value.failed.length} ${tt('failed')}` : '';
                setValuableStatus(value.stopped
                    ? `${tt('Force maintenance cancelled: {count} server(s) forced', { count: value.forced.length })}${failures}`
                    : `${tt('Forced maintenance on {count} server(s)', { count: value.forced.length })}${failures}`);
            }
        } catch (error) {
            setValuableStatus(error instanceof Error ? error.message : String(error));
        } finally {
            valuableStartLock.current = false;
            setValuableRunId((current) => current === runId ? null : current);
            setValuableOperation((current) => current === operation ? null : current);
            setValuableProgress(null);
            setValuableCanceling(false);
            await Promise.all([
                loadValuableReport(),
                loadMaintenanceTargets(),
                loadValuableMaintenance(),
            ]);
        }
    }, [portal, valuableRunId, loadValuableReport, loadMaintenanceTargets, loadValuableMaintenance, tt]);

    const startForceMaintenance = useCallback(async (serverIds: readonly string[]) => {
        if (serverIds.length === 0) return;
        // Upstream's `startForceValuableMaintenance()` shares the
        // `valuable.forceMaintenance` bridge command, whose handler is the
        // fork's runMaintenance returning `MaintenanceForceSummary`. The strict
        // `{ runId }` quick-start schema would reject that response, so route
        // through the fork-compatible operation which awaits the same run.
        await startValuableOperation('force-maintenance', serverIds);
    }, [startValuableOperation]);

    const cancelValuableOperation = useCallback(async () => {
        if (valuableRunId === null || valuableCanceling) return;
        setValuableCanceling(true);
        const response = await portal.cancelValuable(valuableRunId);
        if (response.ok) {
            setValuableStatus(tt('Cancellation requested...'));
        } else {
            setValuableStatus(response.error.message);
            setValuableCanceling(false);
        }
    }, [portal, valuableRunId, valuableCanceling, tt]);

    const pollValuableProgress = useCallback(async () => {
        if (valuableRunId === null) return;
        const response = await portal.valuableProgress(valuableRunId);
        if (!response.ok) return;
        if (!response.value) {
            if (valuableStartLock.current) return;
            setValuableRunId(null);
            setValuableOperation(null);
            setValuableProgress(null);
            setValuableCanceling(false);
            await Promise.all([
                loadValuableReport(),
                loadMaintenanceTargets(),
                loadValuableMaintenance(),
            ]);
            return;
        }
        setValuableProgress(response.value.progress);
        if (response.value.status !== 'running') {
            const finishedOperation = valuableOperation;
            valuableStartLock.current = false;
            setValuableRunId(null);
            setValuableOperation(null);
            setValuableProgress(null);
            setValuableCanceling(false);
            await Promise.all([
                loadValuableReport(),
                loadMaintenanceTargets(),
                loadValuableMaintenance(finishedOperation === 'force-maintenance'),
            ]);
            if (finishedOperation === 'force-maintenance') {
                if (response.value.status === 'error') {
                    setValuableStatus(response.value.error ?? tt('Force maintenance failed.'));
                } else if (response.value.status === 'cancelled') {
                    setValuableStatus(tt('Force maintenance cancelled.'));
                } else {
                    setValuableStatus(tt('Force maintenance finished.'));
                }
            }
        }
    }, [portal, valuableRunId, valuableOperation, loadValuableReport, loadMaintenanceTargets, loadValuableMaintenance, tt]);

    const toggleForceMaintenance = useCallback(async (enabled: boolean) => {
        const response = await portal.updateSettings({ valuableForceMaintenanceEnabled: enabled });
        if (!response.ok) {
            reportDetail(response.error.message);
            return;
        }
        if (enabled) await loadValuableMaintenance(true);
        else setSelectedMaintenanceIds(new Set());
    }, [portal, reportDetail, loadValuableMaintenance]);

    const toggleMaintenanceServer = useCallback((serverId: string) => {
        setSelectedMaintenanceIds((current) => {
            const next = new Set(current);
            if (next.has(serverId)) next.delete(serverId);
            else next.add(serverId);
            return next;
        });
    }, []);

    const selectAllUpcoming = useCallback(() => {
        setSelectedMaintenanceIds(new Set(maintenanceServers
            .filter((server) => !server.active && Boolean(server.timeUntil))
            .map((server) => server.id)));
    }, [maintenanceServers]);

    usePolling(pollValuableProgress, 1000, { enabled: valuableRunId !== null });
    usePolling(loadValuableReport, 5000, { enabled: activePage === 'automation' });
    usePolling(loadMaintenanceTargets, 10000, { enabled: activePage === 'automation' });

    return {
        valuableStatus,
        valuableReport,
        valuableRunId,
        valuableOperation,
        valuableCanceling,
        valuableProgress,
        maintenanceTargets,
        maintenanceServers,
        maintenanceLoading,
        selectedMaintenanceIds,
        loadValuableReport,
        loadMaintenanceTargets,
        loadValuableMaintenance,
        startValuableOperation,
        startForceMaintenance,
        cancelValuableOperation,
        toggleForceMaintenance,
        toggleMaintenanceServer,
        selectAllUpcoming,
    };
}
