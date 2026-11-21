import { describe, expect, it, vi } from 'vitest';
import { UpdateChecker } from './update-checker.js';

const DEFAULT_URL = 'https://raw.githubusercontent.com/huoyan1231/cor3-helper-v2/refs/heads/v2/update.json';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

describe('UpdateChecker', () => {
    it('uses the fixed update.json URL by default', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({
            versionName: '2.0.6-salta',
            versionCode: 279,
        })) as unknown as typeof fetch;
        const checker = new UpdateChecker({ fetchImpl, now: () => 123 });
        const result = await checker.check('2.0.6-salta');
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
            return Promise.resolve(jsonResponse({ versionName: '2.0.6', versionCode: 279 }));
        } as typeof fetch;
        globalThis.fetch = nativeLikeFetch;
        try {
            const checker = new UpdateChecker();
            const result = await checker.check('2.0.6');
            expect(result.ok).toBe(true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('reports an update when the remote version name is newer', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({
                versionName: '2.1.0-salta',
                versionCode: 280,
                releaseUrl: 'https://example.test/release',
            })) as typeof fetch,
        });
        const result = await checker.check('2.0.6-salta');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.updateAvailable).toBe(true);
            expect(result.value.latest).toBe('2.1.0-salta');
            expect(result.value.current).toBe('2.0.6-salta');
            expect(result.value.releaseUrl).toBe('https://example.test/release');
        }
    });

    it('reports up to date when version names are equal or lower', async () => {
        const equal = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '2.0.6-salta', versionCode: 279 })) as typeof fetch,
        });
        const lower = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '2.0.5-salta', versionCode: 278 })) as typeof fetch,
        });
        const equalResult = await equal.check('2.0.6-salta');
        const lowerResult = await lower.check('2.0.6-salta');
        expect(equalResult.ok && equalResult.value.updateAvailable).toBe(false);
        expect(lowerResult.ok && lowerResult.value.updateAvailable).toBe(false);
    });

    it('does not report an update when only the remote versionCode is higher', async () => {
        // Regression: versionCode increments on every commit; it is a build
        // counter, not a release. Only a higher versionName may prompt.
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '2.3.1', versionCode: 9999 })) as typeof fetch,
        });
        const result = await checker.check('2.3.1');
        expect(result.ok && result.value.updateAvailable).toBe(false);
    });

    it('reports an update for a higher versionName even with a lower versionCode', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '2.4.0', versionCode: 1 })) as typeof fetch,
        });
        const result = await checker.check('2.3.1');
        expect(result.ok && result.value.updateAvailable).toBe(true);
    });

    it('falls back to the fork releases page when releaseUrl is absent', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({ versionName: '2.0.6-salta', versionCode: 280 })) as typeof fetch,
        });
        const result = await checker.check('2.0.6-salta');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.releaseUrl).toBe('https://github.com/huoyan1231/cor3-helper-v2/releases/latest');
        }
    });

    it('honors a custom fallback releaseUrl', async () => {
        const checker = new UpdateChecker({
            releaseUrl: 'https://example.test/releases',
            fetchImpl: (async () => jsonResponse({ versionName: '2.0.6-salta', versionCode: 280 })) as typeof fetch,
        });
        const result = await checker.check('2.0.6-salta');
        expect(result.ok && result.value.releaseUrl).toBe('https://example.test/releases');
    });

    it('surfaces an HTTP failure', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => jsonResponse({}, 404)) as typeof fetch,
        });
        const result = await checker.check('2.0.6-salta');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('UPDATE_CHECK_FAILED');
    });

    it('surfaces a network failure', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => { throw new Error('offline'); }) as typeof fetch,
        });
        const result = await checker.check('2.0.6-salta');
        expect(result.ok).toBe(false);
    });

    it('rejects invalid JSON', async () => {
        const checker = new UpdateChecker({
            fetchImpl: (async () => new Response('not json')) as typeof fetch,
        });
        const result = await checker.check('2.0.6-salta');
        expect(result.ok).toBe(false);
    });

    it('rejects missing or invalid fields', async () => {
        const invalidBodies = [
            { versionName: '2.0.6-salta' },
            { versionCode: 280 },
            { versionName: '', versionCode: 280 },
            { versionName: '2.0.6-salta', versionCode: -1 },
            { versionName: '2.0.6-salta', versionCode: 1.5 },
            { versionName: '2.0.6-salta', versionCode: '280' },
        ];
        for (const body of invalidBodies) {
            const checker = new UpdateChecker({
                fetchImpl: (async () => jsonResponse(body)) as typeof fetch,
            });
            const result = await checker.check('2.0.6-salta');
            expect(result.ok).toBe(false);
        }
    });
});
