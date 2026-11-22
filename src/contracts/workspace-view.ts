import { z } from 'zod';

export const WORKSPACE_PAGES = ['overview', 'progress', 'automation', 'droneMission', 'game', 'autoRefresh', 'settings', 'developer'] as const;
export type WorkspacePage = (typeof WORKSPACE_PAGES)[number];

export const WORKSPACE_VIEW_KEY = 'v2.workspace-view';

export const workspaceViewStateSchema = z.object({
    page: z.enum(WORKSPACE_PAGES),
    scrollTop: z.number().int().nonnegative().max(1_000_000),
}).strict();

export type WorkspaceViewState = z.infer<typeof workspaceViewStateSchema>;

export const DEFAULT_WORKSPACE_VIEW: WorkspaceViewState = {
    page: 'overview',
    scrollTop: 0,
};
