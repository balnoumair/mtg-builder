#!/bin/bash
set -e

pnpm install

# Run install scripts blocked by global ignore-scripts=true.
node node_modules/electron/install.js
node node_modules/esbuild/install.js

# better-sqlite3 needs no rebuild: it ships Node-API prebuilts, which load
# unchanged under both Electron and system Node.

# Rebuild every native module that ships only source (binding.gyp, no prebuilt).
NATIVE_MODULES=(macos-alias fs-xattr)

for mod in "${NATIVE_MODULES[@]}"; do
  dir="node_modules/$mod"
  if [ -d "$dir" ] && [ -f "$dir/binding.gyp" ]; then
    echo "Rebuilding $mod..."
    (cd "$dir" && npx node-gyp rebuild)
  fi
done
