#!/usr/bin/env sh
#
# Apache 2.0 license headers for first-party source files.
#
#   ./scripts/ensure-license-headers.sh            fix in place (local use)
#   ./scripts/ensure-license-headers.sh --check     report and exit 1 (CI use)
#
# Run from the repository root. File discovery uses `git ls-files`, so build
# output, node_modules and anything untracked are excluded for free — the
# previous version used `find` with `./dist/*`-style prefixes that only matched
# when it ran from a package root, and silently scanned everything once the
# repository was flattened into a monorepo.

set -eu

MODE="fix"
[ "${1:-}" = "--check" ] && MODE="check"

HEADER='// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.'

# Excluded, and why each one matters:
#
#   tools/wasi-stub/  Third-party code (Arnaud Golfouse, typst-community/
#                     wasm-minimal-protocol), vendored and patched. Stamping our
#                     copyright on it would misattribute someone else's work.
#   */pkg/            wasm-bindgen output.
#   */bindings/       ts-rs output.
#   generated-*       Written by a generator; a hand-added header is lost on the
#                     next run.
is_excluded() {
  case "$1" in
    tools/wasi-stub/*)          return 0 ;;
    */pkg/*|pkg/*)              return 0 ;;
    */bindings/*|bindings/*)    return 0 ;;
    */generated-*|generated-*)  return 0 ;;
    *) return 1 ;;
  esac
}

missing=""
count=0

for file in $(git ls-files '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.rs'); do
  is_excluded "$file" && continue
  [ -f "$file" ] || continue

  if head -20 "$file" | grep -q "Licensed under the Apache License"; then
    continue
  fi

  count=$((count + 1))
  missing="$missing$file
"

  [ "$MODE" = "check" ] && continue

  if head -1 "$file" | grep -q "^#!"; then
    shebang=$(head -1 "$file")
    rest=$(tail -n +2 "$file")
    {
      echo "$shebang"
      echo ""
      echo "$HEADER"
      echo ""
      echo "$rest"
    } > "$file.tmp"
    mv "$file.tmp" "$file"
  else
    {
      echo "$HEADER"
      echo ""
      cat "$file"
    } > "$file.tmp"
    mv "$file.tmp" "$file"
  fi
done

if [ "$count" -eq 0 ]; then
  echo "All first-party source files carry the Apache 2.0 header."
  exit 0
fi

if [ "$MODE" = "check" ]; then
  echo "Missing the Apache 2.0 license header ($count file(s)):"
  echo ""
  printf '%s' "$missing" | sed 's/^/  /'
  echo ""
  echo "Fix with:  ./scripts/ensure-license-headers.sh"
  exit 1
fi

echo "Added the Apache 2.0 header to $count file(s):"
printf '%s' "$missing" | sed 's/^/  /'
