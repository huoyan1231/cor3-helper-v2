import { z } from 'zod';
import type { Result } from '../../kernel/result.js';
import { err, ok } from '../../kernel/result.js';
import { toVersionCode } from '../../kernel/version.js';
import type { UpdateCheckError, UpdateCheckSuccess } from '../../contracts/update-check.js';

/**
 * Update check against the single `update.json` published on the fork's v2
 * branch. The remote file carries a display version (`versionName`) and an
 * integer `versionCode`. Updates are decided by integer `versionCode`: bump.mjs
 * mirrors both fields into `update.json` on every release, so a remote code
 * above the local code means a newer build was published. Ordinary post-release
 * commits raise only the local code, which never falsely prompts.
 */
export const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/huoyan1231/cor3-helper-v2/refs/heads/v2/update.json';
export const DEFAULT_RELEASE_URL = 'https://github.com/huoyan1231/cor3-helper-v2/releases/latest';
/** A failed check must never leave the caller waiting indefinitely. */
export const DEFAULT_UPDATE_CHECK_TIMEOUT_MS = 10_000;

const updateFileSchema = z.object({
    versionName: z.string().min(1),
    versionCode: z.number().int().nonnegative(),
    releaseUrl: z.string().min(1).optional(),
});

interface ParsedVersion {
    readonly base: readonly number[];
    readonly suffix: string;
    readonly build: number | null;
}

function normalizeVersion(value: string): string {
    return value.trim().replace(/^v/i, '');
}

function isValidVersion(value: string): boolean {
    return /^\d+(?:\.\d+)*(?:-[A-Za-z0-9._-]+)*$/.test(normalizeVersion(value));
}

function parseVersion(value: string): ParsedVersion {
    const cleaned = normalizeVersion(value);
    const match = cleaned.match(/^(\d+(?:\.\d+)*)(?:-(.+))?$/);
    const base = match?.[1]?.split('.').map((part) => Number(part) || 0) ?? [0];
    const suffix = match?.[2] ?? '';
    const buildMatch = suffix.match(/^(.*?)(\d+)$/);
    return {
        base,
        suffix: buildMatch?.[1] ?? suffix,
        build: buildMatch ? Number(buildMatch[2]) : null,
    };
}

/** Positive when `left` is newer than `right` by semantic version name. */
export function compareVersions(left: string, right: string): number {
    const a = parseVersion(left);
    const b = parseVersion(right);
    const length = Math.max(a.base.length, b.base.length);
    for (let index = 0; index < length; index += 1) {
        const diff = (a.base[index] ?? 0) - (b.base[index] ?? 0);
        if (diff !== 0) return diff;
    }
    if (a.suffix !== b.suffix) return a.suffix.localeCompare(b.suffix);
    if (a.build !== b.build) {
        if (a.build === null) return b.build === null ? 0 : -1;
        if (b.build === null) return 1;
        return a.build - b.build;
    }
    return 0;
}

export function versionNameFromPackage(pkg: {
    readonly version: string;
    readonly cor3Fork?: {
        readonly label?: string | undefined;
        readonly releaseLabel?: string | undefined;
        readonly build?: number | undefined;
    } | undefined;
}): string {
    const releaseLabel = pkg.cor3Fork?.releaseLabel;
    if (releaseLabel) return `${pkg.version}-${releaseLabel}`;
    const label = pkg.cor3Fork?.label;
    return label ? `${pkg.version}-${label}.${pkg.cor3Fork?.build ?? 1}` : pkg.version;
}

export interface UpdateCheckerOptions {
    readonly url?: string;
    readonly releaseUrl?: string;
    readonly now?: () => number;
    readonly fetchImpl?: typeof fetch;
    readonly timeoutMs?: number;
    /** Local version code provider for the versionCode-based decision. */
    readonly currentVersionCode?: () => string | number | null | undefined;
}

export class UpdateChecker {
    private readonly url: string;
    private readonly releaseUrl: string;
    private readonly now: () => number;
    private readonly fetchImpl: typeof fetch;
    private readonly timeoutMs: number;
    private readonly currentVersionCode: () => string | number | null | undefined;

    constructor(options: UpdateCheckerOptions = {}) {
        this.url = options.url ?? UPDATE_CHECK_URL;
        this.releaseUrl = options.releaseUrl ?? DEFAULT_RELEASE_URL;
        this.now = options.now ?? (() => Date.now());
        // Chrome's fetch requires the global (Window/WorkerGlobalScope) receiver.
        const fetchImpl = options.fetchImpl ?? globalThis.fetch;
        this.fetchImpl = (input, init) => fetchImpl.call(globalThis, input, init);
        this.timeoutMs = options.timeoutMs ?? DEFAULT_UPDATE_CHECK_TIMEOUT_MS;
        this.currentVersionCode = options.currentVersionCode ?? (() => undefined);
    }

    async check(
        currentVersion: string,
        versionCodeOverride?: string | number | null,
    ): Promise<Result<UpdateCheckSuccess, UpdateCheckError>> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(1, this.timeoutMs));
        try {
            const response = await this.fetchImpl(this.url, {
                cache: 'no-store',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            if (!response.ok) {
                return err({
                    code: 'HTTP_ERROR',
                    message: `${this.url}: HTTP ${response.status}`,
                    httpStatus: response.status,
                });
            }
            let raw: unknown;
            try {
                raw = await response.json();
            } catch {
                return err({ code: 'JSON_ERROR', message: 'Update metadata returned invalid JSON' });
            }
            const parsed = updateFileSchema.safeParse(raw);
            if (!parsed.success) {
                return err({ code: 'INVALID_RESPONSE', message: 'Update metadata is missing versionName or versionCode' });
            }
            const remote = parsed.data;
            if (!isValidVersion(remote.versionName)) {
                return err({ code: 'INVALID_VERSION', message: `Update metadata has an invalid versionName: ${remote.versionName}` });
            }
            const releaseUrl = remote.releaseUrl ?? this.releaseUrl;
            try {
                const candidate = new URL(releaseUrl);
                if (candidate.protocol !== 'https:' && candidate.protocol !== 'http:') throw new Error('unsupported protocol');
            } catch {
                return err({ code: 'INVALID_RESPONSE', message: 'Update metadata contains an invalid releaseUrl' });
            }

            const localCode = toVersionCode(versionCodeOverride ?? this.currentVersionCode());
            const updateAvailable = remote.versionCode > localCode;
            return ok({
                status: updateAvailable ? 'available' : 'latest',
                currentVersion,
                latestVersion: remote.versionName,
                releaseUrl,
                checkedAt: this.now(),
                source: this.url,
            });
        } catch (error) {
            const aborted = controller.signal.aborted;
            return err({
                code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
                message: aborted
                    ? `Update check timed out after ${this.timeoutMs}ms`
                    : (error instanceof Error ? error.message : String(error)),
            });
        } finally {
            clearTimeout(timer);
        }
    }
}
