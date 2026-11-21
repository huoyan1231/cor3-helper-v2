import { describe, expect, it } from 'vitest';
import { isNewerVersion, parseVersionCore, toVersionCode } from './version.js';

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

describe('parseVersionCore', () => {
    it('parses plain and suffixed versions', () => {
        expect(parseVersionCore('2.3.1')).toEqual([2, 3, 1]);
        expect(parseVersionCore('2.3.1-salta')).toEqual([2, 3, 1]);
        expect(parseVersionCore(' 2.3 ')).toEqual([2, 3, 0]);
        expect(parseVersionCore('2')).toEqual([2, 0, 0]);
    });

    it('rejects malformed cores', () => {
        expect(parseVersionCore('')).toBeNull();
        expect(parseVersionCore('salta')).toBeNull();
        expect(parseVersionCore('2.x.1')).toBeNull();
        expect(parseVersionCore('2.3.1.4')).toBeNull();
        expect(parseVersionCore(null)).toBeNull();
    });
});

describe('isNewerVersion', () => {
    it('detects a higher major, minor or patch', () => {
        expect(isNewerVersion('3.0.0', '2.3.1')).toBe(true);
        expect(isNewerVersion('2.4.0', '2.3.1')).toBe(true);
        expect(isNewerVersion('2.3.2', '2.3.1')).toBe(true);
    });

    it('is false for equal or older versions', () => {
        expect(isNewerVersion('2.3.1', '2.3.1')).toBe(false);
        expect(isNewerVersion('2.3.0', '2.3.1')).toBe(false);
    });

    it('ignores suffixes and build metadata', () => {
        expect(isNewerVersion('2.3.1-salta', '2.3.0')).toBe(true);
        expect(isNewerVersion('2.3.1+build', '2.3.1')).toBe(false);
    });

    it('fails closed on unparseable input', () => {
        expect(isNewerVersion('garbage', '2.3.1')).toBe(false);
        expect(isNewerVersion('2.4.0', 'garbage')).toBe(false);
        expect(isNewerVersion(null, '2.3.1')).toBe(false);
    });
});
