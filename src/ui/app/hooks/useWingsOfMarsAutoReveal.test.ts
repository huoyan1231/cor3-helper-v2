import { describe, expect, it } from 'vitest';
import type { DroneBuildView } from '../../../contracts/drone-build.js';
import { shouldRevealWingsOfMars } from './useWingsOfMarsAutoReveal.js';

const view = (source: DroneBuildView['source']): DroneBuildView => ({
    snapshot: null,
    source,
    storedAt: null,
});

describe('shouldRevealWingsOfMars', () => {
    it('reveals the tab when a live quest was captured and the tab is hidden', () => {
        expect(shouldRevealWingsOfMars(view('live'), true)).toBe(true);
    });

    it('does not reveal from a persisted snapshot alone', () => {
        expect(shouldRevealWingsOfMars(view('persisted'), true)).toBe(false);
        expect(shouldRevealWingsOfMars(view('none'), true)).toBe(false);
    });

    it('does nothing when no view is available', () => {
        expect(shouldRevealWingsOfMars(null, true)).toBe(false);
    });

    it('does nothing when the tab is already visible', () => {
        expect(shouldRevealWingsOfMars(view('live'), false)).toBe(false);
    });
});
