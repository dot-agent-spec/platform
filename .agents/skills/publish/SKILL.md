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
(b) republish under a new version — which in turn cascades to *their* dependents.

The seven packages are one changesets **`fixed` group** (`.changeset/config.json`), so the release set is
always all seven, at one version. `npx changeset version` computes that version from the pending
`.changeset/*.md` files, writes it into every `package.json`, re-pins the exact cross-dependencies and writes
each `CHANGELOG.md`. Nothing about the cascade is computed by hand any more. `vscode-dot-agent` is in the
config's `ignore` list and is not moved.

`scripts/release.mjs` predates changesets: it bumps one package per run and does not touch pins. It is not
part of this runbook.

## Version discipline

- **patch** (`0.10.2`→`0.10.3`): bug fix, no API/contract change. **WASM ABI must be unchanged** — the
  wasm-bindgen glue is exact-pinned against the `.wasm`, so a patch must not touch the ABI.
- **minor** (`0.10`→`0.11`): additive / any WASM-ABI or contract change. (If pins are ever loosened to `^`,
  this rule is what keeps `^0.x` safe.) `major` is never used in 0.x.

The level is declared per change, in the `.changeset/*.md` file the pull request carried; the release takes
the highest pending level.

## Channels — alpha, beta, and how work moves between them

Fixes land on `main`; everything else lands on `alpha` and reaches `main` only by promotion
(CONTRIBUTING, *Which branch a pull request targets*). The `alpha` and `beta` branches each sit in
changesets' pre mode, recorded in their own `.changeset/pre.json`, so `changeset version` there produces
`X.Y.Z-alpha.N` / `X.Y.Z-beta.N`. Pre mode keeps every changeset file until it exits.

- **Prerelease.** On the channel branch, Phase 1 from step 3 and Phase 2 as usual, then push its tags in
  Phase 3's waves. No PR into `main`.
- **alpha → beta.** On `beta`, `git merge alpha`. It always conflicts on `.changeset/pre.json` (each branch
  added its own) — keep beta's: `git checkout --ours .changeset/pre.json`. The next `changeset version`
  continues the counter from alpha's (`-alpha.0` is followed by `-beta.1`), which still sorts correctly.
- **beta → main — the stable release.** On `beta`, `npx changeset pre exit`, then Phase 1 from step 3:
  `changeset version` produces the plain `X.Y.Z` and deletes `pre.json`. PR into `main`; CI refuses one that
  still carries `pre.json` in pre mode.
- **After a stable release, reset both channels onto it.** In each of `beta` and `alpha`: `git merge main`,
  take `main`'s side of every conflicting `package.json` (`git checkout --theirs`), `git rm
  .changeset/pre.json`, commit, then `npx changeset pre enter <channel>` and commit again. Pre mode records
  the released versions as its base, so the channel's next prerelease targets the next version (`0.12.1`
  released → `0.13.0-alpha.0` for a pending minor), and changesets not yet promoted stay pending.
- **Forward-port a fix.** After a fix lands on `main` (and after its release), merge `main` into `beta` and
  `main` into `alpha` — each from `main`. `.gitattributes` unions the `CHANGELOG.md` files, so the conflicts
  left are the `version` and pin lines of the seven `package.json`: keep the channel's side (`git checkout
  --ours`). Check the diff first: a fix that changed a dependency in a `package.json` needs that line kept by
  hand.
- **Never merge `beta` into `alpha`.** Once alpha has been promoted into beta, beta's `pre.json` descends
  from alpha's, so the merge applies it **without a conflict** and alpha silently switches to tag `beta` —
  its next "alpha" publishes `-beta.N` under the `beta` dist-tag. CI refuses a pull request into either
  branch whose `pre.json` names the other channel; a direct push is not checked.

## Phase 1 — Bump & re-pin (on a release branch off fresh `main`)

1. `git checkout main && git pull` — confirm the fix commit(s) you're releasing are actually present.
   **Diff local `main` vs `origin/main` first** (`git rev-list --left-right --count origin/main...main`) —
   unpushed local commits silently ride along into a release branch cut from `main`.
2. Branch `chore/release-<slug>`. **An `alpha` or `beta` release is cut on the channel's own branch
   instead**, and its tags are pushed from there — see *Channels* below.
3. `npx changeset status --verbose` — read the version it will produce and the changesets it will consume.
   Then `npx changeset version`: it bumps all seven `package.json` files, re-pins the exact cross-deps,
   writes each `CHANGELOG.md` from the changesets' summaries and deletes the consumed `.changeset/*.md`.
   **Never edit a `CHANGELOG.md` by hand** — fix the changeset summary and re-run instead. The
   `vscode-extension` changelog is the exception: it is outside changesets and stays hand-written.
4. Set `version` in the three `Cargo.toml` files (kernel-dsl, parser-dsl, tree-sitter; the others are
   TS-only) to the same new version — changesets moves only `package.json`. Keep them aligned with npm even
   though these tags publish **npm-only** (crates.io is a separate Trusted-Publishing path).
5. `npm install` to regenerate `package-lock.json`. (`Cargo.lock` is **gitignored** — CI regenerates it; no
   need to commit it.)
6. **Rebuild the TS packages** (`tsdown`) after bumping so tracked, build-generated version constants refresh
   — notably `packages/compiler/src/generated-version.ts` (`COMPILER_VERSION`), which is committed and goes
   stale otherwise. (`apps/dot-agent-cli/src/version.ts` reads `package.json` at runtime, so it needs no
   rebuild.) `dist/` is gitignored; the point is the tracked source constants, not the build output.

## Phase 2 — Pre-flight (must be green before tagging)

The publish workflows now **gate on tests**: `publish-kernel-dsl.yml`/`publish-parser-dsl.yml` run the
package's `npm test`, and `publish-ts.yml` runs `npm test --if-present` in the target dir (which is
`vitest run` for compiler/language-server/cli, `node --test` for sdk). A red test **blocks that package's
publish**. Run locally first:

- `npm run build` for the WASM chain (tree-sitter → parser-dsl → kernel-dsl) if dist/ is stale — the
  browser-bundle guard tests bundle the built `dist/`. WASM (`pkg/`) is unchanged on a TS-only release, so
  running `tsdown` directly per package is enough — no need for the full `cargo test` + wasm rebuild.
- `npm test` for every package in the release set. All green.

Pre-flight is not a formality: it has caught real, non-obvious bugs mid-release (e.g. a language-server
`diagnose()` that crawled the filesystem from `/` for a file outside any bundle — slow enough to time out and
trip a macOS TCC "access other apps' data" prompt). A failing/**hanging** test is a critical error → fix it
and re-run, or escalate for human review per the gate above; never tag past red.

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
builds the whole chain from the workspace before publishing the target). The npm dist-tag comes from the
version, through `scripts/npm-dist-tag.sh`: no prerelease → `latest`, `-alpha.N` → `alpha`, `-beta.N` →
`beta`; any other identifier fails the workflow before `npm publish`.

```
git tag kernel-dsl@0.10.3 && git push origin kernel-dsl@0.10.3       # push the wave's tag(s)
gh run list --limit 5 --json databaseId,name,status,event               # find the run id
gh run watch <run-id> --exit-status && echo GREEN                       # blocks until done; nonzero if it failed
npm view @dot-agent/<pkg> version                                       # confirm live on npm before next wave
```

`gh run watch --exit-status` is the wait-for-green gate between waves — its exit code is the go/no-go. Only
advance when the run is green *and* `npm view` shows the version live (the next wave's pins resolve against
npm). If any wave fails, **stop** — don't push later waves, since their pinned deps won't exist.

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
