import { formatHotkey, matchesHotkey, parseHotkey, type Hotkey } from "../core/hotkey";
import { matchItem, type Range } from "../core/match";
import { toTerms } from "../core/normalize";
import { pushRecent, readRecent } from "../core/recent";
import { buildResults, type ResultGroup, type ResultRow } from "../core/results";
import type {
  OmnisearchController,
  OmnisearchItem,
  OmnisearchOptions,
  OmnisearchStrings,
} from "../types";
import { STYLES } from "./styles";
import { watchScheme } from "./theme";

/** Window event that opens every palette on the page. `detail.query` prefills the input. */
export const OPEN_EVENT = "omnisearch:open";

export const DEFAULT_STRINGS: OmnisearchStrings = {
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
  closeHint: "close",
};

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

let instances = 0;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

function appendHighlighted(parent: HTMLElement, text: string, ranges: Range[]): void {
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parent.append(text.slice(cursor, start));
    parent.append(h("mark", { part: "mark" }, text.slice(start, end)));
    cursor = end;
  }
  if (cursor < text.length) parent.append(text.slice(cursor));
}

function isEditable(target: EventTarget | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

function lockScroll(): () => void {
  const root = document.documentElement;
  const { overflow, scrollbarGutter } = root.style;
  const hasScrollbar = window.innerWidth > root.clientWidth;
  root.style.overflow = "hidden";
  if (hasScrollbar) root.style.scrollbarGutter = "stable";
  return () => {
    root.style.overflow = overflow;
    root.style.scrollbarGutter = scrollbarGutter;
  };
}

/** Opens every palette on the page, optionally with a prefilled query. */
export function openOmnisearch(query?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { query } }));
}

/**
 * Creates a command palette and appends its (hidden) host element to the page.
 * Call it in the browser only; in SSR frameworks call it from an effect.
 */
export function createOmnisearch(initialOptions: OmnisearchOptions = {}): OmnisearchController {
  let options = initialOptions;
  const uid = `omni${++instances}`;
  let isOpen = false;
  let query = "";
  let activeIndex = 0;
  let rows: { row: ResultRow; element: HTMLElement }[] = [];
  let restoreFocus: HTMLElement | null = null;
  let unlockScroll: (() => void) | null = null;

  const asyncResults = new Map<string, OmnisearchItem[]>();
  const pending = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const aborts = new Map<string, AbortController>();

  const strings = (): OmnisearchStrings => ({ ...DEFAULT_STRINGS, ...options.strings });
  const hotkeys = (): Hotkey[] => {
    if (options.hotkey === false) return [];
    const specs = options.hotkey ?? "mod+k";
    return (Array.isArray(specs) ? specs : [specs]).map(parseHotkey);
  };
  const getItems = (): OmnisearchItem[] =>
    typeof options.items === "function" ? options.items() : (options.items ?? []);
  const recentConfig = () => {
    if (!options.recent) return null;
    return { storageKey: "omnisearch:recent", limit: 5, ...(options.recent === true ? {} : options.recent) };
  };

  // --- DOM -----------------------------------------------------------------

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
    "aria-controls": `${uid}-list`,
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

  function applyStrings(): void {
    const text = strings();
    input.placeholder = text.placeholder;
    input.setAttribute("aria-label", text.placeholder);
    panel.setAttribute("aria-label", text.dialogLabel);
    list.setAttribute("aria-label", text.listLabel);
    const hint = (keys: string[], label: string) =>
      h("span", {}, ...keys.map((key) => h("kbd", { part: "kbd" }, key)), label);
    const first = hotkeys()[0];
    footer.replaceChildren(
      hint(["↑", "↓"], text.navigateHint),
      hint(["↵"], text.selectHint),
      hint(["esc"], text.closeHint),
      ...(first ? [h("span", { class: "spacer" }, h("kbd", { part: "kbd" }, formatHotkey(first)))] : []),
    );
  }

  // --- Rendering -------------------------------------------------------------

  function collectGroups(): ResultGroup[] {
    const recent = recentConfig();
    const groups = buildResults(getItems(), query, {
      recentIds: recent ? readRecent(recent.storageKey) : [],
      recentLabel: strings().recent,
      limit: options.limit,
    });
    const terms = toTerms(query);
    for (const source of options.sources ?? []) {
      for (const result of asyncResults.get(source.id) ?? []) {
        const item = result.group ? result : { ...result, group: source.group ?? source.id };
        const row: ResultRow = { item, ranges: matchItem(item, terms)?.ranges ?? [] };
        const group = groups.find((existing) => existing.name === item.group);
        if (group) group.rows.push(row);
        else groups.push({ name: item.group ?? "", rows: [row] });
      }
    }
    return groups;
  }

  function renderRow(row: ResultRow, index: number, iconColumn: boolean): HTMLElement {
    const { item } = row;
    const element = h("div", {
      class: item.indent ? "item indent" : "item",
      part: "item",
      role: "option",
      id: `${uid}-option-${index}`,
      "aria-selected": "false",
    });
    if (item.disabled) element.setAttribute("aria-disabled", "true");
    if (item.checked !== undefined) element.setAttribute("aria-checked", String(item.checked));

    // Once any row has an icon, every row gets the slot so labels line up.
    if (iconColumn) {
      const icon = h("span", { class: "item-icon", part: "item-icon", "aria-hidden": "true" });
      if (item.iconHtml) icon.innerHTML = item.iconHtml;
      else if (typeof item.icon === "string") icon.textContent = item.icon;
      else if (item.icon) icon.append(item.icon.cloneNode(true));
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
    if (badge) meta.append(h("span", { class: "badge", part: "badge" }, badge));
    if (item.shortcut) meta.append(...item.shortcut.split(/\s+/).map((key) => h("kbd", { part: "kbd" }, key)));
    if (item.checked !== undefined) {
      const toggle = h("span", { class: "switch", part: "switch", "aria-hidden": "true" });
      if (item.checked) toggle.setAttribute("data-on", "");
      meta.append(toggle);
    }
    if (item.external) meta.append(h("span", { "aria-hidden": "true" }, "↗"));
    if (meta.childNodes.length > 0) element.append(meta);

    // pointermove rather than mouseenter: scrolling the list with the keyboard
    // must not hand the selection to whatever row ends up under a resting cursor.
    element.addEventListener("pointermove", () => {
      if (activeIndex !== index) setActive(index, false);
    });
    element.addEventListener("click", (event) => void select(index, event.metaKey || event.ctrlKey));
    return element;
  }

  function render(): void {
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
    if (rows.length === 0) fragment.append(h("div", { class: "empty", part: "empty" }, loading ? text.loading : text.empty));
    list.replaceChildren(fragment);
    spinner.hidden = !loading;
    status.textContent = query.trim() ? text.results.replace("{count}", String(rows.length)) : "";

    const enabled = rows.findIndex((entry, index) => index >= activeIndex && !entry.row.item.disabled);
    setActive(enabled === -1 ? Math.max(0, rows.findIndex((entry) => !entry.row.item.disabled)) : enabled, false);
  }

  function setActive(index: number, scroll = true): void {
    rows[activeIndex]?.element.setAttribute("aria-selected", "false");
    activeIndex = index;
    const current = rows[index];
    if (!current) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    current.element.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", current.element.id);
    if (scroll) current.element.scrollIntoView?.({ block: "nearest" });
  }

  function move(delta: 1 | -1): void {
    const count = rows.length;
    for (let step = 1; step <= count; step++) {
      const index = (((activeIndex + delta * step) % count) + count) % count;
      if (!rows[index]?.row.item.disabled) {
        setActive(index);
        return;
      }
    }
  }

  // --- Actions ---------------------------------------------------------------

  async function select(index: number, newTab: boolean): Promise<void> {
    const item = rows[index]?.row.item;
    if (!item || item.disabled) return;
    const keepOpen = item.keepOpen ?? item.checked !== undefined;
    const recent = recentConfig();
    // Toggles stay out of history: they would jump into the Recent group mid-use.
    if (recent && !keepOpen) pushRecent(recent.storageKey, item.id, recent.limit);
    options.onSelect?.(item);

    if (item.perform) {
      const context = { query, newTab, open, close, refresh };
      if (!keepOpen) close();
      try {
        await item.perform(context);
      } finally {
        if (keepOpen) refresh();
      }
      return;
    }

    if (item.href) {
      close();
      if (item.external || newTab) window.open(item.href, "_blank", "noopener,noreferrer");
      else if (options.navigate) options.navigate(item.href, item);
      else window.location.assign(item.href);
    }
  }

  function cancelSources(): void {
    for (const timer of timers.values()) clearTimeout(timer);
    for (const abort of aborts.values()) abort.abort();
    timers.clear();
    aborts.clear();
    pending.clear();
  }

  function runSources(): void {
    const trimmed = query.trim();
    for (const source of options.sources ?? []) {
      clearTimeout(timers.get(source.id));
      aborts.get(source.id)?.abort();
      pending.delete(source.id);
      // Stale results stay visible until fresh ones arrive, to avoid flicker while typing.
      if (trimmed.length < (source.minQueryLength ?? 2)) {
        asyncResults.delete(source.id);
        continue;
      }
      pending.add(source.id);
      const timer = setTimeout(async () => {
        const abort = new AbortController();
        aborts.set(source.id, abort);
        try {
          const results = await source.search(trimmed, abort.signal);
          if (!abort.signal.aborted) asyncResults.set(source.id, results);
        } catch (error) {
          if (!abort.signal.aborted) {
            asyncResults.delete(source.id);
            console.error(`[omnisearch] source "${source.id}" failed`, error);
          }
        } finally {
          if (!abort.signal.aborted) {
            pending.delete(source.id);
            if (isOpen) render();
          }
        }
      }, source.debounce ?? 150);
      timers.set(source.id, timer);
    }
  }

  function setQuery(value: string): void {
    query = value;
    input.value = value;
    activeIndex = 0;
    runSources();
    render();
    list.scrollTop = 0;
  }

  function open(initialQuery?: string): void {
    if (isOpen) {
      if (initialQuery !== undefined) setQuery(initialQuery);
      input.focus();
      return;
    }
    isOpen = true;
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    host.hidden = false;
    if (options.lockScroll !== false) unlockScroll = lockScroll();
    setQuery(initialQuery ?? "");
    input.focus();
    options.onOpen?.();
  }

  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    host.hidden = true;
    unlockScroll?.();
    unlockScroll = null;
    cancelSources();
    asyncResults.clear();
    if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
    restoreFocus = null;
    options.onClose?.();
  }

  function refresh(): void {
    if (isOpen) render();
  }

  // --- Events ----------------------------------------------------------------

  input.addEventListener("input", () => setQuery(input.value));

  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Tab": {
        event.preventDefault();
        const back = event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey);
        move(back ? -1 : 1);
        break;
      }
      case "Enter":
        event.preventDefault();
        void select(activeIndex, event.metaKey || event.ctrlKey);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
    }
  });

  backdrop.addEventListener("click", () => close());
  // Clicks inside the panel must not steal focus from the input.
  panel.addEventListener("mousedown", (event) => {
    if (event.target !== input) event.preventDefault();
  });

  function onKeydown(event: KeyboardEvent): void {
    const hotkey = hotkeys().find((candidate) => matchesHotkey(event, candidate));
    if (!hotkey) return;
    // Bare keys like "/" must keep working as text in form fields, including our own input.
    if (!hotkey.mod && isEditable(event.composedPath()[0])) return;
    event.preventDefault();
    if (isOpen) close();
    else open();
  }

  function onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const trigger = target?.closest("[data-omnisearch-open]");
    if (!trigger) return;
    event.preventDefault();
    open(trigger.getAttribute("data-omnisearch-open") || undefined);
  }

  function onOpenEvent(event: Event): void {
    open((event as CustomEvent<{ query?: string } | undefined>).detail?.query);
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
    toggle: () => (isOpen ? close() : open()),
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
    },
  };
}
