# Omnisearch

Cmd+K command palette library, consumed by other projects straight from GitHub (`github:soulwasted/omnisearch#vX.Y.Z`) or jsDelivr.

- Code, comments and docs are in English.
- Runtime stays dependency-free. React is an optional peer, used only by `src/react.ts`.
- `src/core/` is pure logic (no DOM). `src/dom/` owns the UI, rendered inside a shadow root. `src/react.ts` wraps the controller and imports the core by package name (`@soulwasted/omnisearch`, mapped to `src/index.ts` via tsconfig `paths`), so apps never bundle two copies.
- Never add `"sideEffects": false` to package.json: Bun 1.3 then tree-shakes the package's own entry into an empty bundle.
- `dist/` is committed. Run `bun run check` (typecheck, tests, build) and commit `dist/` together with source changes.
- Public API changes go into README.md (options, item fields, tokens, parts) and CHANGELOG.md.
- Demo: `bun run demo` → http://localhost:4173/demo/ (also in `.claude/launch.json` as `demo`).
