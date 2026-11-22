import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

export interface InfoPanelProps {
    readonly title: string;
    readonly meta?: string;
    readonly defaultOpen?: boolean;
    readonly expanded?: boolean | undefined;
    readonly onOpenChange?: ((open: boolean) => void) | undefined;
    readonly children: ComponentChildren;
}

export function InfoPanel({ title, meta, defaultOpen = false, expanded, onOpenChange, children }: InfoPanelProps) {
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const open = expanded ?? internalOpen;
    const setOpen = (next: boolean) => {
        if (expanded === undefined) setInternalOpen(next);
        onOpenChange?.(next);
    };
    return (
        <section class="v2-debug-console v2-info-panel">
            <button
                type="button"
                class="v2-debug-toggle"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                <span>{open ? '▼' : '▶'} {title}</span>
                {meta ? <span class="v2-muted">{meta}</span> : null}
            </button>
            {open ? <div class="v2-info-panel-body">{children}</div> : null}
        </section>
    );
}
