import { useEffect, useRef, useState } from 'preact/hooks';
import type { MaintenanceForceProgress, MaintenanceTarget, ValuableOperation, ValuableProgress, ValuableReport, ValuableRunState } from '../../../application/popup/portal.js';
import { AutomationCard } from '../../components/AutomationCard.js';
import { Modal } from '../../components/Modal.js';
import { useT, type TranslateSource } from '../../i18n-context.js';

export interface ValuableSellerCardProps {
    readonly runId: string | null;
    readonly operation: ValuableOperation | null;
    readonly status: string;
    readonly progress: ValuableProgress | MaintenanceForceProgress | null;
    readonly report: ValuableReport | null;
    readonly canceling: boolean;
    readonly maintenanceTargets: readonly MaintenanceTarget[];
    readonly onSearch: () => void | Promise<void>;
    readonly onSell: () => void | Promise<void>;
    readonly onForceSelected: (serverIds: readonly string[]) => void | Promise<void>;
    readonly onCancel: () => void | Promise<void>;
    readonly expanded: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

function phaseLabel(progress: ValuableProgress | MaintenanceForceProgress, tr: TranslateSource): string {
    switch (progress.phase) {
        case 'server':
            return tr('Checking server');
        case 'download':
            return tr('Downloading');
        case 'market':
            return tr('Checking market');
        case 'sell':
            return tr('Selling item');
        case 'prepare':
            return tr('Preparing SEARCH loadout');
        case 'searching':
            return tr('Forcing maintenance');
        case 'server-done':
            return tr('Maintenance started');
        case 'done':
            return tr('Done');
    }
}

function formatReportTime(value: number | null, tr: TranslateSource): string {
    if (value === null) return tr('never');
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(target: string | null, now: number, tr: TranslateSource): string {
    if (!target) return tr('never');
    const parsed = new Date(target).getTime();
    if (!Number.isFinite(parsed)) return target;
    const diff = parsed - now;
    if (diff <= 0) return tr('now');
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);
    return `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`;
}

function defaultStatus(report: ValuableReport | null, operation: ValuableRunState['operation'] | null, tr: TranslateSource): string {
    if (operation === 'search') return tr('Searching all servers...');
    if (operation === 'sell') return tr('Selling downloaded valuables...');
    if (operation === 'maintenance') return tr('Forcing maintenance on upcoming servers...');
    if (!report) return tr('Loading valuable report...');
    if (report.unsoldItems > 0) {
        return tr('Ready · {count} downloaded item(s) waiting to be sold.', { count: report.unsoldItems });
    }
    if (report.lastSearchAt !== null || report.lastSellAt !== null) {
        return tr('Ready · last search {search} · last sale {sale}.', {
            search: formatReportTime(report.lastSearchAt, tr),
            sale: formatReportTime(report.lastSellAt, tr),
        });
    }
    return tr('No search yet. Start with Search all servers, then sell the downloaded valuables.');
}

export function ValuableSellerCard({
    runId,
    operation,
    status,
    progress,
    report,
    canceling,
    maintenanceTargets,
    onSearch,
    onSell,
    onForceSelected,
    onCancel,
    expanded,
    onOpenChange,
}: ValuableSellerCardProps) {
    const tr = useT();
    const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
    const [now, setNow] = useState(() => Date.now());
    const [confirmForceOpen, setConfirmForceOpen] = useState(false);
    const selectAllRef = useRef<HTMLInputElement>(null);
    const running = runId !== null;
    const searchRunning = running && operation === 'search';
    const sellRunning = running && operation === 'sell';
    const maintenanceRunning = running && operation === 'maintenance';

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const selectableIds = maintenanceTargets
        .filter((target) => !target.active && !target.endsAt)
        .map((target) => target.id);
    const selectedTargets = maintenanceTargets.filter((target) => selectedIds.includes(target.id));
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
    const someSelected = selectedIds.length > 0 && !allSelected;

    useEffect(() => {
        const selectable = new Set(maintenanceTargets.filter((target) => !target.active && !target.endsAt).map((target) => target.id));
        setSelectedIds((current) => current.filter((id) => selectable.has(id)));
    }, [maintenanceTargets]);

    useEffect(() => {
        if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
    }, [someSelected]);

    useEffect(() => {
        if (running) setConfirmForceOpen(false);
    }, [running]);

    const toggleTarget = (id: string): void => {
        setSelectedIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
    };

    const toggleAll = (): void => {
        setSelectedIds(allSelected ? [] : selectableIds);
    };

    const confirmForce = (): void => {
        setConfirmForceOpen(false);
        void onForceSelected(selectedIds);
    };

    return (
        <AutomationCard
            title={tr('Valuable Search & Sale')}
            description={`${tr('Search every hackable server with the strongest owned SEARCH loadout, download valuable files, then sell them market by market.')} ${tr('Repeated valuable searches can also force an upcoming server into maintenance.')}`}
            alwaysAvailable
            expanded={expanded}
            onOpenChange={onOpenChange}
        >
            <details class="v2-debug-console v2-status-console" open>
                <summary class="v2-status-toggle">
                    <span class="v2-status-title">{tr('Status and report')}</span>
                </summary>
                <div class="v2-status-body">
                    <p class="v2-muted v2-valuable-status">{status && status !== 'Idle' ? tr(status) : defaultStatus(report, operation, tr)}</p>
                    {progress ? (
                        <p class="v2-muted v2-valuable-progress">
                            {phaseLabel(progress, tr)}{progress.target ? `: ${progress.target}` : ''} ({progress.index}/{progress.total}){'attempts' in progress && progress.attempts > 0 ? ` · ${progress.attempts}×` : ''}
                        </p>
                    ) : null}
                    <ul class="v2-valuable-report">
                        <li>
                            <span class="v2-item-name">{tr('Downloaded')}</span>
                            <span>{tr('{files} files · {logs} logs', { files: report?.downloadedFiles ?? 0, logs: report?.downloadedLogs ?? 0 })}</span>
                        </li>
                        <li>
                            <span class="v2-item-name">{tr('Sold')}</span>
                            <span>{tr('{count} items', { count: report?.soldItems ?? 0 })}</span>
                        </li>
                        <li>
                            <span class="v2-item-name">{tr('Unsold downloads')}</span>
                            <span class={report && report.unsoldItems > 0 ? 'v2-tag v2-tag-warn' : ''}>
                                {tr('{count} items', { count: report?.unsoldItems ?? 0 })}
                            </span>
                        </li>
                        <li>
                            <span class="v2-item-name">{tr('Total earned')}</span>
                            <span>{Math.round(report?.credits ?? 0).toLocaleString()} cr · ⭐ {Math.round(report?.reputation ?? 0)}</span>
                        </li>
                    </ul>
                </div>
            </details>

            <details class="v2-debug-console v2-status-console">
                <summary class="v2-status-toggle">
                    <span class="v2-status-title">{tr('Maintenance candidates')}</span>
                </summary>
                <div class="v2-status-body">
                    {maintenanceTargets.length === 0 ? (
                        <p class="v2-muted">{tr('No upcoming or active maintenance found. Run server search first.')}</p>
                    ) : (
                        <>
                            <label class="v2-maint-select-all">
                                <input
                                    ref={selectAllRef}
                                    type="checkbox"
                                    checked={allSelected}
                                    disabled={running || selectableIds.length === 0}
                                    onChange={toggleAll}
                                />
                                <span>{tr('Select all upcoming')} ({selectedIds.length}/{selectableIds.length})</span>
                            </label>
                            <div class="v2-maint-list">
                                {maintenanceTargets.map((target) => {
                                    const inMaintenance = target.active || Boolean(target.endsAt);
                                    return (
                                        <label class="v2-maint-row" key={target.id}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(target.id)}
                                                disabled={inMaintenance || running}
                                                onChange={() => toggleTarget(target.id)}
                                            />
                                            <span class="v2-maint-name">{target.name}</span>
                                            <span class="v2-maint-timer">{formatCountdown(target.timeUntil ?? target.endsAt, now, tr)}</span>
                                            <span class={inMaintenance ? 'v2-maint-status is-active' : 'v2-maint-status is-upcoming'}>
                                                {inMaintenance ? tr('IN MAINTENANCE') : tr('UPCOMING')}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            <div class="v2-maint-actions">
                                <button
                                    type="button"
                                    disabled={running || selectedIds.length === 0}
                                    onClick={() => setConfirmForceOpen(true)}
                                >
                                    {tr('Force maintenance on selected servers')} ({selectedIds.length})
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </details>

            <div class="v2-valuable-actions">
                {searchRunning ? (
                    <button
                        type="button"
                        class="v2-danger"
                        disabled={canceling}
                        onClick={() => void onCancel()}
                    >
                        {canceling ? tr('Cancelling…') : tr('Cancel search')}
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled={running}
                        onClick={() => void onSearch()}
                    >
                        {tr('Search all servers')}
                    </button>
                )}
                {sellRunning ? (
                    <button
                        type="button"
                        class="v2-danger"
                        disabled={canceling}
                        onClick={() => void onCancel()}
                    >
                        {canceling ? tr('Cancelling…') : tr('Cancel sale')}
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled={running}
                        onClick={() => void onSell()}
                    >
                        {tr('Sell downloads')}
                    </button>
                )}
                {maintenanceRunning ? (
                    <button
                        type="button"
                        class="v2-danger"
                        disabled={canceling}
                        onClick={() => void onCancel()}
                    >
                        {canceling ? tr('Cancelling…') : tr('Cancel force')}
                    </button>
                ) : null}
            </div>

            <Modal open={confirmForceOpen} title={tr('Confirm force maintenance')} onClose={() => setConfirmForceOpen(false)}>
                <div class="v2-maint-confirm">
                    <p>{tr('The selected servers will be forced into maintenance by repeated valuable searches. This cannot be undone.')}</p>
                    <div class="v2-maint-confirm-list">
                        {selectedTargets.map((target) => (
                            <div key={target.id} class="v2-maint-confirm-row">
                                <span>{target.name}</span>
                                <span class="v2-muted">{formatCountdown(target.timeUntil ?? target.endsAt, now, tr)}</span>
                            </div>
                        ))}
                    </div>
                    <div class="v2-actions">
                        <button type="button" onClick={() => setConfirmForceOpen(false)}>{tr('Cancel')}</button>
                        <button type="button" class="v2-danger" onClick={confirmForce}>{tr('Confirm')}</button>
                    </div>
                </div>
            </Modal>
        </AutomationCard>
    );
}
