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
- `planMissionSurplusSell()` (domain) builds the "sell surplus" plan from the mission catalog, effective progress and live stash: keep the required quantity of each mission item (itemConfigId first, then name/aliases), sell the surplus plus every other COMMON/RARE sellable stack. Done/skipped groups reserve nothing. The page shows a confirm modal and executes via `portal.sellInventoryItem()` per stack.

## Definition of done

- typecheck passes
- tests pass
- lint passes
- build passes
- behavior parity is checked for any replaced feature
- docs/ADR updated for cross-cutting changes
- `AGENTS.md` and affected `docs/` files updated (see Documentation sync rule)
