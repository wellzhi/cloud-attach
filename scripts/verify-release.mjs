import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const tag = process.argv[2];
const metadataFiles = ["manifest.json", "versions.json"];

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(repositoryRoot, relativePath), "utf8"));
}

function fail(message) {
  throw new Error(`Release verification failed: ${message}`);
}

const [manifest, versions] = await Promise.all(metadataFiles.map(readJson));
const requiredManifestFields = ["id", "name", "version", "minAppVersion", "description", "author", "isDesktopOnly"];

for (const field of requiredManifestFields) {
  if (!(field in manifest)) fail(`root manifest.json is missing ${field}.`);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.id)) fail("manifest id must use lowercase letters, digits, and hyphens.");
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail("manifest version must use x.y.z semantic versioning.");
if (!/^\d+\.\d+\.\d+$/.test(manifest.minAppVersion)) fail("manifest minAppVersion must use x.y.z semantic versioning.");
if (typeof manifest.description !== "string" || manifest.description.length > 250 || !manifest.description.endsWith(".")) {
  fail("manifest description must be at most 250 characters and end with a period.");
}
if (versions[manifest.version] !== manifest.minAppVersion) {
  fail(`versions.json must map ${manifest.version} to ${manifest.minAppVersion}.`);
}
if (tag && tag !== manifest.version) fail(`Git tag ${tag} does not match manifest version ${manifest.version}.`);

for (const filename of metadataFiles) {
  const expected = await readJson(filename);
  for (const directory of ["plugin", "dist/cloud-attach"]) {
    const actual = await readJson(`${directory}/${filename}`);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${directory}/${filename} does not match root ${filename}.`);
  }
}

for (const relativePath of ["README.md", "LICENSE", "dist/cloud-attach/main.js", "dist/cloud-attach/styles.css"]) {
  try {
    await access(join(repositoryRoot, relativePath));
  } catch {
    fail(`required file is missing: ${relativePath}.`);
  }
}

console.log(`Release metadata verified for CloudAttach ${manifest.version}.`);
