// Serves the repo root so demo/index.html can load ../dist. Usage: bun run demo
import { join, normalize } from "node:path";

const root = join(import.meta.dir, "..");
const port = Number(process.env.PORT ?? 4173);

Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/") return Response.redirect("/demo/", 302);
    const path = normalize(join(root, pathname.endsWith("/") ? `${pathname}index.html` : pathname));
    if (!path.startsWith(root)) return new Response("Forbidden", { status: 403 });
    const file = Bun.file(path);
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
  },
});

console.log(`Demo: http://localhost:${port}/demo/`);
