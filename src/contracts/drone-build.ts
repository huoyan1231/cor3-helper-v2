import { z } from 'zod';

/**
 * Boundary schemas for the game's `drone-build` WebSocket payloads. Raw game
 * frames are permissive (the game adds fields between builds); the normalized
 * schema is the stable shape shared across the bridge and consumed by the UI.
 */

const droneBuildStepStatusSchema = z.enum(['COMPLETED', 'ACTIVE', 'LOCKED']);

export const droneBuildHistoryStepSchema = z.object({
    step: z.number().int().positive(),
    title: z.string(),
    note: z.string(),
    status: droneBuildStepStatusSchema,
    completedSubtasks: z.number().int().nonnegative(),
    totalSubtasks: z.number().int().nonnegative(),
}).strict();

export const droneBuildBarterItemSchema = z.object({
    itemConfigId: z.string().min(1),
    title: z.string(),
    requiredQuantity: z.number().int().nonnegative(),
    availableQuantity: z.number().int().nonnegative(),
}).passthrough();

export const droneBuildSubtaskSchema = z.object({
    key: z.string().min(1),
    title: z.string(),
    status: z.string(),
    variant: z.string().nullable(),
    buyCost: z.number().int().nonnegative(),
    barterItems: z.array(droneBuildBarterItemSchema),
}).passthrough();

export const droneBuildSnapshotSchema = z.object({
    currentStep: z.number().int().nonnegative(),
    status: z.string(),
    workshopChoice: z.string().nullable(),
    steps: z.array(droneBuildHistoryStepSchema),
    currentStepSubtasks: z.array(droneBuildSubtaskSchema),
    completedSubtasks: z.array(z.object({
        stepNumber: z.number().int().positive(),
        subtaskKey: z.string().min(1),
        variant: z.string().nullable(),
    }).strict()),
    capturedAt: z.number().int().nonnegative(),
}).strict();

export type DroneBuildSnapshotView = z.infer<typeof droneBuildSnapshotSchema>;

/** Raw `list.history` frame payload. */
export const rawDroneBuildHistorySchema = z.object({
    items: z.array(z.object({
        step: z.unknown(),
        title: z.unknown(),
        note: z.unknown(),
        status: z.unknown(),
        completedSubtasks: z.unknown(),
        totalSubtasks: z.unknown(),
    }).passthrough()),
}).passthrough();

/** Raw `get.page` frame payload. */
export const rawDroneBuildPageSchema = z.object({
    currentStep: z.unknown(),
    status: z.unknown(),
    workshopChoice: z.unknown().optional(),
    subtasks: z.array(z.object({
        stepNumber: z.unknown(),
        subtaskKey: z.unknown(),
        variant: z.unknown().optional(),
        status: z.unknown().optional(),
    }).passthrough()).optional(),
    currentStepSubtasks: z.array(z.unknown()).optional(),
}).passthrough();

/**
 * Game frames wrap the real payload as `{ event, data, requestId }`. Normalize
 * both that shape and an already-unwrapped object so callers never depend on
 * the transport envelope.
 */
function unwrap(raw: unknown): unknown {
    if (raw && typeof raw === 'object' && 'data' in raw && 'event' in raw) {
        return (raw as { data: unknown }).data;
    }
    return raw;
}

function toInt(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return Math.floor(parsed);
    }
    return fallback;
}

function toStatus(value: unknown): 'COMPLETED' | 'ACTIVE' | 'LOCKED' {
    return value === 'COMPLETED' || value === 'ACTIVE' || value === 'LOCKED' ? value : 'LOCKED';
}

/**
 * Merge the two raw drone-build payloads into the stable snapshot shape.
 * Returns null when neither payload is recognizable (no game data captured yet).
 */
export function normalizeDroneBuildSnapshot(
    historyRaw: unknown,
    pageRaw: unknown,
    capturedAt: number,
): DroneBuildSnapshotView | null {
    const history = rawDroneBuildHistorySchema.safeParse(unwrap(historyRaw));
    const page = rawDroneBuildPageSchema.safeParse(unwrap(pageRaw));
    if (!history.success && !page.success) return null;

    const steps = history.success
        ? history.data.items.map((item) => ({
            step: toInt(item.step),
            title: typeof item.title === 'string' ? item.title : '',
            note: typeof item.note === 'string' ? item.note : '',
            status: toStatus(item.status),
            completedSubtasks: toInt(item.completedSubtasks),
            totalSubtasks: toInt(item.totalSubtasks),
        })).filter((step) => step.step > 0)
        : [];

    const currentStepSubtasks = page.success && Array.isArray(page.data.currentStepSubtasks)
        ? page.data.currentStepSubtasks.flatMap((raw): DroneBuildSubtaskView[] => {
            const parsed = droneBuildSubtaskSchema.safeParse(raw);
            return parsed.success ? [parsed.data] : [];
        })
        : [];

    const completedSubtasks = page.success && Array.isArray(page.data.subtasks)
        ? page.data.subtasks.flatMap((entry) => {
            const stepNumber = toInt(entry.stepNumber);
            const subtaskKey = typeof entry.subtaskKey === 'string' ? entry.subtaskKey : '';
            if (stepNumber <= 0 || subtaskKey.length === 0) return [];
            if (entry.status !== undefined && entry.status !== 'COMPLETED') return [];
            return [{
                stepNumber,
                subtaskKey,
                variant: typeof entry.variant === 'string' ? entry.variant : null,
            }];
        })
        : [];

    return {
        currentStep: page.success ? toInt(page.data.currentStep) : 0,
        status: page.success && typeof page.data.status === 'string' ? page.data.status : 'UNKNOWN',
        workshopChoice: page.success && typeof page.data.workshopChoice === 'string' ? page.data.workshopChoice : null,
        steps,
        currentStepSubtasks,
        completedSubtasks,
        capturedAt,
    };
}

type DroneBuildSubtaskView = z.infer<typeof droneBuildSubtaskSchema>;
