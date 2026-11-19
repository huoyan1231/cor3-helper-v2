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
