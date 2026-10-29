#!/usr/bin/env bash
# Pull shared content folders from their owner repos (see sync.json).
#   scripts/sync-shared.sh           copy latest owner content, record commits
#   scripts/sync-shared.sh --check   verify content/ matches the recorded commits
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="${1:-sync}"
STATE=content/.sync-state.json
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
URL_BASE="${SYNC_URL_BASE:-https://github.com}"
n=$(node -p "require('./sync.json').sources.length")
state='{}'
for i in $(seq 0 $((n-1))); do
  repo=$(node -p "require('./sync.json').sources[$i].repo")
  ref=$(node -p "require('./sync.json').sources[$i].ref")
  folders=$(node -p "require('./sync.json').sources[$i].folders.join(' ')")
  dir="$TMP/$i"
  if [ "$MODE" = "--check" ]; then
    ref=$(node -p "(require('./$STATE')['$repo']||{}).commit||'$ref'")
    git clone -q "$URL_BASE/$repo.git" "$dir"; git -C "$dir" checkout -q "$ref"
  else
    git clone -q --depth 1 --branch "$ref" "$URL_BASE/$repo.git" "$dir"
  fi
  commit=$(git -C "$dir" rev-parse HEAD)
  for f in $folders; do
    [ -d "$dir/content/$f" ] || { echo "owner $repo has no content/$f" >&2; exit 1; }
    if [ "$MODE" = "--check" ]; then
      diff -r -q "$dir/content/$f" "content/$f" >/dev/null || { echo "DRIFT: content/$f differs from $repo@${commit:0:7}. Edit it in $repo, not here." >&2; bad=1; }
    else
      rm -rf "content/$f"; cp -r "$dir/content/$f" "content/$f"
    fi
  done
  state=$(REPO="$repo" COMMIT="$commit" S="$state" node -e 'const s=JSON.parse(process.env.S);s[process.env.REPO]={commit:process.env.COMMIT};console.log(JSON.stringify(s))')
done
[ "${bad:-0}" = 1 ] && exit 1
if [ "$MODE" != "--check" ]; then echo "$state" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.stringify(JSON.parse(d),null,2)))' > "$STATE"; fi
echo "ok"
