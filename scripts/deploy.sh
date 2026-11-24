#!/bin/bash
# Publish web/ to GitHub Pages (gh-pages branch), stamping a build id so installed home-screen copies update.
set -euo pipefail
cd "$(dirname "$0")/.."
BUILD=$(TZ=UTC git log -1 --format=%cd --date=format-local:%Y%m%d%H%M%S)   # build id follows the latest commit's time
URL=$(git remote get-url origin)
TMP=$(mktemp -d)
git clone -q -b gh-pages "$URL" "$TMP"
cp web/* "$TMP/"
sed -i '' "s/const BUILD = 'dev';/const BUILD = '$BUILD';/" "$TMP/index.html"
sed -i '' "s/const CACHE = 'sapper-v[0-9]*';/const CACHE = 'sapper-$BUILD';/" "$TMP/sw.js"
cd "$TMP" && git add -A && GIT_AUTHOR_DATE="$(cd - >/dev/null; git log -1 --format=%cI)" GIT_COMMITTER_DATE="$(cd - >/dev/null; git log -1 --format=%cI)" git commit -q -m "Publish" && git push -q origin gh-pages
echo "Published build $BUILD"
