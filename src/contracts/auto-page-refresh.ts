import { z } from 'zod';

export const AUTO_PAGE_REFRESH_BUSY_KEYS = ['auto-expedition', 'auto-jobs', 'auto-daily', 'auto-hack'] as const;
export const AUTO_PAGE_REFRESH_RESULTS = ['refreshed', 'forced', 'failed'] as const;

export const autoPageRefreshStateSchema = z.object({
    nextRefreshAt: z.number().int().nonnegative().nullable(),
    lastRefreshAt: z.number().int().nonnegative().nullable(),
    waitStartedAt: z.number().int().nonnegative().nullable(),
    waitUntil: z.number().int().nonnegative().nullable(),
    lastResult: z.enum(AUTO_PAGE_REFRESH_RESULTS).nullable(),
    lastError: z.string().nullable(),
}).strict();

export type AutoPageRefreshState = z.infer<typeof autoPageRefreshStateSchema>;

export const autoPageRefreshStatusSchema = autoPageRefreshStateSchema.extend({
    enabled: z.boolean(),
    intervalMinutes: z.number().int().min(1).max(1440),
    waitWhileWorking: z.boolean(),
    busyKeys: z.array(z.enum(AUTO_PAGE_REFRESH_BUSY_KEYS)),
});

export type AutoPageRefreshStatus = z.infer<typeof autoPageRefreshStatusSchema>;
export type AutoPageRefreshBusyKey = typeof AUTO_PAGE_REFRESH_BUSY_KEYS[number];
