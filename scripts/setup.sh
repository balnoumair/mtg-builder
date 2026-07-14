#!/bin/bash
set -e

pnpm install

# Run install scripts blocked by global ignore-scripts=true.
node node_modules/electron/install.js
node node_modules/esbuild/install.js

# pnpm install fetches better-sqlite3's prebuilt binary for system Node's ABI,
# not Electron's, so `pnpm start` fails to load it until it's rebuilt here too.
pnpm exec electron-rebuild -f -w better-sqlite3

# Rebuild every native module that ships only source (binding.gyp, no prebuilt).
NATIVE_MODULES=(macos-alias fs-xattr)

for mod in "${NATIVE_MODULES[@]}"; do
  dir="node_modules/$mod"
  if [ -d "$dir" ] && [ -f "$dir/binding.gyp" ]; then
    echo "Rebuilding $mod..."
    (cd "$dir" && npx node-gyp rebuild)
  fi
done
