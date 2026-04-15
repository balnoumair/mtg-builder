#!/bin/bash
set -e

VERSION=$(node -p "require('./package.json').version")

echo "Building v$VERSION..."
pnpm make

echo "Creating GitHub release v$VERSION..."
gh release create "v$VERSION" out/make/zip/darwin/arm64/*.zip \
  --title "v$VERSION" \
  --notes ""

echo "Done! https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/v$VERSION"
