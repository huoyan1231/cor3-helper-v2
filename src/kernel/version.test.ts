import { describe, expect, it } from 'vitest';
import { toVersionCode } from './version.js';

describe('toVersionCode', () => {
    it('keeps non-negative integers unchanged', () => {
        expect(toVersionCode(279)).toBe(279);
        expect(toVersionCode(0)).toBe(0);
    });

    it('parses numeric strings after trimming', () => {
        expect(toVersionCode('279')).toBe(279);
        expect(toVersionCode(' 279 ')).toBe(279);
    });

    it('returns 0 for empty, nullish, or non-numeric values', () => {
        expect(toVersionCode(null)).toBe(0);
        expect(toVersionCode(undefined)).toBe(0);
        expect(toVersionCode('')).toBe(0);
        expect(toVersionCode('   ')).toBe(0);
        expect(toVersionCode('salta')).toBe(0);
    });

    it('returns 0 for negative, fractional, NaN, and infinite numbers', () => {
        expect(toVersionCode(-1)).toBe(0);
        expect(toVersionCode(1.5)).toBe(0);
        expect(toVersionCode(Number.NaN)).toBe(0);
        expect(toVersionCode(Number.POSITIVE_INFINITY)).toBe(0);
        expect(toVersionCode('-1')).toBe(0);
        expect(toVersionCode('1.5')).toBe(0);
    });

    it('returns 0 for integers beyond the safe range', () => {
        expect(toVersionCode(Number.MAX_SAFE_INTEGER + 1)).toBe(0);
        expect(toVersionCode('9007199254740993')).toBe(0);
    });
});
