import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_VIEW, WORKSPACE_PAGES, workspaceViewStateSchema } from './workspace-view.js';

describe('workspace view state', () => {
    it('accepts every workspace page', () => {
        for (const page of WORKSPACE_PAGES) {
            expect(workspaceViewStateSchema.safeParse({ page, scrollTop: 0 }).success).toBe(true);
        }
    });

    it('rejects unknown pages and invalid scroll offsets', () => {
        expect(workspaceViewStateSchema.safeParse({ page: 'unknown', scrollTop: 0 }).success).toBe(false);
        expect(workspaceViewStateSchema.safeParse({ page: 'overview', scrollTop: -1 }).success).toBe(false);
    });

    it('exposes a safe default', () => {
        expect(DEFAULT_WORKSPACE_VIEW).toEqual({ page: 'overview', scrollTop: 0 });
    });
});
