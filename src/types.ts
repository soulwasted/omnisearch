/** Context passed to `item.perform`. */
export interface OmnisearchContext {
  /** The query typed when the item was selected. */
  query: string;
  /** True when the user held Cmd/Ctrl while selecting. */
  newTab: boolean;
  open(query?: string): void;
  close(): void;
  /** Re-reads items (when `items` is a function) and re-renders the list. */
  refresh(): void;
}

export interface OmnisearchItem {
  /** Unique and stable. Used for recent history and DOM ids. */
  id: string;
  label: string;
  description?: string;
  /** Group heading. Items without a group render in an unlabeled group. */
  group?: string;
  /** Extra search terms that are matched but never shown. */
  keywords?: string | string[];
  /** Plain text or emoji, or a DOM node (cloned on render). */
  icon?: string | Node;
  /** Trusted SVG/HTML markup for the icon. Never pass user input here. */
  iconHtml?: string;
  /** Navigates here on select (via `options.navigate` when set). */
  href?: string;
  /** Opens `href` in a new tab. */
  external?: boolean;
  /** Runs on select. Takes precedence over `href`. */
  perform?: (context: OmnisearchContext) => void | Promise<void>;
  /** Marks the current page or the selected option with a badge. */
  active?: boolean;
  /** Custom badge text. Defaults to `strings.current` when `active` is set. */
  badge?: string;
  /** Renders a switch. Implies `keepOpen`. */
  checked?: boolean;
  /** Keeps the palette open after `perform` and refreshes the list. */
  keepOpen?: boolean;
  /** Keyboard shortcut hint, display only (e.g. "G H"). */
  shortcut?: string;
  /** Shown only once the user types a query. */
  searchOnly?: boolean;
  disabled?: boolean;
  /** Renders the item as a child of the item above it. */
  indent?: boolean;
}

export interface OmnisearchSource {
  id: string;
  /** Group for results without their own `group`. Defaults to the source id. */
  group?: string;
  /** Minimum query length before `search` runs. Default 2. */
  minQueryLength?: number;
  /** Debounce in milliseconds. Default 150. */
  debounce?: number;
  /** Results are shown as returned, after local matches. Honour `signal`. */
  search(query: string, signal: AbortSignal): OmnisearchItem[] | Promise<OmnisearchItem[]>;
}

export interface OmnisearchStrings {
  placeholder: string;
  empty: string;
  loading: string;
  /** Screen reader announcement; `{count}` is replaced with the number of results. */
  results: string;
  recent: string;
  current: string;
  dialogLabel: string;
  listLabel: string;
  navigateHint: string;
  selectHint: string;
  closeHint: string;
}

export type OmnisearchTheme = "auto" | "light" | "dark";

export interface OmnisearchOptions {
  /** Static items, or a function re-read on every open, query and refresh. */
  items?: OmnisearchItem[] | (() => OmnisearchItem[]);
  /** Async providers, e.g. a server-side search. */
  sources?: OmnisearchSource[];
  /** Global shortcut(s), e.g. "mod+k" or ["mod+k", "/"]. `false` disables. Default "mod+k". */
  hotkey?: string | string[] | false;
  /** Router hook for internal links, e.g. `(href) => router.push(href)`. Default `location.assign`. */
  navigate?: (href: string, item: OmnisearchItem) => void;
  /** "auto" follows `.dark`/`[data-theme]` on <html> or <body>, then the OS. Default "auto". */
  theme?: OmnisearchTheme;
  /** Remembers selected items and lists them first. `true` uses the key "omnisearch:recent". */
  recent?: boolean | { storageKey?: string; limit?: number };
  /** Maximum number of local results while searching. Default 50. */
  limit?: number;
  /** Locks page scroll while open. Default true. */
  lockScroll?: boolean;
  strings?: Partial<OmnisearchStrings>;
  /** Element the palette host is appended to. Default `document.body`. */
  container?: HTMLElement;
  onOpen?: () => void;
  onClose?: () => void;
  onSelect?: (item: OmnisearchItem) => void;
}

export interface OmnisearchController {
  readonly isOpen: boolean;
  /** The host element. Set `--omni-*` tokens on it or style its `::part()`s. */
  readonly element: HTMLElement;
  open(query?: string): void;
  close(): void;
  toggle(): void;
  refresh(): void;
  setItems(items: OmnisearchOptions["items"]): void;
  /** Merges new options into the current ones. */
  update(options: Partial<OmnisearchOptions>): void;
  destroy(): void;
}
