import { describe, expect, it } from 'vitest';
import { hasActiveMinigameLock } from './minigame-lock.js';

describe('hasActiveMinigameLock', () => {
    it('returns false when no lock source is configured', async () => {
        await expect(hasActiveMinigameLock(undefined, 1_000)).resolves.toBe(false);
    });

    it('returns true only while the reported lock is unexpired', async () => {
        await expect(hasActiveMinigameLock(async () => 2_000, 1_000)).resolves.toBe(true);
        await expect(hasActiveMinigameLock(async () => 1_000, 1_000)).resolves.toBe(false);
        await expect(hasActiveMinigameLock(async () => null, 1_000)).resolves.toBe(false);
    });

    it('fails open when the lock query throws', async () => {
        await expect(hasActiveMinigameLock(async () => { throw new Error('no tab'); }, 1_000)).resolves.toBe(false);
    });
});
