import { describe, expect, it } from 'vitest';
import { shouldRedirectFromDroneMission } from './SidePanelApp.js';

describe('shouldRedirectFromDroneMission', () => {
    it('keeps a restored Wings of Mars page while settings are still loading', () => {
        expect(shouldRedirectFromDroneMission(null, 'droneMission')).toBe(false);
    });

    it('keeps the page when settings say Wings of Mars is visible', () => {
        expect(shouldRedirectFromDroneMission({ hideWingsOfMars: false }, 'droneMission')).toBe(false);
    });

    it('leaves Wings of Mars once settings confirm it is hidden', () => {
        expect(shouldRedirectFromDroneMission({ hideWingsOfMars: true }, 'droneMission')).toBe(true);
    });

    it('does not touch other pages regardless of visibility', () => {
        expect(shouldRedirectFromDroneMission({ hideWingsOfMars: true }, 'game')).toBe(false);
        expect(shouldRedirectFromDroneMission(null, 'overview')).toBe(false);
    });
});
