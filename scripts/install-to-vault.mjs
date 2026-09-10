import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { distributionFiles, legacyPluginIds } from "./project.mjs";

const [vaultPath] = process.argv.slice(2);

if (!vaultPath) {
  throw new Error("Usage: node scripts/install-to-vault.mjs <path-to-obsidian-vault>");
}

const repositoryRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(join(repositoryRoot, "plugin", "manifest.json"), "utf8"));
const vaultDirectory = resolve(vaultPath);
const pluginDirectory = join(vaultDirectory, ".obsidian", "plugins", manifest.id);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function updateJson(filePath, update) {
  const current = JSON.parse(await readFile(filePath, "utf8"));
  const next = update(current);
  if (next === current) return false;
  const temporaryPath = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`);
  await rename(temporaryPath, filePath);
  return true;
}

await mkdir(pluginDirectory, { recursive: true });

const dataPath = join(pluginDirectory, "data.json");
if (!(await exists(dataPath))) {
  for (const legacyPluginId of legacyPluginIds) {
    const legacyDataPath = join(vaultDirectory, ".obsidian", "plugins", legacyPluginId, "data.json");
    if (await exists(legacyDataPath)) {
      await copyFile(legacyDataPath, dataPath);
      console.log(`Migrated settings from ${legacyPluginId}.`);
      break;
    }
  }
}

for (const relativePath of distributionFiles) {
  await copyFile(join(repositoryRoot, relativePath), join(pluginDirectory, basename(relativePath)));
}

const communityPluginsPath = join(vaultDirectory, ".obsidian", "community-plugins.json");
await updateJson(communityPluginsPath, (enabledPluginIds) => {
  if (!Array.isArray(enabledPluginIds)) {
    throw new Error(`${communityPluginsPath} must contain a JSON array.`);
  }
  const migratedIds = enabledPluginIds.map((pluginId) => legacyPluginIds.includes(pluginId) ? manifest.id : pluginId);
  if (!migratedIds.includes(manifest.id)) migratedIds.push(manifest.id);
  const uniqueIds = [...new Set(migratedIds)];
  return JSON.stringify(uniqueIds) === JSON.stringify(enabledPluginIds) ? enabledPluginIds : uniqueIds;
});

// Lazy Loader persists its own startup policy and calls disablePluginAndSave for
// entries marked "disabled", which otherwise removes this plugin from
// community-plugins.json on every restart.
const lazyLoaderSettingsPath = join(vaultDirectory, ".obsidian", "plugins", "lazy-plugins", "data.json");
try {
  const changed = await updateJson(lazyLoaderSettingsPath, (settings) => {
    let nextSettings = settings;
    for (const device of ["desktop", "mobile"]) {
      const plugins = settings?.[device]?.plugins;
      if (!plugins) continue;

      const legacyPolicy = legacyPluginIds
        .map((pluginId) => plugins[pluginId]?.startupType)
        .find(Boolean);
      const startupType = plugins[manifest.id]?.startupType || legacyPolicy || "instant";
      const nextPlugins = { ...plugins, [manifest.id]: { ...plugins[manifest.id], startupType: startupType === "disabled" ? "instant" : startupType } };
      for (const legacyPluginId of legacyPluginIds) delete nextPlugins[legacyPluginId];

      if (JSON.stringify(nextPlugins) !== JSON.stringify(plugins)) {
        nextSettings = {
          ...nextSettings,
          [device]: {
            ...nextSettings[device],
            plugins: nextPlugins
          }
        };
      }
    }
    return nextSettings;
  });
  if (changed) console.log("Migrated Lazy Loader startup policy.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

for (const legacyPluginId of legacyPluginIds) {
  await rm(join(vaultDirectory, ".obsidian", "plugins", legacyPluginId), { recursive: true, force: true });
}

console.log(`Installed ${manifest.name} to ${pluginDirectory}.`);
