import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getDistDir(): string {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  // When running from dist/, thisDir is dist/
  // When running from src/ via tsx, thisDir is src/
  if (path.basename(thisDir) === "dist") {
    return thisDir;
  }
  return path.resolve(thisDir, "..", "dist");
}

/** The built card viewer, read from dist/. */
export function readCardViewerHtml(): Promise<string> {
  return fs.readFile(path.join(getDistDir(), "card-viewer.html"), "utf-8");
}
