# AGENTS.md — cor3-helper (v2)

## Current branch

`v2` is the 2.0 rewrite branch. The v1 implementation is no longer present in the working tree; it remains available in git history (`main`, `experimental`, and the `v2` ancestry).

- All extension source lives under `src/`.
- v1 is a behavior reference only. Do not reintroduce v1 source or its static path table.
- The development build writes to `dist/`.

## Commands

```bash
npm run typecheck       # strict TypeScript check
npm test                # Vitest
npm run lint            # oxlint src
npm run build           # build extension -> dist/
npm run build:min       # minified build -> dist/
npm run bump -- 2.4.0   # one-shot: bump version+versionCode, build, commit, tag v2.4.0
```

## Hard rules

1. All new source is TypeScript (`.ts`/`.tsx`). Do not add new `.js` source.
2. Domain code must not import `chrome`, `window`, `document`, WebSocket, fetch, or IndexedDB.
3. Application code depends on ports, not concrete infrastructure.
4. UI components use Preact and do not call browser/game APIs directly.
5. Validate external data with Zod at the boundary only.
6. Do not persist bearer tokens.
7. Redact tokens, JWTs, cookies, and session IDs from logs/exports.
8. Do not use a global event bus or service locator.
9. Do not edit architecture decisions silently; add an ADR/open item instead.
10. Do not recreate the v1 static path table in new code.
11. Increment `cor3Fork.versionCode` in `package.json` by exactly 1 on every commit.
12. When adding or changing a feature, update `AGENTS.md` and the relevant docs under `docs/` in the same change.

### Version code rule

Every commit bumps `package.json` → `cor3Fork.versionCode` by 1 (e.g. 301 → 302). This counter is injected by `build.js` as `__COR3_VERSION_CODE__` and is the **single source of truth for update detection**: `UpdateChecker` prompts only when the remote `update.json` `versionCode` is strictly greater than the local one. Ordinary post-release commits raise only the local counter, so a stale remote baseline cannot create a false update prompt. Do **not** edit `update.json` by hand — it is the remote release baseline published to GitHub raw and is kept in sync only by `bump.mjs`. This rule is independent of semantic version bumps (`package.json.version` / `manifest.json` / `package-lock.json`) and tagging.

For a version bump, run `npm run bump -- <x.y.z>` (script `bump.mjs`): it updates all version fields plus versionCode, mirrors `versionName` and the new versionCode into `update.json`, builds, commits and creates the annotated tag in one shot. Avoid doing these steps by hand.

### Documentation sync rule

Any change that adds or modifies user-facing behavior, contracts, ports or protocols must update `AGENTS.md` and the relevant `docs/` files in the same change. Key docs: `docs/cor3-ws-events.md` (WS frames), `docs/security.md` (tokens), and `docs/architecture/cor3-helper-2.0-feature-inventory-and-tech-debt.md` (feature history — add a new dated Part, keep old Parts as history). Update version anchors when bumping the version. Do not silently let docs drift from code.

## Architecture

See:

- `ARCHITECTURE.md`
- `MODULES.md`
- `docs/architecture/cor3-helper-2.0-architecture-decision-record.md`
- `docs/architecture/cor3-helper-2.0-architecture-audit.md`
- `docs/architecture/cor3-helper-2.0-feature-inventory-and-tech-debt.md`

Background context composition and per-domain modules:

- `src/contexts/background/index.ts` (composition root)
- `src/contexts/background/handlers/` (bridge adapters)
- `src/contexts/background/automation/` (automation coordinators)
- `src/contexts/background/composition/` (runtime wiring)

Inventory bulk sell:

- `PopupPortal.previewInventoryFilter()` / `sellInventoryFilter()` accept optional `excludeNames` and `allowCraft` options passed through the `inventory.previewFilter` / `inventory.sellFilter` bridge commands.
- The Game → Inventory "Sell all except Artificial milk" action uses `tiers: ['COMMON', 'RARE']`, `tag: 'any'`, `excludeNames: ['Artificial milk']`, `allowCraft: true`.
- That action's first click previews the filter and opens a `Modal` with eligible quantity, estimated income and protected stacks. Cancel, Escape or backdrop closes it; only the modal's Confirm calls `sellInventoryFilter()`. The button itself keeps a fixed label and no longer uses two-click label toggling as its second confirmation.
- The per-item quick Sell opens a `Modal` to pick a quantity (1..group total) with a "sell all same items" shortcut. `useInventory.sellInventoryItem()` walks the group's stacks in order, calling `portal.sellInventoryItem()` per stack until the requested quantity is sold; `sellingGroupKey` guards concurrent sales.
- `planInventoryBatchSell()` remains the single safety gate: items above RARE, non-sellable items and zero-price items are always reported as protected.

Wings of Mars tracker:

- `useDroneMissionTracker()` is composed once in `SidePanelApp`, not inside `DroneMissionPanel`, so its WS snapshot survives tab switches. `DroneMissionPanel` is a pure display component that receives the tracker plus inventory status via props.
- On mount the tracker paints the persisted snapshot via `droneBuild.view?cachedOnly=true` first, then refreshes from the game with a normal `droneBuild.view`; the manual refresh button always uses the full path. This keeps the live → passive → persisted fallback for ordinary calls.
- `planMissionSurplusSell()` (domain) builds the "sell surplus" plan from the mission catalog, effective progress and live stash: keep the required quantity of each mission item (itemConfigId first, then name/aliases), sell the surplus plus every other COMMON/RARE sellable stack. Done/skipped groups reserve nothing. The page shows a confirm modal and executes via `portal.sellInventoryItem()` per stack.
- The active page is persisted in `v2.workspace-view` and restored on the next open. `shouldRedirectFromDroneMission()` must not redirect a restored `droneMission` page while settings are still `null`: the shell's pre-load `hideWingsOfMars` default is `true`, so redirecting early would send the user to `game` and persist that as their start page. Only a loaded setting with `hideWingsOfMars: true` (tracker finished / tab hidden) may perform the redirect.

Force maintenance (v1 parity, inside Valuable Search & Sale):

- `MAINTENANCE_ORDER` in `src/domains/valuable/maintenance-order.ts` is the built-in 44-server force order. A server matches only when both `name` and `ip` equal the catalog entry exactly; IP strings are stored verbatim (`855.529.2.04` is not normalized). `planMaintenanceTargets()`, `listMaintenanceCandidates()` and `planSelectedMaintenanceTargets()` keep only listed, upcoming (`!active && !endsAt && timeUntil`) servers and sort strictly by `maintenance_id` ascending. Unlisted and unforceable servers are skipped, and UI selection order is ignored. `MaintenanceTarget` exposes `ip` and `maintenanceOrder` through the bridge schema for the `#n` labels. Route distance remains only for diagnostics; `maintenanceStarted()` treats either `active` or a future `endsAt` as started (v1 used `maintenanceEndsAt`).
- `MaintenanceForceService.force()` (application) reuses the SEARCH loadout hook and repeatedly calls `file.search-valuable` via `server.searchFiles()`. `GameSocketHub` records `network-map:maintenance` pushes during a search and `ChromeTabValuableActionAdapter` exposes them as `ValuableSearchResult.maintenanceStarted`; the service stops immediately on that flag, matching v1's event-driven loop. Full `NetworkSnapshotService.get(true)` is only a bounded fallback (`mapCheckEvery`, default 10 attempts), an immediate check on `access-denied`, and one final refresh for the whole batch. Bounded by 50 attempts/server with cancellable progress; browser-free and port-driven.
- `valuable.forceMaintenance` is a bridge command sharing `valuableRunSchema`; `ValuableCoordinator.runMaintenance()` runs it through `networkOps`, publishes `valuable.progress` and logs to run logs. `ValuableRunState` now covers `operation: 'search' | 'sell' | 'maintenance'` and a union of the search/sale and maintenance progress shapes; `PopupPortal.forceMaintenance()` exposes it to `useValuable` / `ValuableSellerCard`.
- Manual selection: `listMaintenanceCandidates()` lists only listed upcoming servers via `valuable.maintenanceTargets`, already in catalog order; `ValuableSellerCard` shows a "select all upcoming" checkbox (with indeterminate state) plus checkbox rows with `#maintenance_id`, countdown and status. The "Force maintenance on selected servers" button opens a confirmation modal listing the chosen servers in that same order before `onForceSelected` → `valuable.forceMaintenance` with `serverIds`. `planSelectedMaintenanceTargets()` re-sorts by catalog order, so checkbox order never changes execution order. A failed server is recorded in `failed` and the next catalog server still runs. There is no separate one-click force-all button; the domain/service keep the no-ids path as a backward-compatible fallback.
- UI liveness: `useValuable` treats `valuableReport.active: null` and a missing `valuableProgress` record as "no run", clearing `valuableRunId` / `valuableOperation` / `valuableProgress` / `valuableCanceling`. `resolveReportRunState()` never clobbers a locally starting run (`valuableStartLock`). Otherwise a completed background run leaves `runId` non-null, `ValuableSellerCard.running` stays true, and the force-maintenance confirmation button is permanently disabled.

Daily ops state loading:

- `useDaily()` loads both `autoDailyStatus` and `dailyView` on mount. `dailyView` reads the persisted `v2.dailyOpsCache` first, so the Auto Daily "Today" card and Overview timers show the saved claimed/unclaimed state immediately instead of flashing "unclaimed" until a later poll. The 15 s poll runs on the automation and overview pages regardless of the Auto Daily switch, since `daily` is an independent view model.

Auth status display:

- `useSettings()` polls `auth.status` every 15 s in addition to the initial load, because `ChromeTabAuthAdapter.status()` queries the live game tab. The content script emits `game.readiness` on every game page load (manual reload or Auto Refresh), and `usePortalEvents` calls `reloadAuth` on that event so the top-right auth tag updates immediately. The toolbar `WelcomeApp` has the same 15 s poll plus `game.readiness` subscription. The tag remains clickable via `refreshSession` in `SidePanelApp`.

Auto Expedition resilience:

- The main-cycle interval `autoExpeditionIntervalMinutes` (5-1440, default 30) is editable in Settings → Basic as "Auto Expedition interval"; `settings.update` recreates `AUTO_EXPEDITION_ALARM` on change. `enableAutoExpedition()` no longer takes an interval so toggling the switch cannot overwrite the setting with a stale UI value.
- Transient credit failures (reward payout, threshold check, launch) pause the cycle with a retry alarm via `ExpeditionCycle.pauseAndRetry()`; they no longer write `autoExpeditionEnabled: false`. Only explicit user/helper-mode/config changes disable the switch.
- `useExpeditions()` keeps `expeditionLoading` (view refresh) separate from `expeditionBusy` (toggle in progress). The initial `expeditionView()` poll only disables the refresh button, never the "Auto start mercenary expedition" switch.
- The "Auto start mercenary expedition" switch is disabled **only** by local toggle work (`expeditionBusy` via `mercBusy`), never by the background cycle's `autoExpedition.running`. Opening the side panel wakes the service worker and `bootstrap.ts` may start a cycle, but enabling/disabling is an immediate settings+alarm operation that is safe during a run, so users must be able to toggle at any time. The refresh and decision buttons keep their `running` guard.
- The mercenary simple-decision dropdown only offers `off`, `loot` and `risk`. Do not reintroduce `mercDecisionPolicy: 'veterans'`: it would force high-risk choices for **every** expedition, duplicating and widening the dedicated `mercGetRidOfVeterans` switch, which overrides only VETERAN-mercenary expeditions. The value stays schema-valid for old saves and is migrated on read to `mercGetRidOfVeterans: true` + `loot`.
- Expeditions that the game has already paid out stay in the archived room forever with `status: COMPLETED`. `isExpeditionSettled()` treats a non-empty `containerOpenedAt` as settled; `isExpeditionReady()` returns false for those entries so the UI no longer shows "awaiting payment" and `readyExpeditions()` does not re-open the container. `partitionExpeditions()` hides settled entries, and both `mapExpeditionOverview()` and the Auto Expedition launch/cycle guards exclude them from "in-progress" so a settled expedition cannot block the next launch. `containerOpenedAt` / `outcome` are carried through the raw contract, domain model and the strict popup bridge schema.

Upstream `v2` merge (2026-11-22):

- Update checks keep fork semantics: `ChromePopupPortal.updateCheck()` reads the fork's `update.json` first and compares integer `versionCode`; bridge `system.updateCheck` is only the fallback. Upstream's `UpdateCheckService`/`UpdateCheckStore`, `system.updateStatus` cache and `UpdateStatus` UI are retained, but semantic-version comparison never decides an update. Upstream's "no direct fetch in popup" test was adapted to this fork behavior.
- Mercenary decisions support both surfaces: fork flags (`mercGetRidOfVeterans`, `mercInsureVeterans`) and upstream decision mode/score weights (`mercDecisionMode`, `mercDecisionScoreLoot`, `mercDecisionScoreRisk`). `ExpeditionCycle.autoRespond()` passes them together; selection data carries both `insurance` and `insuranceCost`.
- Upstream auto-job completion barriers, job-state store/reconciler/recorder and market-completed-jobs store are adopted. Background composition registers both the fork toolbar opener and upstream update lifecycle; `AppShell` still receives `ping` / `hasEndpoint` from `SidePanelApp`.

Upstream `v2` merge (2026-11-26, v2.0.9/v2.0.10):

- Fork identity stays authoritative: `version: 2.5.7`, `releaseLabel: huoyan1231`, `cor3Fork.versionCode` and `bump.mjs`. Upstream `build` / `bump:build` are not adopted because `src/tools/release/bump.ts` was removed from this fork.
- The 10 conflicts were resolved as a union. Fork keeps direct `update.json` + `versionCode` checking, maintenance force, warm workspace cache, minigame lock, v1 already-claimable ordering, inventory filter options, drone-build view, auto page refresh and `enableAutoExpedition()`'s optional interval. Upstream adds `dumpLoadout`, market-selection/skip-reason status, target-access preflight, route access recovery, HACK error recovery, requirement modes (`none`/`known`/`unknown`), monotonic `useJobs` snapshot guards, and every-run claimable barrier release restricted to `unconfirmed` records.
- The bounded `+1` decrypt loadout retry remains only as a fallback after an insufficient post-loadout analysis; the primary plan passes the observed power with requirement mode `unknown`. `useJobs` keeps warm bootstrap initialization and adds the upstream sequence/timestamp guards.
- The upstream v2.0.9/v2.0.10 feature-inventory Parts 71/72 are recorded as Parts 78/79 in the fork to avoid the original numbering collision with the fork's Parts 71/72.

Auto Jobs report freshness:

- `AutoFinish.last` is persisted and restored on background startup. It must not override a newer `AutoJobsSnapshot`: `selectShownJobReport()` prefers a live Auto Finish run, then a last report only when its timestamp is at least as new as `snapshotAt`, otherwise it falls back to the current snapshot. Do not copy the persisted `last` report into the manual `jobReport` on load.

Workspace warm cache:

- The side panel paints from a persisted `WorkspaceBootstrap` before live hook refreshes. `WorkspaceBootstrapService` only projects read-only sources the background already owns (settings, cached auth status, network summary, Auto Jobs snapshot, daily cache and cached market reputations); it must never send game commands or re-fetch markets. A failed source keeps its last known value so a transient game-tab error cannot make the panel cold.
- The warm cache must **never own a timer**. `startSchedulers()` clears any legacy `v2-workspace-warm` alarm on every worker start and refreshes the snapshot from already-loaded stores instead. `system.workspaceBootstrap` returns the cached value first and triggers a fire-and-forget refresh for the next open. A periodic alarm restarts the MV3 worker, which re-runs startup automation and can switch the game endpoint while the user is in a manually started minigame.
- `system.workspaceBootstrap` is the only bridge command for this cache. The side-panel entry reads it in parallel with `getWorkspaceView()` and passes it to `useSettings`, `useNetwork`, `useJobs` and `useDaily`; those hooks initialize state from the snapshot and still run their normal silent live refresh on mount. The toolbar `WelcomeApp` uses the same snapshot for settings/auth. Do not move storage access into UI components.
- Global minigame lock: `hasActiveMinigameLock()` is checked only at automation entry points (`AutoJobsCoordinator.ensureInfo()` and `AutoFinishCoordinator.run()`). The game records that lock only for `start.minigame` frames without a token, so plugin-driven minigames do not block themselves; an in-flight auto job is never cancelled, only new cycles/refreshes yield until `lockExpiresAt`, then resume via the normal schedule.

Decrypt loadout power:

- `get.file.analysis.decryptPower` is the **currently equipped module's power**, not the file's required power. Do not feed it back as `requiredPower` unchanged: a targeted `strategy: 'best'` loadout keeps the current hardware when its power already meets that value, which can strand a file (e.g. `.12vvsh` encryption level `[20,24]`) one step below the threshold forever. When `canDecrypt=false` after a loadout and `decryptPower > 0`, `JobExecutionService` retries `beforeDecrypt` exactly once with `requiredPower = decryptPower + 1` so a stronger plan (better hardware for the same software) is considered, then re-reads the analysis; only a still-false result becomes `DECRYPT_POWER_INSUFFICIENT`. Keep this upgrade bounded to one attempt.

Automatic page refresh:

- The separate "Auto Refresh" tab configures `autoPageRefreshEnabled`, `autoPageRefreshIntervalMinutes` (1-1440, default 60) and `autoPageRefreshWaitWhileWorking`. `AutoPageRefreshCoordinator` uses a one-shot `AUTO_PAGE_REFRESH_ALARM` at `nextRefreshAt`; after a successful `chrome.tabs.reload` it writes `lastRefreshAt` and starts the next interval.
- With "wait while working" enabled, the coordinator checks Auto Expedition, Auto Jobs/Auto Finish/job queue, Auto Daily and active minigame lock. If any are running it retries every 30 seconds for up to 10 minutes; it refreshes immediately once idle and force-refreshes when the timeout expires. Status/busy keys are exposed through `autoPageRefresh.status`.
- The new feature is part of Helper Mode's saved/disabled automation snapshot. State is persisted in `AutoPageRefreshStateStore`; bridge/UI never call Chrome APIs directly.
- `AutoRefreshPage` uses the same collapsible `GameSection` card as the other tabs (instead of a bare `v2-card`); its expanded state is persisted under the `auto-refresh` key in `settings.panelOpenState` and defaults to open.

Complete-unknown claim recovery:

- A fresh market row with `alreadyTaken && canComplete` is positive evidence that an unconfirmed `Complete` did not grant the reward. `JobStateReconciler` may release that exact-reset barrier once and transition to `ready-to-claim` with `completeRecoveryAttemptedAt`; Auto Finish then claims it through the normal claim-only path. Claim-only jobs are sorted first each run, matching v1's "claim rewards first" behavior.
- Since the upstream v2.0.8 merge, the reconciler's decision is time-gated: `taken-claimable` only becomes `recoverable` (`reason: 'remote-claimable-recovery'`) after the record's `updatedAt` is at least `CLAIMABLE_RECOVERY_COOLDOWN_MS` (15 minutes) old. The decision function receives both the full `recoveryRecord` and the `allowClaimableRecovery` boolean; `recoveryRecord` is retained as contract surface but does not gate the decision, so a cooled-down record may be retried again after a later failed recovery.
- The execution path keeps the fork's safety: `releaseClaimRecoveryBarrier()` uses `MarketCompletionStorePort.releaseUnconfirmed()` with an exact `expectedStoredResetAt` CAS; null/unknown-reset and identity-less sidecar barriers are never auto-released. `completionFailures` is incremented on release failure, `completeRecoveryAttemptedAt` is written on success, and `restoreClaimRecoveryBarrier()` re-arms the barrier if the state write fails.
- The same exact-reset barrier release also applies when a **non-uncertain** record (for example `failed`) is reconciled to `ready-to-claim` by a `taken-claimable` row. Without it, the UI showed "ready to claim" while the sidecar still blocked the next claim-only run. The barrier is probed only when this market/job actually has one; a mismatch (including identity-less `unknown`) downgrades the decision to `pending` and leaves the local status untouched. No `completeRecoveryAttemptedAt` is written for this path.
- Transient `Complete` failures (`market-not-reachable`, rate limit, busy) retry through `completeWithTransientRetry()`: the retry refreshes the job row and calls `beforeComplete(job, { force: true })`. `JobRouting.setEndpointIfNeeded()` then uses a live `snapshots.get(true)` and re-applies `setEndpoint` instead of trusting a cached endpoint match; `complete()` still invokes the hook exactly once per attempt. This restores v1's forced `stepSetEndpoint()` behavior without duplicating Complete requests.
- `JobStateRecord.completeRecoveryAttemptedAt` and `MarketCompletionStorePort.releaseUnconfirmed()` remain the contract surface. Do not weaken the expected-reset CAS check or allow null-reset auto-release.

Collapsible card/panel state persistence:

- All collapsible UI cards and sub-sections must remember their expanded/collapsed state across side-panel restarts. The single source of truth is `settings.panelOpenState` (`Record<string, boolean>`), persisted via `settings.update`; there is no separate UI-state store. `useSettings.panelOpen` / `updatePanelOpen(key, open)` is the only UI access path — components receive `expanded` + `onOpenChange` (or `panelOpen` + `updatePanelOpen` for `<details>`) via props and never touch Chrome APIs.
- `updatePanelOpen` must compute the next state synchronously from a `panelOpenRef` (initialized from persisted settings) and call `portal.updateSettings` **outside** any `setState` updater. Putting the write inside a `setState((current) => ...)` callback loses writes when Preact batches/skips the updater, which is why rapid toggles on multiple automation cards failed to persist.
- Shared collapsibles (`GameSection`, `AutomationCard`, `InfoPanel`) use the controlled/uncontrolled pattern `expanded ?? internalOpen`: pass a `panelOpen[key]` value to persist, or omit it to keep local state. Use stable `page.area` keys (e.g. `overview.timer.daily`, `drone-mission.step.3`, `valuable-seller.status`); for dynamic items use a business id, never an array index.
- `DroneMissionPage` step cards only auto-expand the current step while no persisted choice exists (`expanded === undefined`); an explicit saved choice is never overridden by incoming WS data.
- `AutomationCard` with `persistentSwitch` only auto-expands on an `enabled` transition while uncontrolled (`expanded === undefined`). Controlled cards must not call `onOpenChange(true)` when settings finish loading: the initial `false → true` enable would otherwise overwrite the persisted collapsed choice and mark panel state initialized before it is read. An explicit click on the enable switch still expands the card via its own `setOpen(true)`.
- `AutoJobsCard` keeps the market job list plus its action buttons and Auto Finish status inside a collapsible `<details>` under the `auto-jobs.job-list` key (default open). The separate `auto-jobs.status` and `auto-complete` details remain independent keys.

## Definition of done

- typecheck passes
- tests pass
- lint passes
- build passes
- behavior parity is checked for any replaced feature
- docs/ADR updated for cross-cutting changes
- `AGENTS.md` and affected `docs/` files updated (see Documentation sync rule)
