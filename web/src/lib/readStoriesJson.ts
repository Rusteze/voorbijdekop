import fs from "node:fs";
import path from "node:path";

/**
 * Zoekt stories.json op plekken die matchen met de build-pipeline:
 * - Cloudflare / npm --prefix web: cwd is meestal `web/` → `public/data/stories.json`
 * - Monorepo-root data: `../data/generated/stories.json` vanaf `web/`
 * - Soms next vanaf repo-root: `data/generated/stories.json`
 */
export function resolveStoriesJsonPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "data", "stories.json"),
    path.join(process.cwd(), "data", "generated", "stories.json"),
    path.join(process.cwd(), "..", "data", "generated", "stories.json")
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function readStoriesJsonRaw(): string {
  const found = resolveStoriesJsonPath();
  if (!found) return "[]";
  return fs.readFileSync(found, "utf8");
}
