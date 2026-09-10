# Releasing Uplink

This project is prepared for the Obsidian Community directory. The root `manifest.json` and `versions.json` are the canonical release metadata. `plugin/` and `dist/uplink/` receive synchronized copies during a release build.

## Before the first submission

1. Push the repository to GitHub and make it public.
2. Confirm that the root `README.md`, `LICENSE`, `manifest.json`, and `versions.json` are committed.
3. Review the network and credential disclosures in `README.md`, the attribution in `NOTICE`, and the [Obsidian developer policies](https://docs.obsidian.md/community-directory/developer-policies).
4. Test on desktop and mobile according to [TESTING.md](TESTING.md). Use a non-production Bucket or prefix for migration tests.

## Create a release

1. Update the version in root `manifest.json` and add the matching minimum app version to root `versions.json`.
2. Run the local release checks:

   ```bash
   node scripts/sync-release-metadata.mjs
   npm ci --prefix plugin
   npm run test --prefix plugin
   npm run build --prefix plugin
   node scripts/package.mjs
   node scripts/verify-release.mjs
   ```

3. Commit and push the metadata, source, and documentation changes.
4. Create and push an annotated Git tag that exactly matches `manifest.json`'s version, for example:

   ```bash
   git tag -a 1.0.0 -m "Uplink 1.0.0"
   git push origin 1.0.0
   ```

The GitHub Actions release workflow verifies that the tag matches the manifest and uploads `main.js`, `manifest.json`, and `styles.css` from `dist/uplink/` as individual GitHub Release assets.

## Submit to the directory

1. Sign in at [community.obsidian.md](https://community.obsidian.md) with an Obsidian account.
2. Connect the GitHub account that owns `wellzhi/uplink`.
3. Submit the plugin with repository URL `https://github.com/wellzhi/uplink` and accept the developer policies.
4. Address any scanner or reviewer feedback in the directory before publishing another release.

Only the initial version needs directory review. Later updates are delivered by publishing a GitHub Release whose tag exactly matches the new manifest version.
