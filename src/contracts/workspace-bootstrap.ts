import { z } from 'zod';
import type { AutoJobsSnapshot } from './auto-jobs.js';
import { autoJobsSnapshotSchema } from './auto-jobs.js';
import type { NetworkMapSummary } from './network-summary.js';
import { networkMapSummarySchema } from './network-summary.js';
import type { AuthStatus, SettingsV1 } from './storage.js';
import { authStatusSchema, settingsV1Schema } from './storage.js';
import type { DailyOpsState } from '../domains/daily-ops/model.js';
import type { MarketOptionsView } from '../application/popup/portal.js';

export const bootstrapReputationSchema = z.object({
    level: z.number(),
    progress: z.number(),
    required: z.number(),
    levelLocked: z.boolean(),
    maxLevel: z.boolean(),
}).strict();

export const bootstrapMarketProgressSchema = z.object({
    marketId: z.string().min(1),
    marketName: z.string().min(1),
    credits: z.number(),
    reputation: bootstrapReputationSchema.nullable(),
}).strict();

export const bootstrapDailyOpsSchema = z.object({
    hasClaimedToday: z.boolean(),
    currentStreak: z.number(),
    difficulty: z.string(),
    nextTaskTime: z.string().nullable(),
    streakBonus: z.number().nullable(),
}).strict();

/**
 * Persisted stale-while-revalidate payload used to paint the side panel before
 * any game-tab request completes. Every field is a read-only projection of an
 * existing background store; the UI still refreshes each domain on mount.
 */
export const workspaceBootstrapSchema = z.object({
    at: z.number().int().nonnegative(),
    settings: settingsV1Schema.nullable(),
    auth: authStatusSchema.nullable(),
    network: networkMapSummarySchema.nullable(),
    autoJobs: autoJobsSnapshotSchema.nullable(),
    daily: bootstrapDailyOpsSchema.nullable(),
    marketProgress: z.record(z.string(), bootstrapMarketProgressSchema).default({}),
}).strict();

/** Domain-facing type; `workspaceBootstrapSchema` validates its persisted shape. */
export interface WorkspaceBootstrap {
    readonly at: number;
    readonly settings: SettingsV1 | null;
    readonly auth: AuthStatus | null;
    readonly network: NetworkMapSummary | null;
    readonly autoJobs: AutoJobsSnapshot | null;
    readonly daily: DailyOpsState | null;
    readonly marketProgress: Readonly<Record<string, MarketOptionsView>>;
}

export const EMPTY_WORKSPACE_BOOTSTRAP: WorkspaceBootstrap = {
    at: 0,
    settings: null,
    auth: null,
    network: null,
    autoJobs: null,
    daily: null,
    marketProgress: {},
};
