#!/usr/bin/env bash
# Bump the version triple (app.js, index.html, sw.js) by one.
set -euo pipefail
cd "$(dirname "$0")/.."
cur=$(grep -oE "sacredtexts-v[0-9]+" sw.js | head -1 | grep -oE "[0-9]+")
new=$((cur+1))
sed -i -E "s/sacredtexts-v$cur/sacredtexts-v$new/" sw.js
sed -i -E "s/(APP_VERSION = '?v)$cur/\1$new/" app.js
sed -i -E "s/(name=\"app-version\" content=\"v)$cur/\1$new/" index.html
echo "v$new"
