import fs from "node:fs/promises";
import path from "node:path";

export const EDITORIAL_KINDS = ["book", "film", "podcast", "series", "link"] as const;
export type EditorialKind = (typeof EDITORIAL_KINDS)[number];

export type EditorialPickValidated =
  | { enabled: false }
  | {
      enabled: true;
      title: string;
      dek: string;
      kind: EditorialKind;
      label: string;
      href: string;
      imageUrl?: string;
      updatedAt?: string;
      external: boolean;
    };

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

export function validateEditorialPick(raw: unknown): EditorialPickValidated {
  if (raw === null || typeof raw !== "object") {
    throw new Error("[editorial-pick] root moet een object zijn");
  }
  const o = raw as Record<string, unknown>;
  const enabled = o.enabled === true;

  if (!enabled) {
    return { enabled: false };
  }

  if (!isNonEmptyString(o.title)) {
    throw new Error("[editorial-pick] bij enabled=true is title verplicht (niet-leeg)");
  }
  if (typeof o.dek !== "string") {
    throw new Error("[editorial-pick] dek moet een string zijn");
  }
  if (!EDITORIAL_KINDS.includes(o.kind as EditorialKind)) {
    throw new Error(`[editorial-pick] kind moet een van: ${EDITORIAL_KINDS.join(", ")}`);
  }
  if (!isNonEmptyString(o.href)) {
    throw new Error("[editorial-pick] href is verplicht (niet-leeg)");
  }
  const href = o.href.trim();
  if (!href.startsWith("/") && !/^https?:\/\//i.test(href)) {
    throw new Error("[editorial-pick] href moet met / of http(s):// beginnen");
  }

  const external =
    typeof o.external === "boolean" ? o.external : /^https?:\/\//i.test(href);

  const label = typeof o.label === "string" ? o.label.trim() : "";
  const imageUrl = typeof o.imageUrl === "string" && o.imageUrl.trim() ? o.imageUrl.trim() : undefined;
  const updatedAt = typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : undefined;

  return {
    enabled: true,
    title: o.title.trim(),
    dek: o.dek.trim(),
    kind: o.kind as EditorialKind,
    label,
    href,
    imageUrl,
    updatedAt,
    external
  };
}

/** Leest `data/editorial-pick.json`; ontbreekt het bestand → `{ enabled: false }`. */
export async function readEditorialPickFromRepo(repoRoot: string): Promise<EditorialPickValidated> {
  const filePath = path.join(repoRoot, "data", "editorial-pick.json");
  try {
    const rawText = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(rawText) as unknown;
    return validateEditorialPick(parsed);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn("[editorial-pick] geen data/editorial-pick.json — schrijf { enabled: false }");
      return { enabled: false };
    }
    throw e;
  }
}
