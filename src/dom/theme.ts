import type { OmnisearchTheme } from "../types";

const THEME_ATTRIBUTES = ["data-theme", "data-color-scheme", "data-mode"];

export type Scheme = "light" | "dark";

/**
 * Resolves "auto" the way most sites mark their theme: a `data-theme` (or similar)
 * attribute or a `dark`/`light` class on <html> or <body> (next-themes, Tailwind,
 * Style Kit), falling back to the OS preference.
 */
export function resolveScheme(theme: OmnisearchTheme): Scheme {
  if (theme !== "auto") return theme;
  for (const element of [document.documentElement, document.body]) {
    if (!element) continue;
    for (const attribute of THEME_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value === "dark" || value === "light") return value;
    }
    if (element.classList.contains("dark")) return "dark";
    if (element.classList.contains("light")) return "light";
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Keeps `data-scheme` on the host in sync with the page theme. */
export function watchScheme(host: HTMLElement, getTheme: () => OmnisearchTheme): { sync(): void; stop(): void } {
  const sync = () => host.setAttribute("data-scheme", resolveScheme(getTheme()));
  const observer = new MutationObserver(sync);
  for (const element of [document.documentElement, document.body]) {
    if (element) observer.observe(element, { attributes: true, attributeFilter: ["class", ...THEME_ATTRIBUTES] });
  }
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", sync);
  sync();
  return {
    sync,
    stop() {
      observer.disconnect();
      media?.removeEventListener?.("change", sync);
    },
  };
}
