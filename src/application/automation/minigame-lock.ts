/**
 * Shared guard for automation entry points. The game reports only manually
 * started minigames in this global lock, so automation can yield without
 * cancelling a minigame it is already solving.
 */
export type MinigameLockSource = () => Promise<number | null>;

export async function hasActiveMinigameLock(
    source: MinigameLockSource | undefined,
    now: number,
): Promise<boolean> {
    if (!source) return false;
    try {
        const lockUntil = await source();
        return lockUntil !== null && lockUntil > now;
    } catch {
        // A lock query failure must not block automation; the game-side socket
        // hub clears expired locks itself and the next entry point rechecks.
        return false;
    }
}
