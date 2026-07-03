<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Pre-alpha release rehearsal — fix pipeline, then version all packages — DA01-01

| Field | Value |
|---|---|
| Status | In Progress — all P0 items done (including 9a), P1 items 6–7–9 done (Marketplace/Open VSX secrets added, extension verified in a real Extension Host, tree-sitter/language-server build gaps fixed), item 8 (actual publish) awaiting go-ahead |
| Created | 2026-06-25 |
| Updated | 2026-07-02 |
| Author | Danilo Borges |
| Sources | [DA00-02: two-axis versioning](../adr/DA00-02-two-axis-versioning.md), [pre-public-consolidation](pre-public-consolidation.md), [implementation-status.md](../implementation-status.md) |
| Sibling task(s) | [DA01-01-dsl-spec-versioning.md](DA01-01-dsl-spec-versioning.md) — that task owns `dsl/VERSION` and how `aboutme.json` provenance is derived; this task owns package version numbers and the publish mechanism. Its build-time embedding step re-reads whatever `@dot-agent/compiler` version this task lands on, so it should run after this task's item 8. |

<!-- Status lifecycle: Planned → In Progress → Done → (file removed or archived) -->

---

## Context

Original scope (2026-06-25) was a narrow interim bump: `tree-sitter` `0.4.1→0.5.0` and `parser-dsl`
`0.1.0→0.2.0`. That work item never ran, and the grammar/AST changes that motivated it shipped without
a publish. Superseded 2026-07-02 by a broader rehearsal: exercise the **entire** coordinated-release
mechanism — every package, `release.mjs`, tag-triggered CI, both registries — under a clearly-marked
pre-alpha version, before committing to the real `0.10.0` jump decided in
[DA00-02](../adr/DA00-02-two-axis-versioning.md) ("all packages make a one-time jump to `0.10.x` at the
first public publish").

Rationale for rehearsing first rather than jumping straight to `0.10.0`: nothing has ever been published
through the current monorepo pipeline. A dry run surfaces mechanical breakage (bad tag formats, wrong
paths, missing registry auth) on throwaway version numbers instead of on the number that's supposed to
be the stable public debut.

Audit that produced this task found the pipeline is not actually ready to publish anything correctly:

- `scripts/release.mjs` tags releases as `@dot-agent/<pkg>@<version>`, but every `publish-*.yml` workflow
  triggers on the bare pattern `<pkg>@*`. As written, pushing the script's tags **never fires CI**.
- `scripts/release.mjs` also calls `npm publish --access public` locally in Phase 4 — a second, parallel
  publish path with no `--provenance`, bypassing the OIDC trusted-publishing flow the workflows use. Two
  divergent publish mechanisms invite an unsigned publish or a double publish.
- `scripts/release.mjs` hardcodes `path.join('packages', pkg)`, so it cannot version `apps/dot-agent-cli`
  or `apps/vscode-extension` at all.
- `kernel-dsl` has drifted internally: `Cargo.toml` says `0.1.0`, `package.json` says `0.1.3`. Evidence
  the two manifests are already being bumped by hand, inconsistently.
- `repository` field is wrong across the board: `tree-sitter` and `kernel-dsl` (`Cargo.toml` +
  `package.json`) still point at their archived individual-repo URLs
  (`dot-agent-spec/tree-sitter`, `dot-agent-spec/kernel-dsl`); `parser-dsl` points at
  `dot-agent-spec/dot-agent-spec` (wrong repo name, monorepo is `platform`). None point at the actual
  canonical repo.
- Root `package.json` workspaces lists `apps/zed-agent`, which does not exist yet.
- `packages/sdk` has no `README.md` at all — every other package does.
- `parser-dsl` / `kernel-dsl` depend on `wasm-bindgen` with no `#[cfg(target_arch = "wasm32")]` gate and
  export `#[wasm_bindgen]` items directly from the lib. Publishing either crate to crates.io as-is would
  ship a native rlib that either fails to build or exposes a useless API outside wasm. **Decision:
  keep both unpublished on crates.io deliberately** (matches current `implementation-status.md`), and
  say so explicitly in their `README.md` / `Cargo.toml` doc comment rather than leaving it looking like
  an oversight. Revisit only if/when a real native-Rust consumer shows up — the fix is extracting a
  wasm-bindgen-free core crate, which is real work, not a CI checkbox.
- `apps/vscode-extension` only uploads a `.vsix` to a GitHub Release; it has never gone to the VS Code
  Marketplace or Open VSX. Confirmed in scope for this rehearsal.

## Priority overview

| # | Priority | Item | Package(s) | Effort | Status |
|---|---|---|---|---|---|
| 1 | P0 | Fix `release.mjs` tag format + drop local publish | tooling | S | ✅ |
| 1b | P0 | Add `alpha`/`latest` npm dist-tag detection to every `publish-*.yml` | tooling | S | ✅ |
| 2 | P0 | Generalize `release.mjs` package path resolution | tooling | S | ✅ |
| 3 | P0 | Fix `repository` metadata everywhere | tree-sitter, parser-dsl, kernel-dsl | S | ✅ |
| 4 | P0 | Remove/comment phantom `apps/zed-agent` workspace entry | root | XS | ✅ |
| 5 | P0 | Reconcile kernel-dsl `Cargo.toml`/`package.json` version drift | kernel-dsl | XS | ✅ |
| 6 | P1 | Write `packages/sdk/README.md` | sdk | S | ✅ |
| 7 | P1 | Document parser-dsl/kernel-dsl crates.io non-publish decision | parser-dsl, kernel-dsl | XS | ✅ |
| 8 | P1 | Run the pre-alpha rehearsal bump + publish (`-alpha.1`, `alpha` dist-tag) | all packages | M | pending — needs explicit go-ahead (pushes tags, triggers real registry publishes) |
| 9 | P1 | Add real VS Code Marketplace publish step | vscode-extension | M | ✅ `VSCE_PAT`/`OVSX_PAT` secrets added; extension packaged, installed, and activated successfully in a real VS Code Extension Host |
| 9a | P0 | Fix `vsce package` (couldn't build a VSIX at all — npm workspaces bug) | vscode-extension | L | ✅ verified via headless LSP test against the packaged VSIX |
| 10 | P2 | Capture lessons learned, archive this task, open the real `0.10.0` task | — | XS | pending |

---

## Work items

### 1. Fix `release.mjs` tag format + drop local publish — P0

**What:** Tag format changes from `` `@dot-agent/${pkg}@${version}` `` to `` `${pkg}@${version}` ``
(matches what every `publish-*.yml` actually listens for). Phase 4's `npm publish --access public` call
is removed entirely; the script's job ends at commit + tag + `git push --tags`, and publishing happens
exclusively in CI via the OIDC-authenticated workflows.

**Why:** As written today, the script's tags silently never trigger CI (wrong pattern), and even if they
matched, the local publish step would produce an unsigned, non-provenance package alongside whatever CI
would have done — a foot-gun that could double-publish or publish untrusted artifacts.

**Change:** Edit `scripts/release.mjs` Phase 4 and Phase 5 tag-creation line; update its printed
reminder to say "CI will publish once the tag lands," not "run this to publish."

### 1b. Add npm dist-tag detection to every `publish-*.yml` — P0

**What:** Every workflow that runs `npm publish` (`publish-tree-sitter.yml`, `publish-parser-dsl.yml`,
`publish-kernel-dsl.yml`, `publish-ts.yml`) now computes a dist-tag from the pushed tag/ref: any version
containing a hyphen (a prerelease, e.g. `0.5.0-alpha.1`) publishes under `--tag alpha`; anything else
publishes under the implicit `latest`.

**Why:** Discovered while implementing item 8's rehearsal design: none of the workflows previously
supported a dist-tag at all — they all hardcoded a plain `npm publish`, which always sets `latest`. Item
8 requires the rehearsal to publish under `alpha` specifically so nobody installing without a tag gets
pulled into it; without this fix, pushing `0.5.0-alpha.1` through the existing pipeline would have
silently become the `latest` version for every package.

**Change:** `.github/workflows/publish-tree-sitter.yml`, `publish-parser-dsl.yml`, `publish-kernel-dsl.yml`,
`publish-ts.yml` — added a "Determine npm dist-tag" step before each `npm publish`, gated on
`GITHUB_REF_NAME`. crates.io needs no equivalent: prerelease semver is a native concept there, so
`0.5.0-alpha.1` is automatically excluded from a plain `cargo add`.

### 2. Generalize `release.mjs` package path resolution — P0

**What:** Replace the hardcoded `path.join('packages', pkg)` with a small lookup table (or a scan of
`packages/*` + `apps/dot-agent-cli` + `apps/vscode-extension`) so the script can version the CLI and the
VS Code extension too.

**Why:** Item 8 below needs to bump `cli` and `vscode-extension` in the same rehearsal; the script
cannot currently touch anything under `apps/`.

**Change:** `apps/dot-agent-cli` and `apps/vscode-extension` map to their own path prefix instead of
`packages/`.

### 3. Fix `repository` metadata everywhere — P0

**What:** Point every `Cargo.toml` `repository` field at `https://github.com/dot-agent-spec/platform`.

**Why:** `tree-sitter` and `kernel-dsl` Cargo manifests pointed at archived, individual repos;
`parser-dsl`'s pointed at a monorepo name (`dot-agent-spec/dot-agent-spec`) that doesn't exist. Anyone
following the crates.io "repository" link today lands on a dead or wrong page.

**Turned out smaller than scoped:** the npm `package.json` files for all three packages already had the
correct `repository: { url: ".../platform", directory: "packages/<pkg>" }` shape — only the Rust
`Cargo.toml` manifests had drifted. Cargo's `repository` field is a bare string (no `directory`
sub-field), so each just points at the monorepo root; `kernel-dsl`'s `homepage`/`documentation` fields
(same stale URL) were fixed too.

**Change:** `packages/tree-sitter/Cargo.toml`, `packages/kernel-dsl/Cargo.toml` (`repository`,
`homepage`, `documentation`), `packages/parser-dsl/Cargo.toml`.

### 4. Remove/comment phantom `apps/zed-agent` workspace entry — P0

**What:** Drop `"apps/zed-agent"` from the root `package.json` `workspaces` array, or comment with a
one-line note if it's genuinely imminent.

**Why:** `npm install` silently tolerates a missing workspace glob today, but it's a landmine for anyone
scripting against `npm run build --workspaces` or auditing what actually ships.

**Change:** `package.json` (root).

### 5. Reconcile kernel-dsl version drift — P0

**What:** Before the rehearsal bump (item 8), align `packages/kernel-dsl/Cargo.toml` (`0.1.0`) and
`packages/kernel-dsl/package.json` (`0.1.3`) to the same starting number so the bump script has one
source of truth going in, not two.

**Why:** Evidence the two manifests are already drifting apart under manual editing; rehearsing the
release mechanism on top of an already-inconsistent starting point defeats the purpose of the rehearsal.

**Change:** `packages/kernel-dsl/Cargo.toml` `version` field (bump to match `package.json`'s `0.1.3`, the
more-recently-touched one), or vice versa — either is fine, just pick one before item 8 runs.

### 6. Write `packages/sdk/README.md` — P1

**What:** Add a README matching the shape of the other package READMEs (install, quick usage snippet
against `loadAgent`/`AgentSession`, exported types, license).

**Why:** It's the only package in `packages/` with no README at all — a visible gap the moment `sdk` is
public on npm.

**Change:** New file `packages/sdk/README.md`.

### 7. Document parser-dsl/kernel-dsl crates.io non-publish decision — P1

**What:** Add an explicit note (in each crate's `README.md`, and a short `//!` doc comment in `lib.rs`)
stating these crates are intentionally not published to crates.io because of the ungated `wasm-bindgen`
dependency, and what would need to change (extract a wasm-bindgen-free core) for that to be revisited.

**Why:** Turns a silent gap that reads as "forgot to publish" into a recorded decision, so it doesn't get
re-litigated or "fixed" by someone just adding the missing CI job.

**Change:** `packages/parser-dsl/README.md`, `packages/kernel-dsl/README.md`, and each crate's `lib.rs`
doc comment.

### 8. Run the pre-alpha rehearsal bump + publish — P1

**What:** Every package (except `vscode-extension`, see below) moves to the exact same version,
`0.5.0-alpha.1`, published under the npm `alpha` dist-tag (never `latest`) so nobody installing without
a tag gets pulled into the rehearsal:

| Package | Current | Rehearsal version | Publishes to |
|---|---|---|---|
| tree-sitter | `0.4.1` | `0.5.0-alpha.1` | npm (`alpha` tag) + crates.io |
| parser-dsl | `0.1.0` | `0.5.0-alpha.1` | npm (`alpha` tag) only — crate stays unpublished (item 7) |
| kernel-dsl | `0.1.3` (post item 5) | `0.5.0-alpha.1` | npm (`alpha` tag) only — crate stays unpublished (item 7) |
| compiler | `0.1.0` | `0.5.0-alpha.1` | npm (`alpha` tag) |
| sdk | `0.1.0` | `0.5.0-alpha.1` | npm (`alpha` tag) |
| language-server | `0.4.1` | `0.5.0-alpha.1` | npm (`alpha` tag) |
| cli | `1.0.5` | `0.5.0-alpha.1` | npm (`alpha` tag) |
| vscode-extension | `0.3.3` | see note below | GitHub Release `.vsix` + Marketplace pre-release (item 9) |

**Why lockstep for this rehearsal specifically:** `scripts/release.mjs` already only accepts one version
string per run and applies it to every package passed in — the original per-package numbering scheme
(each package to its own "next logical version") would have required extending the script to accept a
version *map*, which is real work with no payoff for a throwaway rehearsal. A single shared version
across every package (a) exercises the exact interface the script already has, (b) makes it trivial to
grep every registry for "did `0.5.0-alpha.1` land everywhere," and (c) makes cleanup after the rehearsal
a single search-and-yank instead of eight different lookups. This is a rehearsal-only choice — it does
**not** change the two-axis policy in [DA00-02](../adr/DA00-02-two-axis-versioning.md): the real
`0.10.0` release still lets each package keep independent minor/patch freedom within the `0.10.x` band.

> **vscode-extension version note:** the VS Code Marketplace does not accept semver pre-release suffixes
> (`-alpha.1`) in the `version` field — it has its own pre-release mechanism instead (odd minor number,
> e.g. `0.5.1`, published with `vsce publish --pre-release`). Use that convention for this package
> specifically, not the `0.5.0-alpha.1` string used everywhere else.

The version number above is a proposal to sanity-check when this task moves to "In Progress," not a
locked contract — the hard constraints are: (a) every npm publish in this rehearsal uses the `alpha`
dist-tag, never `latest`; (b) parser-dsl/kernel-dsl crates do not get published; (c) tags pushed must
match the bare `<pkg>@<version>` pattern each workflow expects (item 1).

**Why:** Validates the entire fixed pipeline (script → tag → CI → OIDC publish, on both npm and
crates.io) end-to-end on numbers nobody depends on, before trusting it with the real `0.10.0` release.

**Change:** Run the fixed `scripts/release.mjs` once items 1–7 are done; push the resulting tags; watch
each `publish-*.yml` run; confirm packages land under the `alpha` dist-tag / as a Marketplace pre-release.

### 9. Add real VS Code Marketplace publish step — P1

**What:** Extended `.github/workflows/publish-vscode.yml` with `vsce publish` (in addition to, not
instead of, uploading the `.vsix` to a GitHub Release) plus a best-effort `ovsx publish` mirror to Open
VSX (`continue-on-error: true` — a missing `OVSX_PAT` shouldn't fail the whole release). The `--pre-release`
flag is computed from `GITHUB_REF_NAME` the same way the npm dist-tag is: any tag containing a `-`
publishes as Marketplace pre-release, matching the odd-minor-number convention noted in item 8.

**Why:** Without this, "publishing" the extension only ever means side-loading a `.vsix` manually —
nobody finds or auto-updates it through the normal VS Code extensions UI.

**Change:** `.github/workflows/publish-vscode.yml`. **Still requires action before item 8 can actually
exercise this path:** `VSCE_PAT` (and optionally `OVSX_PAT`) must be added as repo secrets — a manual,
external, one-time step this session cannot do. Until then this step will fail loudly with an auth
error, which is the correct behavior (better than silently skipping).

#### 9a. Fix: `vsce package` could not build a VSIX at all — P0 (discovered, blocked everything above)

**What discovered:** Actually running `npm run package` (both locally and as CI would) failed outright —
`vsce` refused to package with `ERROR: The following files have the same case insensitive path, which
isn't supported by the VSIX format`, listing every file under `node_modules/@dot-agent/*` twice. This
reproduces after a fully clean `rm -rf node_modules && npm install` from the repo root, so it isn't a
stale-install artifact — it's `@vscode/vsce`'s dependency-tree walker double-counting files on this npm
workspaces monorepo, a known class of `vsce`/workspaces incompatibility. Since the VSIX format's
case-collision rule is enforced regardless of host OS, this would fail identically in CI (Ubuntu), not
just locally.

**Also found and fixed along the way:** `apps/vscode-extension/package-lock.json` (and five other
per-package lockfiles: `apps/dot-agent-cli`, `packages/{compiler,kernel-dsl,language-server,tree-sitter}`)
were committed leftovers from before these were monorepo workspace members — npm workspaces uses exactly
one lockfile, at the root. Removed the extension's; the other five are a known remaining cleanup, not
addressed here (out of scope for this item).

**Root-cause assessment — not a bug in the dependencies:** `@dot-agent/parser-dsl` locates its `.wasm`
via `new URL('../pkg/...', import.meta.url)`, and `web-tree-sitter` locates its own engine WASM via
similar self-relative resolution. Both are the correct, standard way for an ESM package to find an asset
next to itself — the only reason it breaks is that naively bundling flattens the package into a
different file at a different location, severing that relative link. This is universal friction for
*any* WASM/native npm package under a bundler (sharp, better-sqlite3, esbuild itself), not something to
"fix" in parser-dsl or web-tree-sitter.

**Fix — hybrid bundle, verified working end-to-end:** New `apps/vscode-extension/scripts/build.mjs`
(esbuild, invoked automatically via the `vscode:prepublish` npm lifecycle hook before `vsce package`):

- Bundles `extension.js` → `dist/extension.js` (CJS, external: `vscode` only).
- Bundles `packages/language-server/server.js` → `dist/server.mjs` — **ESM, not CJS**: both
  `language-server/parser.js` and compiler's built output do `createRequire(import.meta.url)` to reach
  `@dot-agent/tree-sitter`, and esbuild's CJS output leaves `import.meta` unconditionally empty (it warns
  about exactly this), which would throw at runtime. ESM keeps it real. `vscode-languageserver` also
  makes a `require()` call esbuild can't statically convert in ESM output ("Dynamic require of ... is not
  supported") — fixed with a `banner` that defines a real `require` via `createRequire(import.meta.url)`
  before the bundle's own code runs; esbuild's internal shim checks for exactly this and uses it instead
  of throwing.
- Keeps `@dot-agent/parser-dsl`, `@dot-agent/tree-sitter`, and `web-tree-sitter` **external** and copies
  each package's real runtime files (verified against their actual built `dist/`/`pkg/` output, not
  guessed) into `dist/node_modules/`, preserving the exact relative layout their own code expects.
- `package.json`: `main` → `dist/extension.js`; `package` script → `vsce package --no-dependencies` (the
  manual copy above replaces vsce's buggy auto-walk entirely).
- `.vscodeignore`: excludes source `extension.js`, `scripts/**`, and the top-level `node_modules/**`
  (anchored so it doesn't also exclude `dist/node_modules/**`).

**Verification performed (not just "it builds"):** booted the bundled `dist/server.mjs` headlessly over
stdio, sent a real LSP `initialize` + `textDocument/didOpen` for a `.behavior` file, and got back correct
`publishDiagnostics` (W011, I001 — real lint codes) — proving the WASM-loading path actually works, not
just that the process doesn't crash. Repeated the same test against the server extracted from the
**packaged VSIX itself** (not the pre-package `dist/`), confirming nothing breaks in the zip round-trip.
`vsce package --no-dependencies` now produces a complete 1.16MB / 40-file VSIX with no packaging error.
**Also verified live:** installed the packaged VSIX into a real VS Code (`code --install-extension`),
opened a real `.behavior` file from `examples/`, and confirmed via `exthost.log` that the extension
activated (`onLanguage:behavior`) with zero errors — user confirmed the language features work visually.

**Also fixed, discovered while wiring the build order:** `publish-vscode.yml` never built
`@dot-agent/tree-sitter` or `@dot-agent/parser-dsl` at all (no Rust/zig/wasm-bindgen toolchain steps —
unlike `publish-parser-dsl.yml`/`publish-kernel-dsl.yml`, which do have them), and additionally tried to
run `npm run build --workspace=packages/language-server`, which errors — that package has no `build`
script (it ships JS source directly, confirmed in the DA00-06 investigation log). On a fresh CI checkout
with empty `dist/`/`pkg/` directories, packaging would have failed before even reaching the `vsce` bug
above. Added the same Rust/zig/wasm-bindgen-cli setup as the other WASM-publish workflows, build steps
for tree-sitter and parser-dsl, kept the compiler build, and dropped the broken language-server/sdk build
lines (sdk was never a dependency of this extension in the first place).

**Two more gaps found and fixed while smoke-testing before item 8:**

- `publish-tree-sitter.yml`'s npm job ran `npm run generate` before publishing, not `npm run build`.
  `generate` only regenerates the C parser from the grammar; `build` (`build:wasm && tsup`) is what
  actually produces `dist/index.js` and the two `.wasm` files that get published, and `dist/` is
  git-ignored — a fresh CI checkout would have published an incomplete package. Reproduced locally
  (`npm run build` inside `packages/tree-sitter`, confirmed `tree-sitter build --wasm` transparently
  falls back to Docker when `emcc` isn't on `PATH`, no extra emsdk setup needed on GitHub's
  Docker-equipped runners) and fixed by swapping the step to `npm run build`.
- `publish-ts.yml` unconditionally runs `npm run build` for whichever package the tag resolves to, but
  `packages/language-server/package.json` had no `build` script at all — a `language-server@*` tag would
  have failed CI outright with "Missing script: build". Added a no-op `build` script there (matches the
  DA00-06 finding that this package ships JS source directly, no compile step) so the shared workflow
  stays uniform instead of branching per-package in YAML.

**Change:** `.github/workflows/publish-tree-sitter.yml`, `packages/language-server/package.json`.

**Change:** `apps/vscode-extension/{package.json,.vscodeignore,extension.js,scripts/build.mjs}`,
`.github/workflows/publish-vscode.yml`, `.github/workflows/publish-tree-sitter.yml`,
`packages/language-server/package.json`, deleted `apps/vscode-extension/package-lock.json`.

---

## Implementation order

```
P0:  1 (fix tag format + drop local publish)
     1b (add npm dist-tag detection)      } can run in parallel with 1, 2, 3, 4
     2 (generalize package paths)         } can run in parallel with 1
     3 (fix repository metadata)          } can run in parallel with 1, 2
     4 (remove zed-agent workspace entry) } can run in parallel with 1, 2, 3
     5 (reconcile kernel-dsl version drift) — do last of P0, right before item 8

P1:  6 (sdk README)                       } can run in parallel with 7, 9
     7 (document crates.io non-publish decision)
     9 (vscode Marketplace CI step) — ✅ done, secrets added
     8 (rehearsal bump + publish) — gated on ALL of P0 being done; this is the actual test, ready to run

P2:  10 (lessons learned, archive this task, open the real 0.10.0 task)
```

Item 8 is the checkpoint: if it reveals more pipeline breakage, fix and re-rehearse under `-alpha.2`
before ever touching the real `0.10.0` numbers.
