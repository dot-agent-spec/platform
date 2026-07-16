---
description: Release runbook for publishing @dot-agent/* npm packages — version bumps, the exact-pin cascade, and the topological tag-push waves that hand off to the OIDC publish workflows
---

# /publish — Release @dot-agent packages to npm

Consolidated runbook so this process is never re-derived from scratch. Publishing is **tag-driven**: you
bump versions + re-pin cross-deps on `main`, then push `<pkg>@<version>` tags, and the GitHub Actions
`publish-*.yml` workflows do the actual `npm publish --provenance` via OIDC. **There is no local publish.**

**Usage:** `/publish` — then work through the phases below for the packages you're releasing.

## 🔒 Human-approval gate (read first, state it upfront)

At the **start** of a publish run, tell the human that **the actual publish (pushing tags in Phase 3)
requires explicit human approval** — everything up to and including the merge to `main` is reversible, the
tag push is not (a version can't be re-published or unpublished after 72h).

- **Default:** stop before Phase 3 and get an explicit go-ahead, with the exact tag list confirmed.
- **Pre-approval:** the human may pre-approve the batch up front ("go ahead and publish X, Y, Z"). If so, you
  may proceed through the waves without re-asking — **but only while everything goes clean.**
- **Critical-error override:** if anything critical surfaces at any point — a failing or hanging test, a
  security-relevant finding, an unexpected diff, a wrong/extra tag, a workflow failing mid-cascade — **stop
  and request a fresh human review, even if the batch was pre-approved.** Pre-approval covers the happy path,
  not surprises.

---

## The packages & dependency graph

Seven publishable units. Arrows point **dependency → dependent** (a bump flows rightward):

```
tree-sitter ─┬─→ parser-dsl ──→ kernel-dsl
             │        │
             ├────────┴──→ compiler ─┬─→ sdk ──→ cli
             └───────────────────────┤    ↑        ↑
                          language-server │        │
                                    (compiler,     (sdk, compiler)
                                     parser-dsl,
                                     tree-sitter)
```

Exact pin edges (who pins whom, all **exact** — no `^`/`~`):
- `compiler` → `parser-dsl`, `tree-sitter`
- `sdk` → `kernel-dsl`, `compiler`
- `language-server` → `parser-dsl`, `compiler`, `tree-sitter`
- `cli` (`apps/dot-agent-cli`) → `sdk`, `compiler`
- `kernel-dsl`, `parser-dsl`, `tree-sitter` → no `@dot-agent/*` deps

Dirs: `packages/<pkg>` except `cli` → `apps/dot-agent-cli`, `vscode` → `apps/vscode-extension`.

## The exact-pin cascade (why releases fan out)

Pins are **exact**, so bumping package X forces every package that pins X to (a) update that pin string and
(b) republish under a new version — which in turn cascades to *their* dependents. To compute a release set:

1. Start with the packages whose **own source changed**.
2. Add every package that exact-pins any package now in the set. Update its pin(s) to the new version and
   give it its own patch bump.
3. Repeat until closure. `tree-sitter` at the root only cascades if *it* changed.

`scripts/release.mjs` bumps `version` in `package.json` + `Cargo.toml` but **does NOT touch cross-dep pins**
and applies **one version per run** — so the pin edits (and multi-version batches) are always manual.

## Version discipline

- **patch** (`0.10.2`→`0.10.3`): bug fix, no API/contract change. **WASM ABI must be unchanged** — the
  wasm-bindgen glue is exact-pinned against the `.wasm`, so a patch must not touch the ABI.
- **minor** (`0.10`→`0.11`): additive / any WASM-ABI or contract change. (If pins are ever loosened to `^`,
  this rule is what keeps `^0.x` safe. Don't propose changesets or other versioning tooling unless asked.)

## Phase 1 — Bump & re-pin (on a release branch off fresh `main`)

1. `git checkout main && git pull` — confirm the fix commit(s) you're releasing are actually present.
   **Diff local `main` vs `origin/main` first** (`git rev-list --left-right --count origin/main...main`) —
   unpushed local commits silently ride along into a release branch cut from `main`.
2. Branch `chore/release-<slug>`.
3. For each package in the release set: bump `version` in its `package.json`; update its exact pins to the
   new versions of anything else in the set; bump `Cargo.toml` `version` **only for crates that changed**
   (kernel-dsl, parser-dsl, tree-sitter have crates; compiler/sdk/language-server/cli are TS-only). Keep
   `Cargo.toml` aligned with npm even though these tags publish **npm-only** (crates.io is a separate
   Trusted-Publishing path).
4. `npm install` to regenerate `package-lock.json`.
5. Add a dated **CHANGELOG.md** entry per bumped package (Keep-a-Changelog format already in each). Write a
   real fix description for changed packages; `Re-pin @dot-agent/* to patched versions` for pin-only bumps.
   Collapse stale pre-release history into one line rather than reconstructing precise attribution.

## Phase 2 — Pre-flight (must be green before tagging)

The publish workflows now **gate on tests**: `publish-kernel-dsl.yml`/`publish-parser-dsl.yml` run the
package's `npm test`, and `publish-ts.yml` runs `npm test --if-present` in the target dir (which is
`vitest run` for compiler/language-server/cli, `node --test` for sdk). A red test **blocks that package's
publish**. Run locally first:

- `npm run build` for the WASM chain (tree-sitter → parser-dsl → kernel-dsl) if dist/ is stale — the
  browser-bundle guard tests bundle the built `dist/`.
- `npm test` for every package in the release set. All green.

Open the release branch as a **PR → merge to main** (keeps `main` the tagged base), matching how fixes land.

## Phase 3 — Tag & push in topological waves

A package's exact-pinned deps must be **live on npm before it publishes**, or a consumer install in the gap
fails. So push tags dependency-first, and wait for each wave's Actions run to go green before the next:

- **Wave 1:** leaf deps with no `@dot-agent/*` deps (e.g. `kernel-dsl@`, `parser-dsl@`, `tree-sitter@`).
- **Wave 2:** `compiler@` (needs parser-dsl, tree-sitter).
- **Wave 3:** `sdk@` (needs kernel-dsl, compiler); `language-server@` (needs parser-dsl, compiler, tree-sitter).
- **Wave 4:** `cli@` (needs sdk, compiler).

Tag → workflow: `kernel-dsl@*`→`publish-kernel-dsl.yml`, `parser-dsl@*`→`publish-parser-dsl.yml`,
`compiler@*`/`sdk@*`/`language-server@*`/`cli@*`→`publish-ts.yml` (its `resolve` job maps prefix→dir; it also
builds the whole chain from the workspace before publishing the target). dist-tag logic in each workflow:
version containing `-` → `alpha`, else `latest`.

```
git tag kernel-dsl@0.10.3 && git push origin kernel-dsl@0.10.3   # one tag; watch the run
```

**Footguns:**
- Backticks inside **double quotes** execute for real in Bash — this has nearly caused an accidental root
  `npm publish`. Quote example commands with **single quotes**.
- After any `git rm`, re-check `git status` before committing — a stray pathspec error silently drops the
  rest of the `git add`.

## Phase 4 — Verify & GitHub Releases

- Every workflow run green (browser-bundle guard included for WASM/sdk).
- `npm view @dot-agent/<pkg> version` = new version, tagged `latest`.
- Spot-check pins: `npm view @dot-agent/<pkg>@<new> dependencies` shows the re-pinned versions.
- **Anything beyond `npm publish` needs a local `npm login`** — OIDC only authorizes `npm publish`;
  `npm dist-tag add` and friends fail **E401** in CI even with `id-token:write`.
- GitHub Release: write **real presentation copy in English**, not just the raw changelog.
- `vscode-extension` is not on npm pins — it bundles build output, released on its own track.

---

## ⟳ After every publish round: review THIS skill

Once the release is published and verified, **re-open this file and reconcile it with what actually
happened** — fix any step that differed, tighten anything that was fuzzy, add any new footgun you hit. Keep
it accurate so the next round doesn't re-discover the process.
