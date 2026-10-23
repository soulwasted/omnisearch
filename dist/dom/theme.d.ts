import type { OmnisearchTheme } from "../types";
export type Scheme = "light" | "dark";
/**
 * Resolves "auto" the way most sites mark their theme: a `data-theme` (or similar)
 * attribute or a `dark`/`light` class on <html> or <body> (next-themes, Tailwind,
 * Style Kit), falling back to the OS preference.
 */
export declare function resolveScheme(theme: OmnisearchTheme): Scheme;
/** Keeps `data-scheme` on the host in sync with the page theme. */
export declare function watchScheme(host: HTMLElement, getTheme: () => OmnisearchTheme): {
    sync(): void;
    stop(): void;
};
