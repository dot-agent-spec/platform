#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
#
# Print the npm dist-tag a release tag publishes under, from its version alone.
#
#   scripts/npm-dist-tag.sh <pkg>@<version>
#
#   0.12.0          -> latest
#   0.12.0-alpha.3  -> alpha
#   0.12.0-beta.0   -> beta
#
# Any other prerelease identifier exits 1 without printing a tag, so a version
# no channel is declared for fails before `npm publish` instead of landing on a
# dist-tag nobody reads. The identifier is what `changeset pre enter <tag>`
# was given, so the two channels below are the only ones to enter.
#
# Only the part after the last "@" is read: package names here contain hyphens
# themselves (tree-sitter, parser-dsl, language-server), so testing the whole
# ref for "-" would flag a stable release as a prerelease.

set -eu

ref="${1:?usage: npm-dist-tag.sh <pkg>@<version>}"
version="${ref##*@}"

case "$version" in
  *-*) ;;
  *) echo latest; exit 0 ;;
esac

channel="${version#*-}"
channel="${channel%%.*}"

case "$channel" in
  alpha|beta) echo "$channel" ;;
  *)
    echo "npm-dist-tag: $ref has prerelease identifier '$channel'; only alpha and beta are channels" >&2
    exit 1
    ;;
esac
