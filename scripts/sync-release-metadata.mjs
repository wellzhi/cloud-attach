import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const metadataFiles = ["manifest.json", "versions.json"];

for (const filename of metadataFiles) {
  const sourcePath = join(repositoryRoot, filename);
  const targetPath = join(repositoryRoot, "plugin", filename);
  const source = await readFile(sourcePath, "utf8");

  JSON.parse(source);
  await writeFile(targetPath, source);
}

console.log("Synchronized release metadata to plugin/.");
