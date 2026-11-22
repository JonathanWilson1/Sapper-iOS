#!/bin/bash
# Publish web/ to GitHub Pages (gh-pages branch), stamping a build id so installed home-screen copies update.
set -euo pipefail
cd "$(dirname "$0")/.."
BUILD=$(date -u +%Y%m%d%H%M%S)
URL=$(git remote get-url origin)
TMP=$(mktemp -d)
git clone -q -b gh-pages "$URL" "$TMP"
cp web/* "$TMP/"
sed -i '' "s/const BUILD = 'dev';/const BUILD = '$BUILD';/" "$TMP/index.html"
sed -i '' "s/const CACHE = 'sapper-v[0-9]*';/const CACHE = 'sapper-$BUILD';/" "$TMP/sw.js"
cd "$TMP" && git add -A && git commit -q -m "Publish build $BUILD" && git push -q origin gh-pages
echo "Published build $BUILD"
