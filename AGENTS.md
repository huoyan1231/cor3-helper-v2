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
- The per-item quick Sell opens a `Modal` to pick a quantity (1..group total) with a "sell all same items" shortcut. `useInventory.sellInventoryItem()` walks the group's stacks in order, calling `portal.sellInventoryItem()` per stack until the requested quantity is sold; `sellingGroupKey` guards concurrent sales.
- `planInventoryBatchSell()` remains the single safety gate: items above RARE, non-sellable items and zero-price items are always reported as protected.

Wings of Mars tracker:

- `useDroneMissionTracker()` is composed once in `SidePanelApp`, not inside `DroneMissionPanel`, so its WS snapshot survives tab switches. `DroneMissionPanel` is a pure display component that receives the tracker plus inventory status via props.
- On mount the tracker paints the persisted snapshot via `droneBuild.view?cachedOnly=true` first, then refreshes from the game with a normal `droneBuild.view`; the manual refresh button always uses the full path. This keeps the live → passive → persisted fallback for ordinary calls.
- `planMissionSurplusSell()` (domain) builds the "sell surplus" plan from the mission catalog, effective progress and live stash: keep the required quantity of each mission item (itemConfigId first, then name/aliases), sell the surplus plus every other COMMON/RARE sellable stack. Done/skipped groups reserve nothing. The page shows a confirm modal and executes via `portal.sellInventoryItem()` per stack.

Force maintenance (v1 parity, inside Valuable Search & Sale):

- `planMaintenanceTargets()` selects upcoming-maintenance servers (`!active && !endsAt && timeUntil`), furthest-first by route length. `maintenanceStarted()` treats either `active` or a future `endsAt` as started (v1 used `maintenanceEndsAt`).
- `MaintenanceForceService.force()` (application) reuses the SEARCH loadout hook and repeatedly calls `file.search-valuable` via `server.searchFiles()`; after each search it force-refreshes `NetworkSnapshotService.get(true)` (a live `get.map`) to confirm maintenance. Bounded by 50 attempts/server with cancellable progress; browser-free and port-driven.
- `valuable.forceMaintenance` is a bridge command sharing `valuableRunSchema`; `ValuableCoordinator.runMaintenance()` runs it through `networkOps`, publishes `valuable.progress` and logs to run logs. `ValuableRunState` now covers `operation: 'search' | 'sell' | 'maintenance'` and a union of the search/sale and maintenance progress shapes; `PopupPortal.forceMaintenance()` exposes it to `useValuable` / `ValuableSellerCard`.
- Manual selection: `listMaintenanceCandidates()` lists every upcoming/active server via `valuable.maintenanceTargets`; `ValuableSellerCard` shows a "select all upcoming" checkbox (with indeterminate state) plus checkbox rows with countdown and status — only upcoming rows are selectable. The "Force maintenance on selected servers" button opens a confirmation modal listing the chosen servers before calling `onForceSelected` → `valuable.forceMaintenance` with `serverIds` (routed through `planSelectedMaintenanceTargets()`, furthest-first). There is no separate one-click force-all button; the domain/service keep the no-ids path as a backward-compatible fallback.

Daily ops state loading:

- `useDaily()` loads both `autoDailyStatus` and `dailyView` on mount. `dailyView` reads the persisted `v2.dailyOpsCache` first, so the Auto Daily "Today" card and Overview timers show the saved claimed/unclaimed state immediately instead of flashing "unclaimed" until a later poll. The 15 s poll runs on the automation and overview pages regardless of the Auto Daily switch, since `daily` is an independent view model.

Auth status display:

- `useSettings()` polls `auth.status` every 15 s in addition to the initial load, because `ChromeTabAuthAdapter.status()` queries the live game tab. The content script emits `game.readiness` on every game page load (manual reload or Auto Refresh), and `usePortalEvents` calls `reloadAuth` on that event so the top-right auth tag updates immediately. The toolbar `WelcomeApp` has the same 15 s poll plus `game.readiness` subscription. The tag remains clickable via `refreshSession` in `SidePanelApp`.

Auto Expedition resilience:

- The main-cycle interval `autoExpeditionIntervalMinutes` (5-1440, default 30) is editable in Settings → Basic as "Auto Expedition interval"; `settings.update` recreates `AUTO_EXPEDITION_ALARM` on change. `enableAutoExpedition()` no longer takes an interval so toggling the switch cannot overwrite the setting with a stale UI value.
- Transient credit failures (reward payout, threshold check, launch) pause the cycle with a retry alarm via `ExpeditionCycle.pauseAndRetry()`; they no longer write `autoExpeditionEnabled: false`. Only explicit user/helper-mode/config changes disable the switch.
- `useExpeditions()` keeps `expeditionLoading` (view refresh) separate from `expeditionBusy` (toggle in progress). The initial `expeditionView()` poll only disables the refresh button, never the "Auto start mercenary expedition" switch.

Upstream `v2` merge (2026-11-22):

- Update checks keep fork semantics: `ChromePopupPortal.updateCheck()` reads the fork's `update.json` first and compares integer `versionCode`; bridge `system.updateCheck` is only the fallback. Upstream's `UpdateCheckService`/`UpdateCheckStore`, `system.updateStatus` cache and `UpdateStatus` UI are retained, but semantic-version comparison never decides an update. Upstream's "no direct fetch in popup" test was adapted to this fork behavior.
- Mercenary decisions support both surfaces: fork flags (`mercGetRidOfVeterans`, `mercInsureVeterans`) and upstream decision mode/score weights (`mercDecisionMode`, `mercDecisionScoreLoot`, `mercDecisionScoreRisk`). `ExpeditionCycle.autoRespond()` passes them together; selection data carries both `insurance` and `insuranceCost`.
- Upstream auto-job completion barriers, job-state store/reconciler/recorder and market-completed-jobs store are adopted. Background composition registers both the fork toolbar opener and upstream update lifecycle; `AppShell` still receives `ping` / `hasEndpoint` from `SidePanelApp`.

Auto Jobs report freshness:

- `AutoFinish.last` is persisted and restored on background startup. It must not override a newer `AutoJobsSnapshot`: `selectShownJobReport()` prefers a live Auto Finish run, then a last report only when its timestamp is at least as new as `snapshotAt`, otherwise it falls back to the current snapshot. Do not copy the persisted `last` report into the manual `jobReport` on load.

Automatic page refresh:

- The separate "Auto Refresh" tab configures `autoPageRefreshEnabled`, `autoPageRefreshIntervalMinutes` (1-1440, default 60) and `autoPageRefreshWaitWhileWorking`. `AutoPageRefreshCoordinator` uses a one-shot `AUTO_PAGE_REFRESH_ALARM` at `nextRefreshAt`; after a successful `chrome.tabs.reload` it writes `lastRefreshAt` and starts the next interval.
- With "wait while working" enabled, the coordinator checks Auto Expedition, Auto Jobs/Auto Finish/job queue, Auto Daily and active minigame lock. If any are running it retries every 30 seconds for up to 10 minutes; it refreshes immediately once idle and force-refreshes when the timeout expires. Status/busy keys are exposed through `autoPageRefresh.status`.
- The new feature is part of Helper Mode's saved/disabled automation snapshot. State is persisted in `AutoPageRefreshStateStore`; bridge/UI never call Chrome APIs directly.

Complete-unknown claim recovery:

- A fresh market row with `alreadyTaken && canComplete` is positive evidence that an unconfirmed `Complete` did not grant the reward. `JobStateReconciler` may release that exact-reset barrier once and transition to `ready-to-claim` with `completeRecoveryAttemptedAt`; Auto Finish then claims it through the normal claim-only path. Claim-only jobs are sorted first each run, matching v1's "claim rewards first" behavior.
- The recovery is bounded: one attempt per known reset; null/unknown resets and identity-less sidecar barriers are never auto-released. If the recovery `Complete` is again unconfirmed, the barrier is restored and no further automatic attempt is made for that reset.
- `JobStateRecord.completeRecoveryAttemptedAt` and `MarketCompletionStorePort.releaseUnconfirmed()` are the contract surface. Do not weaken the expected-reset CAS check or allow null-reset auto-release.

Collapsible card/panel state persistence:

- All collapsible UI cards and sub-sections must remember their expanded/collapsed state across side-panel restarts. The single source of truth is `settings.panelOpenState` (`Record<string, boolean>`), persisted via `settings.update`; there is no separate UI-state store. `useSettings.panelOpen` / `updatePanelOpen(key, open)` is the only UI access path — components receive `expanded` + `onOpenChange` (or `panelOpen` + `updatePanelOpen` for `<details>`) via props and never touch Chrome APIs.
- Shared collapsibles (`GameSection`, `AutomationCard`, `InfoPanel`) use the controlled/uncontrolled pattern `expanded ?? internalOpen`: pass a `panelOpen[key]` value to persist, or omit it to keep local state. Use stable `page.area` keys (e.g. `overview.timer.daily`, `drone-mission.step.3`, `valuable-seller.status`); for dynamic items use a business id, never an array index.
- `DroneMissionPage` step cards only auto-expand the current step while no persisted choice exists (`expanded === undefined`); an explicit saved choice is never overridden by incoming WS data.

## Definition of done

- typecheck passes
- tests pass
- lint passes
- build passes
- behavior parity is checked for any replaced feature
- docs/ADR updated for cross-cutting changes
- `AGENTS.md` and affected `docs/` files updated (see Documentation sync rule)
