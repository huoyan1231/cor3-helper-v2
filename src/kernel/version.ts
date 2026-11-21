/**
 * Normalize any injected or parsed version-code value to a non-negative integer.
 *
 * Build-time constants may be missing (tests, dev bundles) or malformed, so
 * callers use this pure function instead of trusting the raw value.
 */
export function toVersionCode(value: string | number | null | undefined): number {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    }
    if (typeof value !== 'string') return 0;
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return 0;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : 0;
}

/**
 * Parse the numeric `major.minor.patch` core of a display version, ignoring
 * suffixes such as `-salta` or build metadata. Returns null on a malformed
 * core so callers fail closed instead of guessing.
 */
export function parseVersionCore(value: string | null | undefined): readonly [number, number, number] | null {
    if (typeof value !== 'string') return null;
    const core = value.trim().split(/[+-]/, 1)[0] ?? '';
    const parts = core.split('.');
    if (parts.length < 1 || parts.length > 3) return null;
    const numbers: number[] = [];
    for (const part of parts) {
        if (!/^\d+$/.test(part)) return null;
        numbers.push(Number(part));
    }
    while (numbers.length < 3) numbers.push(0);
    return numbers as [number, number, number];
}

/**
 * Whether `remote` is a strictly newer semantic version than `current`.
 * Invalid input returns false — never claim an update from unparseable data.
 */
export function isNewerVersion(remote: string | null | undefined, current: string | null | undefined): boolean {
    const r = parseVersionCore(remote);
    const c = parseVersionCore(current);
    if (!r || !c) return false;
    const [rMajor, rMinor, rPatch] = r;
    const [cMajor, cMinor, cPatch] = c;
    if (rMajor > cMajor) return true;
    if (rMajor < cMajor) return false;
    if (rMinor > cMinor) return true;
    if (rMinor < cMinor) return false;
    return rPatch > cPatch;
}
