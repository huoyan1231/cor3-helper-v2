import { describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_UPDATE_CHECK_TIMEOUT_MS,
    UpdateChecker,
    compareVersions,
    versionNameFromPackage,
} from './update-checker.js';

const DEFAULT_URL = 'https://raw.githubusercontent.com/huoyan1231/cor3-helper-v2/refs/heads/v2/update.json';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

const updateFile = (overrides: Record<string, unknown> = {}) => ({
    versionName: '2.4.3',
    versionCode: 320,
    ...overrides,
});

function checker(overrides: {
    readonly fetchImpl?: typeof fetch;
    readonly timeoutMs?: number;
    readonly now?: () => number;
    readonly currentVersionCode?: () => string | number | null;
} = {}) {
    return new UpdateChecker({
        url: 'https://example.test/update.json',
        now: overrides.now ?? (() => 123),
        ...(overrides.timeoutMs !== undefined ? { timeoutMs: overrides.timeoutMs } : {}),
        ...(overrides.currentVersionCode !== undefined ? { currentVersionCode: overrides.currentVersionCode } : {}),
        fetchImpl: overrides.fetchImpl ?? (async () => jsonResponse(updateFile())) as typeof fetch,
    });
}

describe('UpdateChecker versionCode decision', () => {
    it('reports available when the remote code is higher', async () => {
        const result = await checker().check('2.4.1', 316);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.status).toBe('available');
            expect(result.value.latestVersion).toBe('2.4.3');
            expect(result.value.currentVersion).toBe('2.4.1');
            expect(result.value.checkedAt).toBe(123);
            expect(result.value.source).toBe('https://example.test/update.json');
        }
    });

    it('reports latest when the remote code equals the local code', async () => {
        const result = await checker().check('2.4.1', 320);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.status).toBe('latest');
    });

    it('reports latest when the local code is higher (post-release commits)', async () => {
        const result = await checker().check('2.4.1', 321);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.status).toBe('latest');
    });

    it('normalizes a non-numeric local versionCode to zero', async () => {
        const result = await checker().check('2.4.1', 'salta');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.status).toBe('available');
    });

    it('uses the injected currentVersionCode provider when no override is given', async () => {
        const result = await checker({ currentVersionCode: () => 320 }).check('2.4.1');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.status).toBe('latest');
    });

    it('uses the default update.json URL', () => {
        expect(DEFAULT_URL).toContain('huoyan1231/cor3-helper-v2');
    });

    it('surfaces HTTP 404 with status', async () => {
        const result = await checker({ fetchImpl: (async () => jsonResponse({}, 404)) as typeof fetch }).check('2.4.1');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatchObject({ code: 'HTTP_ERROR', httpStatus: 404 });
    });

    it('surfaces HTTP 403 and 429', async () => {
        for (const status of [403, 429]) {
            const result = await checker({ fetchImpl: (async () => jsonResponse({}, status)) as typeof fetch }).check('2.4.1');
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error).toMatchObject({ code: 'HTTP_ERROR', httpStatus: status });
        }
    });

    it('surfaces a network failure', async () => {
        const result = await checker({ fetchImpl: (async () => { throw new Error('offline'); }) as typeof fetch }).check('2.4.1');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('NETWORK_ERROR');
    });

    it('aborts a hanging request and reports TIMEOUT', async () => {
        const hanging = (async (_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })) as unknown as typeof fetch;
        const result = await checker({ fetchImpl: hanging, timeoutMs: 5 }).check('2.4.1');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('TIMEOUT');
        expect(DEFAULT_UPDATE_CHECK_TIMEOUT_MS).toBeGreaterThan(0);
    });

    it('rejects invalid JSON', async () => {
        const result = await checker({ fetchImpl: (async () => new Response('not json')) as typeof fetch }).check('2.4.1');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('JSON_ERROR');
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
            const result = await checker({ fetchImpl: (async () => jsonResponse(body)) as typeof fetch }).check('2.4.1');
            expect(result.ok).toBe(false);
        }
    });

    it('rejects an invalid remote versionName', async () => {
        const result = await checker({ fetchImpl: (async () => jsonResponse(updateFile({ versionName: 'latest' }))) as typeof fetch }).check('2.4.1');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('INVALID_VERSION');
    });

    it('rejects an invalid release URL in the metadata', async () => {
        const result = await checker({ fetchImpl: (async () => jsonResponse(updateFile({ releaseUrl: 'javascript:alert(1)' }))) as typeof fetch }).check('2.4.1');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('INVALID_RESPONSE');
    });
});

describe('compareVersions', () => {
    it('compares base versions first', () => {
        expect(compareVersions('2.0.1-salta.1', '2.0.0-salta.999')).toBeGreaterThan(0);
        expect(compareVersions('v1.9.0', '1.10.0')).toBeLessThan(0);
    });

    it('treats a version without build as older than the same version with a build', () => {
        expect(compareVersions('2.0.6-salta', '2.0.6-salta.310')).toBeLessThan(0);
    });
});

describe('versionNameFromPackage', () => {
    it('prefers the release label over the local build counter', () => {
        expect(versionNameFromPackage({
            version: '2.1.0',
            cor3Fork: { label: 'huoyan1231', releaseLabel: 'huoyan1231', build: 231 },
        })).toBe('2.1.0-huoyan1231');
    });

    it('keeps the local label/build fallback for older package metadata', () => {
        expect(versionNameFromPackage({ version: '2.0.0', cor3Fork: { label: 'huoyan1231', build: 210 } })).toBe('2.0.0-huoyan1231.210');
        expect(versionNameFromPackage({ version: '1.8.6' })).toBe('1.8.6');
    });
});

describe('UpdateChecker fetch receiver', () => {
    function receiverSensitiveFetch(record: { receiver?: unknown }) {
        return function (this: unknown) {
            record.receiver = this;
            if (this !== globalThis) {
                throw new TypeError("Failed to execute 'fetch' on 'WorkerGlobalScope': Illegal invocation");
            }
            return Promise.resolve(jsonResponse(updateFile()));
        } as unknown as typeof fetch;
    }

    it('calls the global fetch with the global receiver', async () => {
        const record: { receiver?: unknown } = {};
        vi.stubGlobal('fetch', receiverSensitiveFetch(record));
        try {
            const result = await new UpdateChecker({ url: 'https://example.test/update.json', now: () => 123 }).check('2.4.1', 1);
            expect(result.ok).toBe(true);
            expect(record.receiver).toBe(globalThis);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('calls an injected fetch with the global receiver', async () => {
        const record: { receiver?: unknown } = {};
        const result = await new UpdateChecker({
            url: 'https://example.test/update.json',
            now: () => 123,
            fetchImpl: receiverSensitiveFetch(record),
        }).check('2.4.1', 1);
        expect(result.ok).toBe(true);
        expect(record.receiver).toBe(globalThis);
    });
});
