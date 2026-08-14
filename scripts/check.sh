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

# THE SHELL FRAGMENTS DO NOT READ vibeops.config.ts, AND THIS IS THE WHOLE REASON THIS VARIABLE SURVIVED
# THE MIGRATION. `vibe-ops check` runs the seventeen fragments through their own runner, which honours
# only this environment variable; the config's `settings` reach the ported gates in `agents-md` and
# `governance` and nothing else. Both entries below name a fragment whose PORT already covers this
# repository — better, because a gate's population is declared in the config and a fragment's is not.
#
# Keeping the two halves' declarations in different places is not the shape anyone would design. It is
# the shape RFC-0001 describes as temporary: the fragment goes away once its port is shown to agree with
# it, and this variable goes away with the last fragment that needs it.
export VIBE_OPS_DISABLED_CHECKS="links:superseded by the markdown-link gate, which honours the dsl/ docs/ dogfood/ exclusions declared in vibeops.config.ts — this fragment has no population control and reports all three (2026-08-13)
budget:same finding the budget gate reports, where it is a warning with Track 6 named as its owner (2026-08-13)"

# --no-warnings suppresses MODULE_TYPELESS_PACKAGE_JSON, which Node prints once per invocation because
# vibeops.config.ts is ESM in a package with no "type": "module". Three ops means three copies of a
# four-line warning about a file that loads correctly. Adding "type": "module" to the root package.json
# would silence it at the source and change module resolution for every workspace — not worth it.
export NODE_OPTIONS="${NODE_OPTIONS:-} --no-warnings"

# `check` is the seventeen fragments. Two of them are declared off above, and ten skip in this repository
# because they check a plugin's surfaces; what it uniquely contributes here is `private-names` and
# `machine-paths`, neither of which has a port yet. `agents-md` and `governance` are the ported gates.
RC=0
for ops in check agents-md governance; do
  if [ "${GATE_VERBOSE:-}" = "1" ]; then
    vibe-ops "$ops" --verbose || RC=$?
  else
    OUT=$(vibe-ops "$ops" 2>&1) || RC=$?
    # Only what asks a reader to act, plus the summary this run was asked for.
    printf '%s\n' "$OUT" | grep -E '^(FAIL|WARN) |^(■|◆) ' || true
  fi
done

exit "$RC"
