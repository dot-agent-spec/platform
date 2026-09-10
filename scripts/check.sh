#!/usr/bin/env bash
# check.sh — the canonical way to run this repository's full governance gate by hand.
#
# It is what .githooks/pre-commit runs, so this gives the identical result without committing. The one
# difference is reporting: a clean run still prints its summary lines here, because this run was *asked
# for* and whoever typed the command is owed an answer. The hook was not asked for and says nothing.
#
# WHAT THIS USED TO BE. Until 2026-08-13 this sourced scripts/checks/_run.sh, which resolved a shell
# runner through three fallbacks and then asserted that this repository's own fragments had actually
# composed into it — because a bare invocation silently omitted them and still reported "0 failed". None
# of that applies to an ops, which declares the gates it composes. The three-branch resolution is also
# what broke, when the runner moved inside vibe-ops and all three branches pointed at the same vanished
# directory.
#
# `vibe-ops` is resolved from PATH. A machine without it gets a loud failure rather than a silent pass,
# which is the plugin's stated contract for its CLI, not an accident of this script.
set -uo pipefail

if ! command -v vibe-ops >/dev/null 2>&1; then
  echo "check.sh: vibe-ops is not on PATH — the gate cannot run." >&2
  echo "From a vibe-ops checkout: npm install && npm run build && npm link -w @entelekheia/vibe-ops-cli" >&2
  exit 2
fi

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT" || exit 2

# NO VIBE_OPS_DISABLED_CHECKS HERE, AND THAT IS RECENT. Until 2026-08-13 this file and .githooks/pre-commit
# each exported it, because `module-check` spawned the shell fragments with only GATE_VERBOSE and read no
# config at all. That put the declaration in two shell scripts and nowhere a different caller could see
# it — a session hook running `vibe-ops check` directly reported 38 failures this repository had already
# decided about. `module-check` now translates `settings.check.disabled` into that variable itself, so
# the ledger lives once, in vibeops.config.ts, and every caller reads the same one.
#
# The variable still works and still wins when a caller sets it, which is the right precedence: a
# declaration made at the point of invocation is narrower than one committed to the repository.

# --no-warnings suppresses MODULE_TYPELESS_PACKAGE_JSON, which Node prints once per invocation because
# vibeops.config.ts is ESM in a package with no "type": "module". Three ops means three copies of a
# four-line warning about a file that loads correctly. Adding "type": "module" to the root package.json
# would silence it at the source and change module resolution for every workspace — not worth it.
export NODE_OPTIONS="${NODE_OPTIONS:-} --no-warnings"

# `check` is the seventeen fragments. Two of them are declared off above, and ten skip in this repository
# because they check a plugin's surfaces; what it uniquely contributes here is `private-names` and
# `machine-paths`, neither of which has a port yet. `agents-md` and `governance` are the ported gates.
RC=0
# `agents-md` is BOTH a module noun and an ops id, and the module wins the dispatch — `vibe-ops agents-md`
# refuses for want of a subcommand and exits 2, which this loop then propagates. The full specifier is
# unambiguous. Same repair as `.githooks/pre-commit`; filed as entelekheia-ai/vibe-ops#28.
for ops in check @entelekheia/vibe-ops-agents-md governance; do
  if [ "${GATE_VERBOSE:-}" = "1" ]; then
    vibe-ops "$ops" --verbose || RC=$?
  else
    OUT=$(vibe-ops "$ops" 2>&1) || RC=$?
    # Only what asks a reader to act, plus the summary this run was asked for.
    printf '%s\n' "$OUT" | grep -E '^(FAIL|WARN) |^(■|◆) ' || true
  fi
done

exit "$RC"
