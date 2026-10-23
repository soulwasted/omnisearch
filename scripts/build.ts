// Builds dist/: ESM bundles, a minified CDN build and type declarations.
import { rm } from "node:fs/promises";
import type { BunPlugin } from "bun";

await rm("dist", { recursive: true, force: true });

async function build(config: Parameters<typeof Bun.build>[0]): Promise<void> {
  const result = await Bun.build({ target: "browser", format: "esm", ...config });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
}

await build({ entrypoints: ["src/index.ts"], outdir: "dist" });
await build({ entrypoints: ["src/index.ts"], outdir: "dist", naming: "omnisearch.min.js", minify: true });
// The React adapter keeps importing "./index.js" (dist/index.js) instead of inlining the
// core, so apps that use both entries share one copy of it.
const coreAsSibling: BunPlugin = {
  name: "core-as-sibling",
  setup(builder) {
    builder.onResolve({ filter: /^\.\/index\.js$/ }, () => ({ path: "./index.js", external: true }));
  },
};
await build({
  entrypoints: ["src/react.ts"],
  outdir: "dist",
  external: ["react"],
  plugins: [coreAsSibling],
  banner: '"use client";',
});

const tsc = Bun.spawnSync(["bunx", "tsc", "-p", "tsconfig.build.json"], { stdout: "inherit", stderr: "inherit" });
if (tsc.exitCode !== 0) process.exit(tsc.exitCode ?? 1);

console.log("Built dist/");
