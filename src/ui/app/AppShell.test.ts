import { describe, expect, it } from 'vitest';
import { buildNavPages } from './AppShell.js';

describe('buildNavPages', () => {
    const base = { language: 'en' as const, helperMode: false, developerMode: false };

    it('hides Wings of Mars by default and places it right after Game when shown', () => {
        const hidden = buildNavPages({ ...base, hideWingsOfMars: true });
        expect(hidden.map(([page]) => page)).toEqual(['overview', 'progress', 'automation', 'game', 'autoRefresh', 'settings']);

        const shown = buildNavPages({ ...base, hideWingsOfMars: false });
        const order = shown.map(([page]) => page);
        expect(order).toEqual(['overview', 'progress', 'automation', 'game', 'autoRefresh', 'droneMission', 'settings']);
        expect(order.indexOf('droneMission')).toBe(order.indexOf('autoRefresh') + 1);
    });

    it('uses the localized names for Wings of Mars', () => {
        const shown = buildNavPages({ ...base, language: 'en', hideWingsOfMars: false });
        expect(shown.find(([page]) => page === 'droneMission')?.[1]).toBe('Wings of Mars');

        const shownZh = buildNavPages({ ...base, language: 'zh', hideWingsOfMars: false });
        expect(shownZh.find(([page]) => page === 'droneMission')?.[1]).toBe('火星之翼');
    });

    it('still respects helper and developer mode visibility', () => {
        const pages = buildNavPages({ language: 'en', helperMode: true, developerMode: true, hideWingsOfMars: false });
        const order = pages.map(([page]) => page);
        expect(order).not.toContain('automation');
        expect(order).toContain('developer');
        expect(order.indexOf('droneMission')).toBe(order.indexOf('autoRefresh') + 1);
    });
});
