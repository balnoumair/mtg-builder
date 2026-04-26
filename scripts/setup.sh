#!/bin/bash
set -e

pnpm install

# Run install scripts blocked by global ignore-scripts=true.
node node_modules/electron/install.js
node node_modules/esbuild/install.js

# Rebuild every native module that ships only source (binding.gyp, no prebuilt).
# better-sqlite3 is handled by electron-rebuild in scripts/release.sh, skip it here.
NATIVE_MODULES=(macos-alias fs-xattr)

for mod in "${NATIVE_MODULES[@]}"; do
  dir="node_modules/$mod"
  if [ -d "$dir" ] && [ -f "$dir/binding.gyp" ]; then
    echo "Rebuilding $mod..."
    (cd "$dir" && npx node-gyp rebuild)
  fi
done
