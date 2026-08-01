#!/usr/bin/env bash
#
# Copyright (c) 2026 dot-agent Authors
# Licensed under the Apache-2.0 license — see LICENSE.
#
# Asserts that this repository's LICENSE really is Apache-2.0, and not something that reads like it.
#
# Nothing else checks this. A LICENSE is written once, never reviewed again, and a paraphrase of it — a
# reworded definition, a patent clause rewritten, a sentence of another license spliced into the middle —
# looks completely normal in a diff and leaves the repository not licensed the way it claims. That has
# happened; this check is the reason it cannot happen twice.
#
# The comparison ignores the copyright holder and any rewrapping, and forgives nothing else: the text is
# cut at the license's own "how to apply" section (Apache's appendix, the GPL family's "How to Apply These
# Terms"), standalone `Copyright ...` lines are dropped, whitespace is collapsed, and the result must hash
# to the pinned digest below. No network, no dependencies.
#
#   bash scripts/verify-license-text.sh
#
# If it fails, do not edit LICENSE by hand and do not write the text from memory. Fetch it:
#   curl -fsSL https://www.apache.org/licenses/LICENSE-2.0.txt -o LICENSE
# then re-apply this repo's copyright line in the appendix and run this check again.

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$(dirname "$0")")"

# Local divergence from the vibe-ops template, which pins one digest for one file.
# This is a monorepo: eleven license files, ten Apache-2.0 and one MIT (the scaffold
# the CLI copies into a user's project). Guarding only the root would have left ten
# unchecked, which is how the paraphrase survived here in the first place. So the
# expected digest is an optional second argument; both values come from the plugin's
# licenses/SOURCES.tsv registry, never typed from memory.
EXPECTED="${2:-59d8f0ba87ad9a2f1a431123c8d16646e5b89ba53653e818f16d136d77263c99}"
FILE="${1:-LICENSE}"
# Name the license the digest actually belongs to, so a passing line cannot claim the
# wrong one. Reporting "is Apache-2.0" over a correctly-verified MIT file would be a
# check that misleads while it passes.
case "$EXPECTED" in
  59d8f0ba*) LICENSE_ID='Apache-2.0' ;;
  7c9b48b5*) LICENSE_ID='MIT' ;;
  *)         LICENSE_ID='the expected license' ;;
esac

[ -f "$FILE" ] || { echo "verify-license-text: $FILE is missing — this repository claims $LICENSE_ID and ships no license" >&2; exit 1; }

if command -v sha256sum >/dev/null 2>&1; then sha() { sha256sum | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then sha() { shasum -a 256 | cut -d' ' -f1; }
else echo "verify-license-text: no sha256sum/shasum available" >&2; exit 2; fi

GOT="$(awk '/^[[:space:]]*(APPENDIX:|How to Apply These Terms to Your New Programs)/{exit} {print}' "$FILE" \
       | sed -E '/^[[:space:]]*Copyright[[:space:]]/d' \
       | tr -s '[:space:]' ' ' | sed -e 's/^ //' -e 's/ $//' | sha)"

if [ "$GOT" != "$EXPECTED" ]; then
  cat >&2 <<MSG
verify-license-text: $FILE is NOT the $LICENSE_ID text.
  expected $EXPECTED
  got      $GOT
The operative text differs from the official license. Replace the file with the official text from
https://www.apache.org/licenses/LICENSE-2.0.txt — keep only this repository's own copyright line.
MSG
  exit 1
fi

echo "verify-license-text: $FILE is $LICENSE_ID ✓"
