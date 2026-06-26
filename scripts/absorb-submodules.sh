#!/usr/bin/env bash
# DA00-05: Absorb all former submodules into the monorepo with full git history.
# Run from the root of dot-agent-spec.
# Requires: git filter-repo (brew install git-filter-repo)
#
# Usage: bash scripts/absorb-submodules.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="/tmp/monorepo-import"

mkdir -p "$TMP_DIR"

# ── repos to absorb in dependency order ───────────────────────────────────────
# format: "path|remote|branch"
REPOS=(
  "packages/tree-sitter|git@github.com:dot-agent-spec/tree-sitter.git|main"
  "packages/parser-dsl|git@github.com:dot-agent-spec/parser-dsl.git|main"
  "packages/kernel-dsl|git@github.com:dot-agent-spec/kernel-dsl.git|main"
  "packages/compiler|git@github.com:dot-agent-spec/compiler.git|main"
  "packages/language-server|git@github.com:dot-agent-spec/language-server.git|main"
  "packages/sdk|git@github.com:dot-agent-spec/sdk.git|main"
  "apps/dot-agent-cli|git@github.com:dot-agent-spec/dot-agent-cli.git|main"
  "apps/vscode-extension|git@github.com:dot-agent-spec/vscode-dot-agent.git|main"
)

for entry in "${REPOS[@]}"; do
  SUBPATH="${entry%%|*}"
  rest="${entry#*|}"
  REMOTE="${rest%%|*}"
  BRANCH="${rest##*|}"
  NAME="${SUBPATH//\//-}"

  CLONE_DIR="$TMP_DIR/$NAME"

  echo ""
  echo "══════════════════════════════════════════════"
  echo "  Absorbing: $SUBPATH"
  echo "  Remote:    $REMOTE"
  echo "══════════════════════════════════════════════"

  # 1. Clone (or reuse if already cloned)
  if [ -d "$CLONE_DIR" ]; then
    echo "  → reusing existing clone at $CLONE_DIR"
  else
    echo "  → cloning..."
    git clone "$REMOTE" "$CLONE_DIR"
  fi

  # 2. Rewrite history to place all commits under SUBPATH
  echo "  → rewriting history with prefix '$SUBPATH'..."
  git -C "$CLONE_DIR" filter-repo --to-subdirectory-filter "$SUBPATH" --force

  # 3. Add as temporary remote, fetch, merge
  REMOTE_NAME="import-$NAME"
  echo "  → merging into monorepo..."
  cd "$ROOT"
  git remote add "$REMOTE_NAME" "$CLONE_DIR"
  git fetch "$REMOTE_NAME"
  git merge --allow-unrelated-histories "$REMOTE_NAME/$BRANCH" \
    -m "chore: absorb $SUBPATH into monorepo with full history (DA00-05)"

  # 4. Clean up temporary remote
  git remote remove "$REMOTE_NAME"

  echo "  ✓ $SUBPATH absorbed"
done

echo ""
echo "══════════════════════════════════════════════"
echo "  All packages absorbed. Run next:"
echo "    Phase 3: fix vscode-extension deps"
echo "    Phase 3: npm install && cargo build"
echo "══════════════════════════════════════════════"
