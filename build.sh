#!/usr/bin/env bash
set -euo pipefail

repository_dir="$(cd "$(dirname "$0")" && pwd)"
node "$repository_dir/scripts/sync-release-metadata.mjs"
cd "$repository_dir/plugin"
npm ci
npm run build
node "$repository_dir/scripts/package.mjs"
node "$repository_dir/scripts/verify-release.mjs"

if [[ $# -gt 0 ]]; then
  node "$repository_dir/scripts/install-to-vault.mjs" "$1"
fi
