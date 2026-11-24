import { describe, expect, it } from 'vitest';
import { resolveReportRunState } from './valuable-run-state.js';

const active = {
    runId: 'run-1',
    operation: 'maintenance' as const,
    status: 'running' as const,
    progress: null,
    error: null,
    updatedAt: 1,
};

describe('resolveReportRunState', () => {
    it('adopts an active report run', () => {
        expect(resolveReportRunState(active, false)).toEqual({
            runId: 'run-1',
            operation: 'maintenance',
            progress: null,
        });
    });

    it('clears stale run state when the report has no active run', () => {
        expect(resolveReportRunState(null, false)).toEqual({
            runId: null,
            operation: null,
            progress: null,
        });
    });

    it('never clobbers a local run that is starting', () => {
        expect(resolveReportRunState(active, true)).toBeNull();
        expect(resolveReportRunState(null, true)).toBeNull();
    });
});
