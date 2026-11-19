import { z } from 'zod';
import type { Result } from '../../kernel/result.js';
import { err, ok } from '../../kernel/result.js';

/**
 * Update check against the single `update.json` published on the fork's main
 * branch. The remote file carries a display version (`versionName`) and an
 * integer `versionCode`; only the version code is compared.
 */
const DEFAULT_URL = 'https://raw.githubusercontent.com/huoyan1231/cor3-helper-v2/refs/heads/v2/update.json';
const DEFAULT_RELEASE_URL = 'https://github.com/huoyan1231/cor3-helper-v2/releases/latest';
/** 0 means no request timeout. */
const DEFAULT_TIMEOUT_MS = 0;

const updateFileSchema = z.object({
    versionName: z.string().min(1),
    versionCode: z.number().int().nonnegative(),
    releaseUrl: z.string().min(1).optional(),
});

export interface UpdateCheckResult {
    readonly current: string;
    readonly latest: string;
    readonly updateAvailable: boolean;
    readonly releaseUrl: string;
    readonly checkedAt: number;
    readonly source: string;
}

export interface UpdateCheckerOptions {
    readonly url?: string;
    readonly now?: () => number;
    readonly fetchImpl?: typeof fetch;
    readonly releaseUrl?: string;
    /** 0 disables the abort timer. */
    readonly timeoutMs?: number;
}

export class UpdateChecker {
    private readonly url: string;
    private readonly now: () => number;
    private readonly fetchImpl: typeof fetch;
    private readonly releaseUrl: string;
    private readonly timeoutMs: number;

    constructor(options: UpdateCheckerOptions = {}) {
        this.url = options.url ?? DEFAULT_URL;
        this.now = options.now ?? (() => Date.now());
        // Native fetch must be called with the global scope as its receiver;
        // storing it as a method and calling `this.fetchImpl(...)` makes the
        // browser WebIDL check throw "Illegal invocation" in workers/popups.
        this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
        this.releaseUrl = options.releaseUrl ?? DEFAULT_RELEASE_URL;
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }

    async check(
        currentVersionName: string,
        currentVersionCode: number,
    ): Promise<Result<UpdateCheckResult, { readonly code: string; readonly message: string }>> {
        const controller = this.timeoutMs > 0 ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
        try {
            const response = await this.fetchImpl(this.url, {
                cache: 'no-store',
                ...(controller ? { signal: controller.signal } : {}),
            });
            if (!response.ok) {
                return err({ code: 'UPDATE_CHECK_FAILED', message: `${this.url}: HTTP ${response.status}` });
            }
            const parsed = updateFileSchema.safeParse(await response.json());
            if (!parsed.success) {
                return err({ code: 'UPDATE_CHECK_FAILED', message: `${this.url}: invalid update metadata` });
            }
            const remote = parsed.data;
            return ok({
                current: currentVersionName,
                latest: remote.versionName,
                updateAvailable: remote.versionCode > currentVersionCode,
                releaseUrl: remote.releaseUrl ?? this.releaseUrl,
                checkedAt: this.now(),
                source: this.url,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return err({ code: 'UPDATE_CHECK_FAILED', message: `${this.url}: ${message}` });
        } finally {
            if (timer !== null) clearTimeout(timer);
        }
    }
}
