# Changelog

## 0.1.1 — 2026-10-23

- Fixed: apps bundled with Bun pulled a second copy of the core through the React adapter (the repo's tsconfig `paths` leaked into git installs). The adapter now imports `./index.js` directly.
- Fixed: relative imports in `.d.ts` files now carry `.js` extensions, so types work under `moduleResolution: node16/nodenext`.

## 0.1.0 — 2026-10-23

First release.

- Framework-agnostic `createOmnisearch()` with a shadow-DOM UI, `--omni-*` tokens and `::part()` styling.
- React adapter at `@soulwasted/omnisearch/react` (`"use client"`, shares the core with the vanilla entry).
- Diacritics-insensitive, multi-term ranked search with initials matching and highlights.
- Items: links, actions, toggles (`checked`), current badges, shortcuts, search-only, disabled and indented rows.
- Async sources with debounce and abort, recent history, automatic light/dark following the page.
- Hotkeys (`mod+k` by default, configurable), `[data-omnisearch-open]` triggers and `openOmnisearch()`.
