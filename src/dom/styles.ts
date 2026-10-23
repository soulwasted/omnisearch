// Lives inside the shadow root, so host page CSS can't break it. Hosts theme it through
// the public `--omni-*` tokens (they inherit into the shadow tree) and `::part()`.
// Private `--_*` variables pick the token or the built-in default for the current scheme.

export const STYLES = /* css */ `
:host {
  --_font: var(--omni-font, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  --_font-size: var(--omni-font-size, 14px);
  --_bg: var(--omni-bg, #ffffff);
  --_fg: var(--omni-fg, #18181b);
  --_muted: var(--omni-muted, #71717a);
  --_border: var(--omni-border, #e4e4e7);
  --_active: var(--omni-active, #f4f4f5);
  --_accent: var(--omni-accent, #2563eb);
  --_backdrop: var(--omni-backdrop, rgb(9 9 11 / 0.4));
  --_shadow: var(--omni-shadow, 0 24px 64px -16px rgb(0 0 0 / 0.3), 0 2px 6px rgb(0 0 0 / 0.06));
  --_radius: var(--omni-radius, 12px);
  --_width: var(--omni-width, 36rem);
  --_top: var(--omni-top, 12vh);
  --_max-height: var(--omni-max-height, min(60vh, 28rem));

  position: fixed;
  inset: 0;
  z-index: var(--omni-z, 2147483000);
  display: block;
  font-family: var(--_font);
  font-size: var(--_font-size);
  line-height: 1.4;
  color: var(--_fg);
  color-scheme: light;
  -webkit-font-smoothing: antialiased;
}

:host([data-scheme="dark"]) {
  --_bg: var(--omni-bg, #18181b);
  --_fg: var(--omni-fg, #fafafa);
  --_muted: var(--omni-muted, #a1a1aa);
  --_border: var(--omni-border, #2e2e33);
  --_active: var(--omni-active, #27272a);
  --_accent: var(--omni-accent, #60a5fa);
  --_backdrop: var(--omni-backdrop, rgb(0 0 0 / 0.6));
  --_shadow: var(--omni-shadow, 0 24px 64px -16px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.04));
  color-scheme: dark;
}

:host([hidden]) { display: none; }

*, *::before, *::after { box-sizing: border-box; }

.backdrop {
  position: absolute;
  inset: 0;
  background: var(--_backdrop);
  animation: omni-fade 120ms ease-out;
}

.panel {
  position: absolute;
  top: var(--_top);
  left: 50%;
  translate: -50% 0;
  width: min(var(--_width), calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--_bg);
  border: 1px solid var(--_border);
  border-radius: var(--_radius);
  box-shadow: var(--_shadow);
  animation: omni-in 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-bottom: 1px solid var(--_border);
}

.search-icon { display: grid; flex: none; color: var(--_muted); }
.search-icon svg { width: 16px; height: 16px; }

.input {
  flex: 1;
  min-width: 0;
  height: 50px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: calc(var(--_font-size) + 1px);
}
.input::placeholder { color: var(--_muted); opacity: 1; }

.spinner {
  flex: none;
  width: 14px;
  height: 14px;
  border: 2px solid var(--_border);
  border-top-color: var(--_muted);
  border-radius: 50%;
  animation: omni-spin 700ms linear infinite;
}
.spinner[hidden] { display: none; }

kbd {
  display: inline-block;
  min-width: 18px;
  padding: 2px 5px;
  border: 1px solid var(--_border);
  border-radius: 4px;
  background: transparent;
  color: var(--_muted);
  font: inherit;
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
}

.list {
  max-height: var(--_max-height);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px;
  scroll-padding: 6px;
}

.group + .group { margin-top: 6px; }

.group-label {
  padding: 6px 10px 4px;
  color: var(--_muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 6px 10px;
  border-radius: max(4px, calc(var(--_radius) - 5px));
  cursor: pointer;
  user-select: none;
}
.item[aria-selected="true"] { background: var(--_active); }
.item[aria-disabled="true"] { cursor: default; opacity: 0.45; }
.item.indent {
  margin-left: 16px;
  padding-left: 12px;
  border-left: 2px solid var(--_border);
  border-radius: 0 max(4px, calc(var(--_radius) - 5px)) max(4px, calc(var(--_radius) - 5px)) 0;
}
.item.indent[aria-selected="true"] { border-left-color: var(--_muted); }

.item-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 18px;
  color: var(--_muted);
  font-size: 15px;
  line-height: 1;
}
.item-icon svg { width: 16px; height: 16px; }

.item-text {
  display: flex;
  flex: 1;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.item-label,
.item-description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-label { flex: none; max-width: 100%; font-weight: 500; }
.item-description { min-width: 0; color: var(--_muted); font-size: 12px; }

mark { background: none; color: var(--_accent); }

.item-meta {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  color: var(--_muted);
  font-size: 12px;
}
.badge { font-size: 11px; }

.switch {
  position: relative;
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: var(--_border);
  transition: background-color 150ms;
}
.switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
  transition: translate 150ms;
}
.switch[data-on] { background: var(--_accent); }
.switch[data-on]::after { translate: 12px 0; }

.empty {
  padding: 28px 12px;
  color: var(--_muted);
  text-align: center;
}

.footer {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 14px;
  border-top: 1px solid var(--_border);
  color: var(--_muted);
  font-size: 11px;
}
.footer > span { display: inline-flex; align-items: center; gap: 4px; }
.footer .spacer { margin-left: auto; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@keyframes omni-fade { from { opacity: 0; } }
@keyframes omni-in { from { opacity: 0; transform: translateY(-4px) scale(0.985); } }
@keyframes omni-spin { to { rotate: 360deg; } }

@media (max-width: 520px) {
  .panel { top: min(var(--_top), 12px); }
  .footer { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .backdrop, .panel { animation: none; }
  .switch, .switch::after { transition: none; }
}
`;
