// src/core/hotkey.ts
function parseHotkey(spec) {
  const parts = spec.toLowerCase().split("+").map((part) => part.trim());
  const key = parts.pop() || "+";
  return {
    key,
    mod: parts.some((part) => part === "mod" || part === "cmd" || part === "meta" || part === "ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt") || parts.includes("option")
  };
}
function matchesHotkey(event, hotkey) {
  const isLetter = /^[a-z]$/.test(hotkey.key);
  const key = event.key.toLowerCase();
  const keyMatches = key === hotkey.key || isLetter && event.code === `Key${hotkey.key.toUpperCase()}`;
  if (!keyMatches)
    return false;
  if ((event.metaKey || event.ctrlKey) !== hotkey.mod)
    return false;
  if (event.altKey !== hotkey.alt)
    return false;
  if (hotkey.shift && !event.shiftKey)
    return false;
  if (!hotkey.shift && isLetter && event.shiftKey)
    return false;
  return true;
}
function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}
function formatHotkey(hotkey, mac = isMac()) {
  const key = hotkey.key.length === 1 ? hotkey.key.toUpperCase() : hotkey.key;
  if (mac)
    return `${hotkey.alt ? "⌥" : ""}${hotkey.shift ? "⇧" : ""}${hotkey.mod ? "⌘" : ""}${key}`;
  return [hotkey.mod && "Ctrl", hotkey.alt && "Alt", hotkey.shift && "Shift", key].filter(Boolean).join(" ");
}

// src/core/normalize.ts
function normalize(value) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}
function normalizeWithMap(value) {
  let text = "";
  const map = [];
  let index = 0;
  for (const char of value) {
    const normalized = normalize(char);
    for (let i = 0;i < normalized.length; i++)
      map.push(index);
    text += normalized;
    index += char.length;
  }
  return { text, map };
}
function toTerms(query) {
  return normalize(query).split(/\s+/).filter(Boolean);
}

// src/core/match.ts
var cache = new WeakMap;
function prepare(item) {
  const keywords = Array.isArray(item.keywords) ? item.keywords.join(" ") : item.keywords ?? "";
  const key = [item.label, item.description ?? "", keywords, item.group ?? ""].join("\x00");
  const cached = cache.get(item);
  if (cached?.key === key)
    return cached;
  const prepared = {
    key,
    label: normalizeWithMap(item.label),
    keywords: normalize(keywords),
    description: normalize(item.description ?? ""),
    group: normalize(item.group ?? "")
  };
  cache.set(item, prepared);
  return prepared;
}
var WORD_CHAR = /[\p{L}\p{N}]/u;
function isWordStart(text, index) {
  return index === 0 || !WORD_CHAR.test(text[index - 1] ?? "");
}
function findWordStart(text, term) {
  let index = text.indexOf(term);
  while (index !== -1) {
    if (isWordStart(text, index))
      return index;
    index = text.indexOf(term, index + 1);
  }
  return -1;
}
function subsequence(text, term) {
  const pick = (preferWordStart) => {
    const indices2 = [];
    let cursor = 0;
    for (const char of term) {
      let found = -1;
      if (preferWordStart) {
        for (let i = text.indexOf(char, cursor);i !== -1; i = text.indexOf(char, i + 1)) {
          if (isWordStart(text, i)) {
            found = i;
            break;
          }
        }
      }
      if (found === -1)
        found = text.indexOf(char, cursor);
      if (found === -1)
        return null;
      indices2.push(found);
      cursor = found + 1;
    }
    return indices2;
  };
  const indices = pick(true) ?? pick(false);
  if (!indices || !isWordStart(text, indices[0] ?? -1))
    return null;
  return indices;
}
function toOriginalRanges(ranges, label, map) {
  const mapped = ranges.map(([start, end]) => {
    const from = map[start] ?? 0;
    const last = map[end - 1] ?? from;
    const lastLength = (label.codePointAt(last) ?? 0) > 65535 ? 2 : 1;
    return [from, last + lastLength];
  }).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of mapped) {
    const previous = merged[merged.length - 1];
    if (previous && range[0] <= previous[1])
      previous[1] = Math.max(previous[1], range[1]);
    else
      merged.push([range[0], range[1]]);
  }
  return merged;
}
function matchItem(item, terms) {
  if (terms.length === 0)
    return { score: 0, ranges: [] };
  const prepared = prepare(item);
  const label = prepared.label.text;
  const hits = [];
  let score = label === terms.join(" ") ? 1000 : 0;
  for (const term of terms) {
    let termScore = 0;
    const wordStart = findWordStart(label, term);
    const anywhere = wordStart === -1 ? label.indexOf(term) : wordStart;
    if (anywhere !== -1) {
      termScore = anywhere === 0 ? 100 : wordStart !== -1 ? 60 : 30;
      hits.push([anywhere, anywhere + term.length]);
    } else if (findWordStart(prepared.keywords, term) !== -1) {
      termScore = 20;
    } else if (prepared.keywords.includes(term)) {
      termScore = 12;
    } else if (prepared.description.includes(term)) {
      termScore = 6;
    } else if (prepared.group.includes(term)) {
      termScore = 4;
    } else if (term.length >= 2) {
      const indices = subsequence(label, term);
      if (indices) {
        termScore = 2;
        for (const index of indices)
          hits.push([index, index + 1]);
      }
    }
    if (termScore === 0)
      return null;
    score += termScore;
  }
  return { score, ranges: toOriginalRanges(hits, item.label, prepared.label.map) };
}

// src/core/recent.ts
function readRecent(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
function pushRecent(storageKey, id, limit) {
  const next = [id, ...readRecent(storageKey).filter((existing) => existing !== id)].slice(0, limit);
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {}
}

// src/core/results.ts
function groupRows(rows) {
  const groups = new Map;
  for (const row of rows) {
    const name = row.item.group ?? "";
    const list = groups.get(name);
    if (list)
      list.push(row);
    else
      groups.set(name, [row]);
  }
  return [...groups].map(([name, rows2]) => ({ name, rows: rows2 }));
}
function buildResults(items, query, options = {}) {
  const terms = toTerms(query);
  if (terms.length === 0) {
    const byId = new Map(items.map((item) => [item.id, item]));
    const recent = (options.recentIds ?? []).map((id) => byId.get(id)).filter((item) => item !== undefined && !item.disabled);
    const recentSet = new Set(recent);
    const rest = items.filter((item) => !item.searchOnly && !recentSet.has(item));
    const groups = groupRows(rest.map((item) => ({ item, ranges: [] })));
    if (recent.length === 0)
      return groups;
    return [
      { name: options.recentLabel ?? "Recent", rows: recent.map((item) => ({ item: { ...item, indent: false }, ranges: [] })) },
      ...groups
    ];
  }
  const scored = [];
  items.forEach((item, index) => {
    const match = matchItem(item, terms);
    if (match)
      scored.push({ row: { item, ranges: match.ranges }, score: match.score, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return groupRows(scored.slice(0, options.limit ?? 50).map((entry) => entry.row));
}

// src/dom/styles.ts
var STYLES = `
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

// src/dom/theme.ts
var THEME_ATTRIBUTES = ["data-theme", "data-color-scheme", "data-mode"];
function resolveScheme(theme) {
  if (theme !== "auto")
    return theme;
  for (const element of [document.documentElement, document.body]) {
    if (!element)
      continue;
    for (const attribute of THEME_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value === "dark" || value === "light")
        return value;
    }
    if (element.classList.contains("dark"))
      return "dark";
    if (element.classList.contains("light"))
      return "light";
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function watchScheme(host, getTheme) {
  const sync = () => host.setAttribute("data-scheme", resolveScheme(getTheme()));
  const observer = new MutationObserver(sync);
  for (const element of [document.documentElement, document.body]) {
    if (element)
      observer.observe(element, { attributes: true, attributeFilter: ["class", ...THEME_ATTRIBUTES] });
  }
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", sync);
  sync();
  return {
    sync,
    stop() {
      observer.disconnect();
      media?.removeEventListener?.("change", sync);
    }
  };
}

// src/dom/create.ts
var OPEN_EVENT = "omnisearch:open";
var DEFAULT_STRINGS = {
  placeholder: "Search pages and actions…",
  empty: "No results",
  loading: "Searching…",
  results: "{count} results",
  recent: "Recent",
  current: "Current",
  dialogLabel: "Search",
  listLabel: "Results",
  navigateHint: "navigate",
  selectHint: "select",
  closeHint: "close"
};
var SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
var instances = 0;
function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes))
    element.setAttribute(name, value);
  element.append(...children);
  return element;
}
function appendHighlighted(parent, text, ranges) {
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor)
      parent.append(text.slice(cursor, start));
    parent.append(h("mark", { part: "mark" }, text.slice(start, end)));
    cursor = end;
  }
  if (cursor < text.length)
    parent.append(text.slice(cursor));
}
function isEditable(target) {
  if (!(target instanceof HTMLElement))
    return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}
function lockScroll() {
  const root = document.documentElement;
  const { overflow, scrollbarGutter } = root.style;
  const hasScrollbar = window.innerWidth > root.clientWidth;
  root.style.overflow = "hidden";
  if (hasScrollbar)
    root.style.scrollbarGutter = "stable";
  return () => {
    root.style.overflow = overflow;
    root.style.scrollbarGutter = scrollbarGutter;
  };
}
function openOmnisearch(query) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { query } }));
}
function createOmnisearch(initialOptions = {}) {
  let options = initialOptions;
  const uid = `omni${++instances}`;
  let isOpen = false;
  let query = "";
  let activeIndex = 0;
  let rows = [];
  let restoreFocus = null;
  let unlockScroll = null;
  const asyncResults = new Map;
  const pending = new Set;
  const timers = new Map;
  const aborts = new Map;
  const strings = () => ({ ...DEFAULT_STRINGS, ...options.strings });
  const hotkeys = () => {
    if (options.hotkey === false)
      return [];
    const specs = options.hotkey ?? "mod+k";
    return (Array.isArray(specs) ? specs : [specs]).map(parseHotkey);
  };
  const getItems = () => typeof options.items === "function" ? options.items() : options.items ?? [];
  const recentConfig = () => {
    if (!options.recent)
      return null;
    return { storageKey: "omnisearch:recent", limit: 5, ...options.recent === true ? {} : options.recent };
  };
  const host = h("div", { "data-omnisearch": "" });
  host.hidden = true;
  const shadow = host.attachShadow({ mode: "open" });
  const searchIcon = h("span", { class: "search-icon", "aria-hidden": "true" });
  searchIcon.innerHTML = SEARCH_ICON;
  const input = h("input", {
    class: "input",
    part: "input",
    type: "text",
    role: "combobox",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    "aria-expanded": "true",
    "aria-autocomplete": "list",
    "aria-controls": `${uid}-list`
  });
  const spinner = h("span", { class: "spinner", "aria-hidden": "true" });
  spinner.hidden = true;
  const header = h("div", { class: "header", part: "header" }, searchIcon, input, spinner, h("kbd", { part: "kbd" }, "esc"));
  const list = h("div", { class: "list", part: "list", id: `${uid}-list`, role: "listbox" });
  const footer = h("div", { class: "footer", part: "footer", "aria-hidden": "true" });
  const status = h("div", { class: "sr-only", role: "status", "aria-live": "polite" });
  const panel = h("div", { class: "panel", part: "panel", role: "dialog", "aria-modal": "true" }, header, list, footer, status);
  const backdrop = h("div", { class: "backdrop", part: "backdrop" });
  const style = h("style", {}, STYLES);
  shadow.append(style, backdrop, panel);
  (options.container ?? document.body).append(host);
  const scheme = watchScheme(host, () => options.theme ?? "auto");
  function applyStrings() {
    const text = strings();
    input.placeholder = text.placeholder;
    input.setAttribute("aria-label", text.placeholder);
    panel.setAttribute("aria-label", text.dialogLabel);
    list.setAttribute("aria-label", text.listLabel);
    const hint = (keys, label) => h("span", {}, ...keys.map((key) => h("kbd", { part: "kbd" }, key)), label);
    const first = hotkeys()[0];
    footer.replaceChildren(hint(["↑", "↓"], text.navigateHint), hint(["↵"], text.selectHint), hint(["esc"], text.closeHint), ...first ? [h("span", { class: "spacer" }, h("kbd", { part: "kbd" }, formatHotkey(first)))] : []);
  }
  function collectGroups() {
    const recent = recentConfig();
    const groups = buildResults(getItems(), query, {
      recentIds: recent ? readRecent(recent.storageKey) : [],
      recentLabel: strings().recent,
      limit: options.limit
    });
    const terms = toTerms(query);
    for (const source of options.sources ?? []) {
      for (const result of asyncResults.get(source.id) ?? []) {
        const item = result.group ? result : { ...result, group: source.group ?? source.id };
        const row = { item, ranges: matchItem(item, terms)?.ranges ?? [] };
        const group = groups.find((existing) => existing.name === item.group);
        if (group)
          group.rows.push(row);
        else
          groups.push({ name: item.group ?? "", rows: [row] });
      }
    }
    return groups;
  }
  function renderRow(row, index, iconColumn) {
    const { item } = row;
    const element = h("div", {
      class: item.indent ? "item indent" : "item",
      part: "item",
      role: "option",
      id: `${uid}-option-${index}`,
      "aria-selected": "false"
    });
    if (item.disabled)
      element.setAttribute("aria-disabled", "true");
    if (item.checked !== undefined)
      element.setAttribute("aria-checked", String(item.checked));
    if (iconColumn) {
      const icon = h("span", { class: "item-icon", part: "item-icon", "aria-hidden": "true" });
      if (item.iconHtml)
        icon.innerHTML = item.iconHtml;
      else if (typeof item.icon === "string")
        icon.textContent = item.icon;
      else if (item.icon)
        icon.append(item.icon.cloneNode(true));
      element.append(icon);
    }
    const label = h("span", { class: "item-label", part: "item-label" });
    appendHighlighted(label, item.label, row.ranges);
    const text = h("span", { class: "item-text" }, label);
    if (item.description) {
      text.append(h("span", { class: "item-description", part: "item-description" }, item.description));
    }
    element.append(text);
    const meta = h("span", { class: "item-meta", part: "item-meta" });
    const badge = item.badge ?? (item.active ? strings().current : undefined);
    if (badge)
      meta.append(h("span", { class: "badge", part: "badge" }, badge));
    if (item.shortcut)
      meta.append(...item.shortcut.split(/\s+/).map((key) => h("kbd", { part: "kbd" }, key)));
    if (item.checked !== undefined) {
      const toggle = h("span", { class: "switch", part: "switch", "aria-hidden": "true" });
      if (item.checked)
        toggle.setAttribute("data-on", "");
      meta.append(toggle);
    }
    if (item.external)
      meta.append(h("span", { "aria-hidden": "true" }, "↗"));
    if (meta.childNodes.length > 0)
      element.append(meta);
    element.addEventListener("pointermove", () => {
      if (activeIndex !== index)
        setActive(index, false);
    });
    element.addEventListener("click", (event) => void select(index, event.metaKey || event.ctrlKey));
    return element;
  }
  function render() {
    const text = strings();
    const groups = collectGroups();
    const fragment = document.createDocumentFragment();
    const iconColumn = groups.some((group) => group.rows.some(({ item }) => item.icon || item.iconHtml));
    rows = [];
    groups.forEach((group, groupIndex) => {
      const groupElement = h("div", { class: "group", part: "group", role: "group" });
      if (group.name) {
        const labelId = `${uid}-group-${groupIndex}`;
        groupElement.setAttribute("aria-labelledby", labelId);
        groupElement.append(h("div", { class: "group-label", part: "group-label", id: labelId }, group.name));
      }
      for (const row of group.rows) {
        const element = renderRow(row, rows.length, iconColumn);
        rows.push({ row, element });
        groupElement.append(element);
      }
      fragment.append(groupElement);
    });
    const loading = pending.size > 0;
    if (rows.length === 0)
      fragment.append(h("div", { class: "empty", part: "empty" }, loading ? text.loading : text.empty));
    list.replaceChildren(fragment);
    spinner.hidden = !loading;
    status.textContent = query.trim() ? text.results.replace("{count}", String(rows.length)) : "";
    const enabled = rows.findIndex((entry, index) => index >= activeIndex && !entry.row.item.disabled);
    setActive(enabled === -1 ? Math.max(0, rows.findIndex((entry) => !entry.row.item.disabled)) : enabled, false);
  }
  function setActive(index, scroll = true) {
    rows[activeIndex]?.element.setAttribute("aria-selected", "false");
    activeIndex = index;
    const current = rows[index];
    if (!current) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    current.element.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", current.element.id);
    if (scroll)
      current.element.scrollIntoView?.({ block: "nearest" });
  }
  function move(delta) {
    const count = rows.length;
    for (let step = 1;step <= count; step++) {
      const index = ((activeIndex + delta * step) % count + count) % count;
      if (!rows[index]?.row.item.disabled) {
        setActive(index);
        return;
      }
    }
  }
  async function select(index, newTab) {
    const item = rows[index]?.row.item;
    if (!item || item.disabled)
      return;
    const keepOpen = item.keepOpen ?? item.checked !== undefined;
    const recent = recentConfig();
    if (recent && !keepOpen)
      pushRecent(recent.storageKey, item.id, recent.limit);
    options.onSelect?.(item);
    if (item.perform) {
      const context = { query, newTab, open, close, refresh };
      if (!keepOpen)
        close();
      try {
        await item.perform(context);
      } finally {
        if (keepOpen)
          refresh();
      }
      return;
    }
    if (item.href) {
      close();
      if (item.external || newTab)
        window.open(item.href, "_blank", "noopener,noreferrer");
      else if (options.navigate)
        options.navigate(item.href, item);
      else
        window.location.assign(item.href);
    }
  }
  function cancelSources() {
    for (const timer of timers.values())
      clearTimeout(timer);
    for (const abort of aborts.values())
      abort.abort();
    timers.clear();
    aborts.clear();
    pending.clear();
  }
  function runSources() {
    const trimmed = query.trim();
    for (const source of options.sources ?? []) {
      clearTimeout(timers.get(source.id));
      aborts.get(source.id)?.abort();
      pending.delete(source.id);
      if (trimmed.length < (source.minQueryLength ?? 2)) {
        asyncResults.delete(source.id);
        continue;
      }
      pending.add(source.id);
      const timer = setTimeout(async () => {
        const abort = new AbortController;
        aborts.set(source.id, abort);
        try {
          const results = await source.search(trimmed, abort.signal);
          if (!abort.signal.aborted)
            asyncResults.set(source.id, results);
        } catch (error) {
          if (!abort.signal.aborted) {
            asyncResults.delete(source.id);
            console.error(`[omnisearch] source "${source.id}" failed`, error);
          }
        } finally {
          if (!abort.signal.aborted) {
            pending.delete(source.id);
            if (isOpen)
              render();
          }
        }
      }, source.debounce ?? 150);
      timers.set(source.id, timer);
    }
  }
  function setQuery(value) {
    query = value;
    input.value = value;
    activeIndex = 0;
    runSources();
    render();
    list.scrollTop = 0;
  }
  function open(initialQuery) {
    if (isOpen) {
      if (initialQuery !== undefined)
        setQuery(initialQuery);
      input.focus();
      return;
    }
    isOpen = true;
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    host.hidden = false;
    if (options.lockScroll !== false)
      unlockScroll = lockScroll();
    setQuery(initialQuery ?? "");
    input.focus();
    options.onOpen?.();
  }
  function close() {
    if (!isOpen)
      return;
    isOpen = false;
    host.hidden = true;
    unlockScroll?.();
    unlockScroll = null;
    cancelSources();
    asyncResults.clear();
    if (restoreFocus?.isConnected)
      restoreFocus.focus({ preventScroll: true });
    restoreFocus = null;
    options.onClose?.();
  }
  function refresh() {
    if (isOpen)
      render();
  }
  input.addEventListener("input", () => setQuery(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.isComposing)
      return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Tab": {
        event.preventDefault();
        const back = event.key === "ArrowUp" || event.key === "Tab" && event.shiftKey;
        move(back ? -1 : 1);
        break;
      }
      case "Enter":
        event.preventDefault();
        select(activeIndex, event.metaKey || event.ctrlKey);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
    }
  });
  backdrop.addEventListener("click", () => close());
  panel.addEventListener("mousedown", (event) => {
    if (event.target !== input)
      event.preventDefault();
  });
  function onKeydown(event) {
    const hotkey = hotkeys().find((candidate) => matchesHotkey(event, candidate));
    if (!hotkey)
      return;
    if (!hotkey.mod && isEditable(event.composedPath()[0]))
      return;
    event.preventDefault();
    if (isOpen)
      close();
    else
      open();
  }
  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const trigger = target?.closest("[data-omnisearch-open]");
    if (!trigger)
      return;
    event.preventDefault();
    open(trigger.getAttribute("data-omnisearch-open") || undefined);
  }
  function onOpenEvent(event) {
    open(event.detail?.query);
  }
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onClick);
  window.addEventListener(OPEN_EVENT, onOpenEvent);
  applyStrings();
  return {
    get isOpen() {
      return isOpen;
    },
    element: host,
    open,
    close,
    toggle: () => isOpen ? close() : open(),
    refresh,
    setItems(items) {
      options = { ...options, items };
      refresh();
    },
    update(next) {
      options = { ...options, ...next };
      scheme.sync();
      applyStrings();
      refresh();
    },
    destroy() {
      close();
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("click", onClick);
      window.removeEventListener(OPEN_EVENT, onOpenEvent);
      scheme.stop();
      host.remove();
    }
  };
}
export {
  resolveScheme,
  parseHotkey,
  openOmnisearch,
  normalize,
  matchesHotkey,
  matchItem,
  formatHotkey,
  createOmnisearch,
  buildResults,
  OPEN_EVENT,
  DEFAULT_STRINGS
};
