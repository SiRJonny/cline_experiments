#!/usr/bin/env bash
# Publish the viewer to the `gh-pages` branch (branch based GitHub Pages).
#
#   bash budapest-bus/tools/publish-gh-pages.sh
#
# The branch is a flat copy of this folder, so GitHub Pages serves the viewer at
# https://<owner>.github.io/<repo>/ with no build step on the GitHub side.
# Enable it once under Settings -> Pages -> Deploy from a branch -> gh-pages /(root).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
project_dir="$repo_root/budapest-bus"
worktree="$(mktemp -d)"
msg="${1:-Publish the procedural BKV bus viewer as a GitHub Pages site}"

cd "$repo_root"

echo "==> regenerating textures and the exported mesh"
node "$project_dir/tools/build-assets.mjs" > /dev/null

echo "==> staging the site in $worktree"
git worktree add --detach "$worktree" > /dev/null
cd "$worktree"
git checkout --orphan gh-pages > /dev/null 2>&1 || git checkout gh-pages
git rm -rf -q . || true
# runtime files only: the viewer, vendored three.js, painted textures, previews
cp -r "$project_dir/index.html" "$project_dir/README.md" "$project_dir/src" \
      "$project_dir/assets" "$project_dir/preview" "$project_dir/vendor" "$project_dir/docs" .
# Jekyll would otherwise drop vendor/ (it is excluded by default)
touch .nojekyll

git add -A
git -c user.email="$(git -C "$repo_root" config user.email)" \
    -c user.name="$(git -C "$repo_root" config user.name)" \
    commit -q -m "$msg"
git push origin gh-pages

cd "$repo_root"
git worktree remove --force "$worktree"
echo "==> published; https://<owner>.github.io/<repo>/ once Pages points at gh-pages"
