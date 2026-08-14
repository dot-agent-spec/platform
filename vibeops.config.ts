// This repository's vibe-ops configuration.
//
// It replaces `scripts/checks/_run.sh`, which carried the same declarations as an exported environment
// variable inside a shell script — unreviewable, and invisible to anything but a reader who opened the
// file. The cascade continues upward from here to the home directory, so anything machine-specific (an
// operator's plugin path, a personal artifact location) belongs in `vibeops.config.local.ts`, never here:
// a machine path committed into this file is what the `machine-paths` check exists to catch.

import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

export default {
  // `self` is deliberately absent. Its composition hardcodes `<plugin>/templates/*.md` and
  // `<plugin>/skills/migrate/migrations`, which resolve to this repository's root — where neither
  // exists — so every gate in it skips. It is the norm-owner's ops, not a consumer's, and listing it
  // here would buy a line that always reads clean because it always reads nothing.
  modules: ["check", "agents-md", "governance", "harness", "plan", "task", "log", "records"],

  // Per-clone and inside .git/ deliberately: these are observations about a working tree, not a product
  // of it, and committing them would make every run a diff. `.githooks/pre-commit` used to export this
  // as GATE_ARTIFACT_DIR; the export goes away with the shell wiring. Nothing writes here yet — this
  // repository composes no emitting gate — and the workspace's drain-gate-artifacts.sh is what would
  // ingest it into eita once one does.
  artifactDir: ".git/gate-artifacts",

  // The two `adopt` decisions from Plan-001 Track 1, declared rather than renamed away.
  //
  // KNOWN LIMIT, RECORDED RATHER THAN WORKED AROUND: these keys are read by the records resolver, not by
  // the gates, whose paths are literals in the upstream ops (`project/rfc/**/*.md`,
  // `<plugin>/templates/adr.md`). So the RFC record-header and template-version entries examine zero
  // files here, which produces no findings and reads exactly like a clean run. Plan-001's open questions
  // carry it; a local override would be a third copy of an answer that already exists twice.
  records: {
    dirs: { rfc: "project/rfcs" },
    templates: {
      adr: "project/templates/adr.md",
      rfc: "project/templates/rfc.md",
      plan: "project/templates/plan.md",
      task: "project/templates/task.md",
    },
  },

  settings: {
    // INERT TODAY, AND DECLARED ANYWAY. `module-check` spawns the seventeen shell fragments through
    // their own runner and passes it only GATE_VERBOSE — it never reads `context.settings`, so nothing
    // below reaches them. The live declaration is the VIBE_OPS_DISABLED_CHECKS export in
    // scripts/check.sh and .githooks/pre-commit.
    //
    // WHY IT IS HERE REGARDLESS. That export only exists inside those two files, so every other caller
    // of `vibe-ops check` — a session hook, an agent running it directly, a future CI job — sees 38
    // failures this repository has already decided about. Measured 2026-08-13, by a Stop hook doing
    // exactly that. Keeping the ledger in the config is where a reader looks for it, and it goes live
    // the day module-check translates these into the env it spawns with.
    check: {
      disabled: {
        links: "superseded by the markdown-link gate, which honours the dsl/ docs/ dogfood/ exclusions declared below — this fragment has no population control (2026-08-13)",
        budget: "same finding the budget gate reports as a warning, with Track 6 named as its owner (2026-08-13)",
      },
    },

    "agents-md": {
      // A nested AGENTS.md that a writer looks up ON PURPOSE, which Plan-001's Design names as the one
      // job such a file still does honestly: `project/rfcs/AGENTS.md` is the package-impact authoring
      // table, and it is deliberately not auto-loaded. Excluded from the population rather than given a
      // CLAUDE.md, because giving it one would contradict the design decision instead of recording it.
      ignore: { pairing: ["project/rfcs/AGENTS.md"] },

      // WARN, NOT DISABLED, AND THE DIFFERENCE IS THE POINT. A disabled check reports nothing about
      // anything, so a NEW instance of the same defect would be invisible for as long as the
      // declaration stood. These stay visible, stay attributable, and stop blocking a commit.
      level: {
        // 174 of 150 lines. Track 6 owns it, and its method is relocation, not compression.
        budget: "warn",
        // Six folders, each owned by project/tasks/per-package-agents-md.md, which fixes them in the
        // review-first order rather than by adding six one-line files.
        "no-sibling-claude-md": "warn",
      },
    },

    governance: {
      // POPULATION, NOT BEHAVIOUR. These three trees are out of this plan's scope for reasons that have
      // nothing to do with governance, so their links are not findings about this repository — as
      // opposed to `level` below, which is about findings that ARE real and are being worked.
      ignore: {
        "*": [
          // Link rot with unrelated causes; belongs to whoever next edits those trees.
          "dsl/**",
          "docs/**",
          // Dated write-once snapshots, never retro-corrected — .agents/rules/dogfood.md.
          "dogfood/**",
        ],
      },

      level: {
        // The in-scope remainder, owned by project/tasks/close-the-red-findings.md. Largest single
        // source is project/plans/002 at nine.
        "markdown-link": "warn",
        // All five dossiers lack the Issue row, because project/templates/task.md has no such row.
        // The instances are close-the-red-findings'; the template is Track 7's, via `harness sync`.
        "record-header-task": "warn",
        // One malformed reference at project/plans/002:467 — an abbreviated sha the gate cannot verify.
        breadcrumb: "warn",
      },
    },
  },
} satisfies VibeOpsConfig;
