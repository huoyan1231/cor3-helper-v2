import { describe, expect, it, vi } from 'vitest';
import { UpdateChecker } from './update-checker.js';

const DEFAULT_URL = 'https://raw.githubusercontent.com/huoyan1231/cor3-helper-v2/refs/heads/v2/update.json';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

describe('UpdateChecker', () => {
    it('uses the fixed update.json URL by default', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({
            versionName: '2.4.1',
            versionCode: 317,
        })) as unknown as typeof fetch;
        const checker = new UpdateChecker({ fetchImpl, now: () => 123 });
        const result = await checker.check('2.4.1', 316);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl).toHaveBeenCalledWith(DEFAULT_URL, expect.objectContaining({ cache: 'no-store' }));
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.source).toBe(DEFAULT_URL);
            expect(result.value.checkedAt).toBe(123);
        }
    });

    it('calls native fetch with the global receiver (no Illegal invocation)', async () => {
        const originalFetch = globalThis.fetch;
        const nativeLikeFetch = function (this: unknown) {
            if (this !== globalThis) throw new TypeError("Failed to execute 'fetch': Illegal invocation");
            return Promise.resolve(jsonResponse({ versionName: '2.4.1', versionCode: 317 }));
        } as typeof fetch;
        globalThis.fetch = nativeLikeFetch;
        try {
            const checker = new UpdateChecker();
            const result = await checker.check('2.4.1', 316);
            expect(result.ok).toBe(true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('reports an update when the remote versionCode is higher', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({
                versionName: '2.4.2',
                versionCode: 319,
                releaseUrl: 'https://example.test/release',
            })) as typeof fetch,
        });
        const result = await checker.check('2.4.1', 317);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.updateAvailable).toBe(true);
            expect(result.value.latest).toBe('2.4.2');
            expect(result.value.current).toBe('2.4.1');
            expect(result.value.releaseUrl).toBe('https://example.test/release');
        }
    });

    it('reports up to date when versionCode is equal or lower', async () => {
        const equal = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '2.4.1', versionCode: 317 })) as typeof fetch,
        });
        const lower = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '2.4.0', versionCode: 316 })) as typeof fetch,
        });
        const equalResult = await equal.check('2.4.1', 317);
        const lowerResult = await lower.check('2.4.1', 317);
        expect(equalResult.ok && equalResult.value.updateAvailable).toBe(false);
        expect(lowerResult.ok && lowerResult.value.updateAvailable).toBe(false);
    });

    it('does not report an update when only the remote versionName is higher', async () => {
        // versionCode is the single source of truth; a name-only change in the
        // remote file without a mirrored code bump is not a published release.
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '9.9.9', versionCode: 317 })) as typeof fetch,
        });
        const result = await checker.check('2.4.1', 317);
        expect(result.ok && result.value.updateAvailable).toBe(false);
    });

    it('reports an update for a higher versionCode even with a lower versionName', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '2.4.0', versionCode: 9999 })) as typeof fetch,
        });
        const result = await checker.check('2.4.1', 1);
        expect(result.ok && result.value.updateAvailable).toBe(true);
    });

    it('normalizes an invalid local versionCode to 0', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '2.4.1', versionCode: 1 })) as typeof fetch,
        });
        const result = await checker.check('2.4.1', 'salta');
        expect(result.ok && result.value.updateAvailable).toBe(true);
    });

    it('falls back to the fork releases page when releaseUrl is absent', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '2.4.1', versionCode: 318 })) as typeof fetch,
        });
        const result = await checker.check('2.4.1', 317);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.releaseUrl).toBe('https://github.com/huoyan1231/cor3-helper-v2/releases/latest');
        }
    });

    it('honors a custom fallback releaseUrl', async () => {
        const checker = new UpdateChecker({
            releaseUrl: 'https://example.test/releases',
            fetchImpl: (async () => jsonResponse({ versionName: '2.4.1', versionCode: 318 })) as typeof fetch,
        });
        const result = await checker.check('2.4.1', 317);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.releaseUrl).toBe('https://example.test/releases');
    });

    it('surfaces an HTTP failure', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({}, 404)) as typeof fetch,
        });
        const result = await checker.check('2.4.1', 317);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('UPDATE_CHECK_FAILED');
    });

    it('surfaces a network failure', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => { throw new Error('offline'); }) as typeof fetch,
        });
        const result = await checker.check('2.4.1', 317);
        expect(result.ok).toBe(false);
    });

    it('rejects invalid JSON', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => new Response('not json')) as typeof fetch,
        });
        const result = await checker.check('2.4.1', 317);
        expect(result.ok).toBe(false);
    });

    it('rejects missing or invalid fields', async () => {
        const invalidBodies = [
            { versionName: '2.4.1' },
            { versionCode: 318 },
            { versionName: '', versionCode: 318 },
            { versionName: '2.4.1', versionCode: -1 },
            { versionName: '2.4.1', versionCode: 1.5 },
            { versionName: '2.4.1', versionCode: '318' },
        ];
        for (const body of invalidBodies) {
            const checker = new UpdateChecker({
                fetchImpl: (async () => jsonResponse(body)) as typeof fetch,
            });
            const result = await checker.check('2.4.1', 317);
            expect(result.ok).toBe(false);
        }
    });
});
