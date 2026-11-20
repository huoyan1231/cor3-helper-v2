import { useEffect, useState } from 'preact/hooks';
import { useT, type TranslateSource } from '../i18n-context.js';
import type { DroneMissionTrackerState } from '../app/hooks/useDroneMissionTracker.js';
import type { MissionStepView, MissionWsStatus } from '../../domains/drone-mission/index.js';

export interface DroneMissionPageProps {
    readonly tracker: DroneMissionTrackerState;
    readonly inventoryStatus: string;
    readonly inventoryBusy: boolean;
    readonly onRefreshInventory: () => void;
}

function formatWait(minutes: number | null, tr: (text: string) => string): string {
    if (minutes === null) return '';
    if (minutes < 60) return `${minutes}${tr('min')}`;
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}${tr('h')}`;
}

function StepCard({
    step,
    tracker,
    tr,
    ws,
}: {
    readonly step: MissionStepView;
    readonly tracker: DroneMissionTrackerState;
    readonly tr: TranslateSource;
    readonly ws: MissionWsStatus;
}) {
    const isCurrent = step.number === ws.currentStep;
    const [open, setOpen] = useState(isCurrent);
    // WS data may arrive after first render; auto-expand whichever step becomes current.
    useEffect(() => { if (isCurrent) setOpen(true); }, [isCurrent]);
    const variants = isCurrent && ws.automatic
        ? Object.entries(ws.currentSubtaskVariants).filter(([, value]) => value !== null)
        : [];
    return (
        <article class={`v2-dm-step${step.completed ? ' v2-dm-step-done' : ''}${open ? '' : ' v2-dm-step-collapsed'}`}>
            <header class="v2-dm-step-head">
                <button
                    type="button"
                    class={`v2-dm-step-index${step.completed ? ' is-done' : ''}`}
                    disabled={tracker.busy}
                    title={tr(step.completed ? 'Mark step as not done' : 'Mark step as done')}
                    onClick={() => void tracker.toggleStep(step.number)}
                >
                    {step.completed ? '✓' : step.number}
                </button>
                <button
                    type="button"
                    class="v2-dm-step-title v2-dm-step-toggle"
                    aria-expanded={open}
                    aria-label={open ? tr('Collapse {name}', { name: step.title }) : tr('Expand {name}', { name: step.title })}
                    onClick={() => setOpen(!open)}
                >
                    <strong><span class="v2-dm-step-caret">{open ? '▾' : '▸'}</span>{step.title}</strong>
                    <span class="v2-muted">{step.number === 4 ? tr('No requirements') : `${step.itemGroups.length + step.crOnlyGroups.length + step.choiceGroups.length} ${tr('groups')}`}</span>
                </button>
                {variants.length > 0 ? (
                    <div class="v2-dm-variants">
                        {variants.map(([key, value]) => (
                            <span key={key} class={value === 'BUY' ? 'v2-dm-variant-buy' : 'v2-dm-variant-barter'}>
                                {key}: {value === 'BUY' ? tr('Buy with CR') : tr('Barter')}
                            </span>
                        ))}
                    </div>
                ) : null}
            </header>

            {open ? <div class="v2-dm-step-body">
            {step.itemGroups.map((group) => (
                <div class={`v2-dm-group${group.done || group.skipped ? ' v2-dm-group-closed' : ''}`} key={group.groupId}>
                    <div class="v2-dm-group-head">
                        <span class="v2-dm-group-label">{group.label}</span>
                        <span class="v2-dm-skip">{tr('Skip')} {group.skipCr.toLocaleString()} CR</span>
                    </div>
                    <div class="v2-dm-item-list">
                        {group.items.map((entry, index) => (
                            <div class="v2-dm-item" key={`${group.groupId}-${index}`}>
                                <span class="v2-dm-item-name" title={entry.name}>{entry.name}</span>
                                <span class="v2-dm-item-qty">{entry.owned} / {entry.required}</span>
                                <span class={entry.missing > 0 ? 'v2-dm-missing' : 'v2-dm-ok'}>
                                    {entry.missing > 0 ? `-${entry.missing}` : tr('OK')}
                                </span>
                                {!entry.exactMatch ? <span class="v2-dm-unmatched" title={tr('No itemConfigId yet; matched by name')}>?</span> : null}
                            </div>
                        ))}
                    </div>
                    <div class="v2-dm-group-actions">
                        <button type="button" disabled={tracker.busy} onClick={() => void tracker.toggleGroup(group.groupId)}>
                            {group.done ? tr('Undo complete') : tr('Group done')}
                        </button>
                        <button type="button" disabled={tracker.busy} onClick={() => void tracker.toggleSkip(group.groupId)}>
                            {group.skipped ? tr('Undo skip') : tr('Paid / skipped')}
                        </button>
                    </div>
                </div>
            ))}

            {step.crOnlyGroups.map((group) => (
                <div class={`v2-dm-group v2-dm-cr-only${group.done ? ' v2-dm-group-closed' : ''}`} key={group.groupId}>
                    <div class="v2-dm-group-head">
                        <span class="v2-dm-group-label">{group.label}</span>
                        <strong class="v2-dm-required-cr">{group.requiredCr.toLocaleString()} CR</strong>
                    </div>
                    <div class="v2-dm-group-meta">
                        <span class="v2-dm-cr-tag">{tr('CR only')}</span>
                        {group.waitMinutes !== null ? <span>{tr('Wait')} {formatWait(group.waitMinutes, tr)}</span> : null}
                    </div>
                    <div class="v2-dm-group-actions">
                        <button type="button" disabled={tracker.busy} onClick={() => void tracker.toggleGroup(group.groupId)}>
                            {group.done ? tr('Undo paid') : tr('Paid')}
                        </button>
                    </div>
                </div>
            ))}

            {step.choiceGroups.map((group) => (
                <div class="v2-dm-group v2-dm-choice" key={group.groupId}>
                    <div class="v2-dm-group-head">
                        <span class="v2-dm-group-label">{group.label}</span>
                        {group.selectedKey === null ? <span class="v2-muted">{tr('Choose one')}</span> : null}
                    </div>
                    <div class="v2-dm-choice-options">
                        {group.options.map((option) => (
                            <button
                                type="button"
                                key={option.key}
                                disabled={tracker.busy}
                                class={group.selectedKey === option.key ? 'is-selected' : ''}
                                onClick={() => void tracker.selectChoice(group.groupId, option.key)}
                            >
                                <strong>{option.label}</strong>
                                <span>{formatWait(option.waitMinutes, tr)} · {tr('Skip')} {option.skipCr.toLocaleString()} CR</span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
            </div> : null}
        </article>
    );
}

export function DroneMissionPage({ tracker, inventoryStatus, inventoryBusy, onRefreshInventory }: DroneMissionPageProps) {
    const tr = useT();
    const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
    const { summary, shortages, steps, ws, diagnostics } = tracker.viewModel;
    const percent = summary.totalSteps === 0 ? 0 : Math.round((summary.completedSteps / summary.totalSteps) * 100);
    const sourceLabel = diagnostics.source === 'live'
        ? tr('live WS')
        : diagnostics.source === 'persisted'
            ? tr('saved snapshot')
            : tr('no data');
    const stamp = diagnostics.source === 'persisted' && diagnostics.storedAt
        ? diagnostics.storedAt
        : diagnostics.capturedAt;

    return (
        <div class="v2-dm-page">
            <section class="v2-dm-hero">
                <div class="v2-dm-hero-top">
                    <div>
                        <h2>{tr('Drone Task Tracker')}</h2>
                        <p class="v2-muted">{tr('Track the 15-step drone mission against your current stash.')}</p>
                    </div>
                    <div class="v2-dm-hero-actions">
                        <button type="button" class="v2-dm-refresh" disabled={inventoryBusy || tracker.busy} onClick={() => void tracker.reloadWs()}>
                            {tr(ws.automatic ? 'Refresh WS' : 'Load WS progress')}
                        </button>
                        <button type="button" class="v2-dm-refresh" disabled={inventoryBusy || tracker.busy} onClick={onRefreshInventory}>
                            {inventoryBusy ? tr('Refreshing...') : tr('Refresh stash')}
                        </button>
                    </div>
                </div>
                <div class="v2-dm-ws-badge" data-mode={ws.automatic ? 'auto' : 'manual'}>
                    {ws.automatic
                        ? tr('Auto progress: step {step} in game · {source}').replace('{step}', String(ws.currentStep)).replace('{source}', sourceLabel)
                        : tr('Manual progress · WS source: {source}').replace('{source}', sourceLabel)}
                </div>
                <div class="v2-dm-progress-bar"><span style={{ width: `${percent}%` }} /></div>
                <div class="v2-dm-summary-grid">
                    <article><span>{tr('Progress')}</span><strong>{summary.completedSteps} / {summary.totalSteps}</strong></article>
                    <article><span>{tr('Missing item kinds')}</span><strong class={summary.missingKinds > 0 ? 'v2-dm-alert' : ''}>{summary.missingKinds}</strong></article>
                    <article><span>{tr('Required CR')}</span><strong class="v2-dm-cr">{summary.requiredCr.toLocaleString()}</strong></article>
                    <article><span>{tr('Skip CR (all groups)')}</span><strong class="v2-dm-skip-value">{summary.skippableCr.toLocaleString()}</strong></article>
                </div>
                {summary.unmatchedKinds > 0 ? (
                    <p class="v2-dm-notice">{tr('{count} item(s) have no itemConfigId yet and are matched by name only.').replace('{count}', String(summary.unmatchedKinds))}</p>
                ) : null}
                <p class="v2-muted v2-dm-status">{inventoryStatus}</p>
                {tracker.error ? <p class="v2-dm-error">{tracker.error}</p> : null}
            </section>

            <section class="v2-dm-chips">
                {steps.map((step) => (
                    <button
                        type="button"
                        key={step.number}
                        disabled={tracker.busy}
                        class={step.completed ? 'is-done' : ''}
                        title={step.title}
                        onClick={() => void tracker.toggleStep(step.number)}
                    >
                        {step.number}
                    </button>
                ))}
            </section>

            <section class="v2-dm-steps">
                {steps.map((step) => <StepCard key={step.number} step={step} tracker={tracker} tr={tr} ws={ws} />)}
            </section>

            <section class="v2-dm-shortages">
                <h3>{tr('Global shortage')}</h3>
                {shortages.length === 0 ? (
                    <p class="v2-muted">{tr('No outstanding item requirements.')}</p>
                ) : (
                    <div class="v2-dm-table-wrap">
                        <table>
                            <thead><tr><th>{tr('Item')}</th><th>{tr('Required')}</th><th>{tr('Owned')}</th><th>{tr('Missing')}</th><th>{tr('Match')}</th></tr></thead>
                            <tbody>
                                {shortages.map((entry) => (
                                    <tr key={entry.key}>
                                        <td title={entry.groupIds.join(', ')}>{entry.name}</td>
                                        <td>{entry.required}</td>
                                        <td>{entry.owned}</td>
                                        <td class={entry.missing > 0 ? 'v2-dm-missing' : 'v2-dm-ok'}>{entry.missing}</td>
                                        <td>{entry.exactMatch ? tr('itemConfigId') : tr('Name only')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section class="v2-dm-diagnostics-section">
                <button
                    type="button"
                    class="v2-dm-diagnostics-toggle"
                    aria-expanded={diagnosticsOpen}
                    aria-label={diagnosticsOpen ? tr('Collapse {name}', { name: tr('Diagnostics') }) : tr('Expand {name}', { name: tr('Diagnostics') })}
                    onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
                >
                    <strong><span class="v2-dm-step-caret">{diagnosticsOpen ? '▾' : '▸'}</span>{tr('Diagnostics')}</strong>
                </button>
                {diagnosticsOpen ? (
                    <div class="v2-dm-diagnostics" data-source={diagnostics.source}>
                        <div class="v2-dm-diag-row"><span>{tr('Data source')}</span><strong>{sourceLabel}</strong></div>
                        <div class="v2-dm-diag-row"><span>{tr('list.history (completed steps)')}</span><strong class={diagnostics.hasHistory ? 'v2-dm-ok' : 'v2-dm-alert'}>{diagnostics.hasHistory ? tr('Captured') : tr('Not captured')} · {diagnostics.detectedCompletedSteps} {tr('done')}</strong></div>
                        <div class="v2-dm-diag-row"><span>{tr('get.page (current step + ids)')}</span><strong class={diagnostics.hasPage ? 'v2-dm-ok' : 'v2-dm-alert'}>{diagnostics.hasPage ? tr('Captured') : tr('Not captured')}</strong></div>
                        <div class="v2-dm-diag-row"><span>{tr('Last updated')}</span><strong>{stamp > 0 ? new Date(stamp).toLocaleString() : tr('never')}</strong></div>
                    </div>
                ) : null}
            </section>

            <footer class="v2-dm-footer">
                <p class="v2-muted">{tr('Progress is saved locally. A future update may read progress from game WS data automatically.')}</p>
                <button type="button" disabled={tracker.busy} onClick={() => void tracker.clear()}>{tr('Clear progress')}</button>
            </footer>
        </div>
    );
}
