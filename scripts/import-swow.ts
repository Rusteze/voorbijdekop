import path from "node:path";
import { importSwowToAssociationsCache } from "./associations-cache.js";

async function main() {
  const repoRoot = path.resolve(".");
  const argPath = process.argv[2];
  const sourceFile =
    argPath && argPath.trim()
      ? path.isAbsolute(argPath)
        ? argPath
        : path.join(repoRoot, argPath)
      : path.join(repoRoot, "data", "swow-nl.csv");

  const result = await importSwowToAssociationsCache(repoRoot, sourceFile);
  console.log("[swow-import] klaar", {
    sourceFile,
    importedWords: result.importedWords,
    mergedWords: result.mergedWords
  });
}

main().catch((e) => {
  console.error("[swow-import] fout", e);
  process.exit(1);
});

