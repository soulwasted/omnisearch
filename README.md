# Omnisearch

A ⌘K / Ctrl K command palette you can drop into any project: plain HTML, Vite, Next.js or anything else. One framework-agnostic core, a thin React adapter, zero runtime dependencies, about 7.5 KB gzipped.

- **Isolated UI.** Renders inside a shadow root, so host CSS (Tailwind preflight, global `input {}` rules) can't break it.
- **Themeable.** Semantic `--omni-*` tokens that inherit from the page, plus `::part()` for anything else.
- **Follows the page theme.** Picks up `.dark` / `[data-theme]` on `<html>` or `<body>` (next-themes, Tailwind, Style Kit) and falls back to the OS setting.
- **Search that forgives.** Diacritics-insensitive (`cislo` finds `Číslo`), multi-term, initials (`ds` → Design system), ranked and highlighted.
- **More than links.** Actions, toggles that keep the palette open, current-page badges, recent history, search-only items and async sources.
- **Accessible.** ARIA combobox/listbox, focus restore, live result count, reduced motion.

Try it: `bun install && bun run demo`, then open http://localhost:4173/demo/.

## Install

From GitHub (`dist/` is committed, so there is no build step on install):

```bash
bun add github:soulwasted/omnisearch#v0.1.0
```

Or straight from a CDN in a static page:

```html
<script type="module">
  import { createOmnisearch } from "https://cdn.jsdelivr.net/gh/soulwasted/omnisearch@v0.1.0/dist/omnisearch.min.js";
</script>
```

## Quick start

### Vanilla / plain HTML

```html
<button type="button" data-omnisearch-open>Search… <kbd>⌘K</kbd></button>

<script type="module">
  import { createOmnisearch } from "@soulwasted/omnisearch";

  createOmnisearch({
    items: [
      { id: "home", label: "Home", group: "Pages", href: "/" },
      { id: "docs", label: "Documentation", group: "Pages", href: "/docs", keywords: "help guide" },
      { id: "github", label: "GitHub", group: "Links", href: "https://github.com/…", external: true },
      { id: "print", label: "Print page", group: "Actions", perform: () => window.print() },
    ],
  });
</script>
```

Any element with `data-omnisearch-open` opens the palette. Give the attribute a value to prefill the query: `data-omnisearch-open="settings"`.

### React / Next.js

```tsx
"use client";

import { Omnisearch, type OmnisearchItem } from "@soulwasted/omnisearch/react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";

export function AppOmnisearch() {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  const items: OmnisearchItem[] = [
    { id: "home", label: "Home", group: "Pages", href: "/", active: pathname === "/" },
    { id: "stack", label: "Stack", group: "Pages", href: "/stack", active: pathname === "/stack" },
    {
      id: "dark",
      label: "Dark mode",
      group: "Settings",
      keywords: "theme appearance",
      checked: resolvedTheme === "dark",
      perform: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
  ];

  return <Omnisearch items={items} navigate={(href) => router.push(href)} recent />;
}
```

Render it once, e.g. in the root layout. The component renders nothing itself. Props are re-applied on every render, so derive `items` from state directly. Pass a `ref` to get `open()`, `close()`, `toggle()` and `refresh()`.

Anywhere else in the app, `openOmnisearch("query")` opens the palette without a ref (it dispatches the `omnisearch:open` window event).

## Items

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique and stable. Used for recent history. |
| `label` | `string` | Main text, highlighted on match. |
| `description` | `string` | Secondary text next to the label. Searchable. |
| `group` | `string` | Group heading. Items without one form an unlabeled group. |
| `keywords` | `string \| string[]` | Extra search terms, never shown. |
| `icon` | `string \| Node` | Emoji/text, or a DOM node (cloned). |
| `iconHtml` | `string` | Trusted SVG/HTML markup. Never pass user input. |
| `href` | `string` | Navigates on select, via `navigate` when set. |
| `external` | `boolean` | Opens `href` in a new tab and shows ↗. |
| `perform` | `(context) => void \| Promise<void>` | Runs on select. Wins over `href`. |
| `active` | `boolean` | Shows the "Current" badge (current page, selected option). |
| `badge` | `string` | Custom badge text. |
| `checked` | `boolean` | Renders a switch and implies `keepOpen`. |
| `keepOpen` | `boolean` | Keeps the palette open after `perform` and refreshes the list. |
| `shortcut` | `string` | Display-only hint, keys separated by spaces (`"G H"`). |
| `searchOnly` | `boolean` | Hidden until the user types. Good for rare or destructive actions. |
| `disabled` | `boolean` | Shown dimmed, skipped by the keyboard. |
| `indent` | `boolean` | Shows the item as a child of the one above. |

`perform` receives `{ query, newTab, open, close, refresh }`. The palette closes *before* `perform` runs (unless `keepOpen`), so focus is already back on the page when your action starts.

With no query, items keep their order. Order them by importance; while searching, ties in score keep that order too.

### Dynamic items

Pass a function to `items` and it is re-read on every open, keystroke and `refresh()`. That's the simplest way to keep `active` and `checked` in sync in vanilla code:

```js
createOmnisearch({
  items: () => [
    { id: "home", label: "Home", href: "/", active: location.pathname === "/" },
    { id: "dark", label: "Dark mode", checked: document.documentElement.dataset.theme === "dark", perform: toggleTheme },
  ],
});
```

### Async sources

For server-side search. Results are appended after local matches, under the source's group:

```js
createOmnisearch({
  items,
  sources: [
    {
      id: "companies",
      group: "Companies",
      minQueryLength: 2, // default 2
      debounce: 150,     // default 150 ms
      async search(query, signal) {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
        const results = await response.json();
        return results.map((result) => ({ id: result.id, label: result.name, href: result.url }));
      },
    },
  ],
});
```

Stale requests are aborted through `signal`. A spinner shows while any source is pending.

## Options

| Option | Default | Description |
|---|---|---|
| `items` | `[]` | Items, or a function returning them. |
| `sources` | `[]` | Async providers, see above. |
| `hotkey` | `"mod+k"` | String or array (`["mod+k", "/"]`), `false` to disable. `mod` is ⌘ on macOS, Ctrl elsewhere (both work everywhere). Bare keys like `/` are ignored while typing in form fields. |
| `navigate` | `location.assign` | Router hook for internal links: `(href, item) => router.push(href)`. |
| `theme` | `"auto"` | `"auto"`, `"light"` or `"dark"`. |
| `recent` | `false` | `true`, or `{ storageKey, limit }` (defaults `"omnisearch:recent"`, 5). Use a per-project `storageKey` when several projects share an origin, such as localhost. |
| `limit` | `50` | Maximum local results while searching. |
| `lockScroll` | `true` | Locks page scroll while open. |
| `strings` | English | Override any UI text, see below. |
| `container` | `document.body` | Where the host element is appended. |
| `onOpen`, `onClose`, `onSelect(item)` | | Callbacks. |

### Controller

`createOmnisearch()` returns:

```ts
palette.open(query?)    // open, optionally with a prefilled query
palette.close()
palette.toggle()
palette.refresh()       // re-read items and re-render (when open)
palette.setItems(items)
palette.update(options) // merge new options, e.g. strings or theme
palette.destroy()       // remove listeners and the element
palette.isOpen
palette.element         // the host element, for tokens and ::part()
```

### Localisation

```js
createOmnisearch({
  items,
  strings: {
    placeholder: "Hledat stránky a akce…",
    empty: "Nic nenalezeno",
    loading: "Hledám…",
    results: "Výsledků: {count}",
    recent: "Nedávné",
    current: "Aktivní",
    dialogLabel: "Hledání",
    listLabel: "Výsledky",
    navigateHint: "pohyb",
    selectHint: "výběr",
    closeHint: "zavřít",
  },
});
```

## Theming

Set tokens anywhere above the palette, usually `:root`. They inherit into the shadow root. Map them onto your own design tokens and dark mode follows automatically:

```css
:root {
  --omni-font: var(--font-sans);
  --omni-bg: var(--color-surface);
  --omni-fg: var(--color-ink);
  --omni-muted: var(--color-muted);
  --omni-border: var(--color-line);
  --omni-active: var(--color-fill);
  --omni-accent: var(--color-brand);
}
```

| Token | Default (light / dark) |
|---|---|
| `--omni-font` | system UI stack |
| `--omni-font-size` | `14px` |
| `--omni-bg` | `#ffffff` / `#18181b` |
| `--omni-fg` | `#18181b` / `#fafafa` |
| `--omni-muted` | `#71717a` / `#a1a1aa` |
| `--omni-border` | `#e4e4e7` / `#2e2e33` |
| `--omni-active` | `#f4f4f5` / `#27272a` (selected row) |
| `--omni-accent` | `#2563eb` / `#60a5fa` (highlights, switches) |
| `--omni-backdrop` | `rgb(9 9 11 / .4)` / `rgb(0 0 0 / .6)` |
| `--omni-shadow` | soft drop shadow |
| `--omni-radius` | `12px` |
| `--omni-width` | `36rem` |
| `--omni-top` | `12vh` |
| `--omni-max-height` | `min(60vh, 28rem)` |
| `--omni-z` | `2147483000` |

A token you set applies in both schemes. To change only the built-in dark look, scope it: `[data-omnisearch][data-scheme="dark"] { --omni-bg: #000 }`.

For anything tokens don't cover, style the exposed parts:

```css
[data-omnisearch]::part(panel) { border-radius: 4px; }
[data-omnisearch]::part(item-label) { font-weight: 600; }
```

Parts: `backdrop`, `panel`, `header`, `input`, `list`, `group`, `group-label`, `item`, `item-icon`, `item-label`, `item-description`, `item-meta`, `mark`, `badge`, `switch`, `kbd`, `empty`, `footer`.

## Keyboard

| Key | Action |
|---|---|
| ⌘K / Ctrl K | Open / close |
| ↑ ↓, Tab / Shift Tab | Move (wraps) |
| Enter | Select |
| ⌘ Enter / Ctrl Enter | Open link in a new tab |
| Esc | Close |

## Migrating an existing palette

Most hand-rolled palettes map directly:

- The `{ id, label, description, group, keywords, href, external, action }` objects stay as they are. Rename `action` to `perform` and turn `keywords` into a string or array.
- "Current page" / "active" markers become `active: true`.
- Settings toggles become `checked` items. They keep the palette open on their own.
- Items hidden until the user types (`kind === "setting"` filters) become `searchOnly: true`.
- Indented child rows become `indent: true`.
- Delete the keydown handler, the filtering, the grouping and the markup. The library does all of it.
- Custom open events like `slist:omnisearch-open` become `openOmnisearch()`.

## Development

```bash
bun install
bun run demo       # build + serve the demo at http://localhost:4173/demo/
bun test           # core + DOM (happy-dom) + React adapter
bun run typecheck
bun run build      # dist/: ESM, minified CDN build, .d.ts
bun run check      # all of the above
```

`dist/` is committed so the package installs from GitHub and serves from jsDelivr without a build. Rebuild before committing source changes. To release: bump `version`, update `CHANGELOG.md`, run `bun run check`, commit, then tag `vX.Y.Z` and push the tag.

## License

MIT
