#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
#
# After a stable `changeset version`, remove the prerelease sections of that
# version from every changesets-owned CHANGELOG.md.
#
# Pre mode never consolidates: promoting 0.12.0-beta.1 to 0.12.0 writes a
# `## 0.12.0` section that already lists every change, and leaves the
# `## 0.12.0-alpha.N` and `## 0.12.0-beta.N` sections below it, so each entry
# appears once per channel it passed through. The prerelease history stays in
# git and in the release tags.
#
# A prerelease version (one containing "-") leaves the file untouched, so the
# script is safe after every `changeset version`. Run through
# `npm run version-packages`.

set -eu

for dir in packages/* apps/dot-agent-cli; do
  log="$dir/CHANGELOG.md"
  [ -f "$log" ] && [ -f "$dir/package.json" ] || continue
  version=$(node -p "require('./$dir/package.json').version")
  case "$version" in *-*) continue ;; esac

  awk -v v="$version" '
    /^## / { skip = (index($0, "## " v "-") == 1) }
    !skip
  ' "$log" > "$log.tmp"
  mv "$log.tmp" "$log"
done
