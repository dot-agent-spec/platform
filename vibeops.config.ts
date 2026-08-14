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
    // The seventeen shell fragments. `module-check` translates this into the VIBE_OPS_DISABLED_CHECKS
    // the shell runner already understood, so one declaration serves every caller — the hook, a manual
    // scripts/check.sh, an agent running `vibe-ops check` directly. It was written here while still
    // inert, on 2026-08-13, and went live the same day without an edit.
    //
    // NEITHER ENTRY LOSES COVERAGE, WHICH IS THE ONLY REASON EITHER IS ACCEPTABLE. Both name a fragment
    // whose port still runs: `markdown-link` detects the same links and takes its population from the
    // `governance` exclusions below, which the fragment cannot do; the `budget` gate reports the same
    // 174 lines as a warning with an owner. Turning these off removes a duplicate, never a detector.
    check: {
      disabled: {
        links: "superseded by the markdown-link gate, which honours the dsl/ docs/ dogfood/ exclusions declared below — this fragment has no population control (2026-08-13)",
      },
    },

    "agents-md": {
      // Two nested AGENTS.md files that must NOT get a sibling, for different reasons. Excluded from the
      // population rather than repaired, because repairing them would contradict a decision instead of
      // recording it.
      //
      // `project/rfcs/AGENTS.md` is the package-impact authoring table — Plan-001's Design names it as
      // the one job a nested file still does honestly: detail a writer looks up on purpose.
      //
      // `plugins/claude/AGENTS.md` is the harder one, and the reason this list is not merely tidiness.
      // That folder is a Claude Code plugin: no build, no `files` allowlist, copied byte for byte into
      // every user's `~/.claude/plugins/cache/`. A `CLAUDE.md` at a plugin root therefore SHIPS to every
      // user while never loading as project context, and `claude plugin validate` warns about it. The
      // guardrails live in `.agents/rules/plugin-claude.md` instead, which is paths-scoped and does load.
      //
      // Measured 2026-08-13: `authoring-agents-md`'s pairing hook created that exact file automatically
      // on the next write to the AGENTS.md, because a hook repairing a finding cannot know which findings
      // a repository has declared out of scope. This entry is what makes the hook agree.
      ignore: { pairing: ["project/rfcs/AGENTS.md", "plugins/claude/AGENTS.md"] },

      // WARN, NOT DISABLED, AND THE DIFFERENCE IS THE POINT. A disabled check reports nothing about
      // anything, so a NEW instance of the same defect would be invisible for as long as the
      // declaration stood. These stay visible, stay attributable, and stop blocking a commit.
      level: {
        // Six folders, each owned by the per-package AGENTS.md dossier, which fixed them in the
        // review-first order rather than by adding six one-line files. Kept as `warn` rather than
        // removed: the population is not closed, since a new nested AGENTS.md can appear at any time.
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

        // POPULATION, AND THE DISTINCTION IS THE WHOLE POINT: a file that lives among the records is not
        // necessarily one of them. An index lists its folder's contents and an AGENTS.md is authoring
        // guidance; neither was written from a template, so a header table or a version stamp would
        // assert a shape it does not have. Not debt, and with no owner — nothing here is ever going to
        // be stamped.
        //
        // The rfc entries were deliberately absent until 2026-08-14 and are here now because the reason
        // for their absence expired. The rfc gates were composed over the literal `project/rfc/**/*.md`
        // while this repository uses the plural `rfcs/`, so their population was empty and an exclusion
        // would have read as protection while protecting nothing. Upstream replaced the ten directory
        // literals with `<records:<type>>` the same day; the folder became visible, its 23 RFCs with it,
        // and the two non-records needed declaring for the first time.
        "template-version-log": ["project/log/README.md"],
        "template-version-rfc": ["project/rfcs/INDEX.md", "project/rfcs/AGENTS.md"],
        "record-header-rfc": ["project/rfcs/INDEX.md", "project/rfcs/AGENTS.md"],
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

        // RAISED TO FAIL ON 2026-08-14, WHICH IS THE POINT OF THE WHOLE EXERCISE. These two were `warn`
        // for one day while Plan-001 Track 7 migrated the population: 43 of 46 records carried no stamp
        // at the start and every one of them now does, so a warning that fires on nothing is a warning
        // people learn to scroll past. The upgrade guide prescribes exactly this moment — the level is
        // correct mid-migration and wrong for a repository that has finished one.
        //
        // What this buys: the templates carry a stamp, so a record scaffolded from today onward inherits
        // it for free, and the only way to produce an unstamped or behind record now is to hand-write one
        // — which is the case worth stopping a commit for.
        "template-version-undeclared": "fail",
        "template-version-behind": "fail",
      },
    },
  },
} satisfies VibeOpsConfig;
