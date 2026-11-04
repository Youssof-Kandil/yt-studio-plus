#!/usr/bin/env sh
# Packages the extension into dist/studio-plus-<version>.zip (macOS / Linux / CI).
set -e
cd "$(dirname "$0")/.."
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -n 1)
mkdir -p dist
OUT="dist/studio-plus-$VERSION.zip"
rm -f "$OUT"
zip -q -X "$OUT" \
  manifest.json inject.js background.js \
  core.js panel.js templates.js likes.js compare.js content.css \
  icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png
echo "Built $OUT"
