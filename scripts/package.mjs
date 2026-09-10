import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { distributionFiles, legacyPluginIds } from "./project.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(join(repositoryRoot, "plugin", "manifest.json"), "utf8"));
const distributionRoot = join(repositoryRoot, "dist");
const outputDirectory = join(distributionRoot, manifest.id);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const relativePath of distributionFiles) {
  await copyFile(join(repositoryRoot, relativePath), join(outputDirectory, basename(relativePath)));
}

for (const legacyPluginId of legacyPluginIds) {
  await rm(join(distributionRoot, legacyPluginId), { recursive: true, force: true });
}

console.log(`Packaged ${manifest.name} in ${outputDirectory}.`);
