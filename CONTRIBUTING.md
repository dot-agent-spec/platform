# Contributing

## Toolchain setup

Install Rust (stable), Node.js ≥ 24 (enforced by the root `engines` field), and npm ≥ 10. Then install
workspace dependencies:

```bash
npm install
```

This is a real monorepo — `packages/*` and `apps/*` are plain npm workspaces, not submodules. There is no
`git submodule update --init` step.

### wasi-stub (required for WASM builds)

The WASM post-processing tool is a local patched fork. Install it once after cloning — and re-run if `tools/wasi-stub/` changes:

```bash
cargo install --path tools/wasi-stub --force
```

### Docker / OrbStack (required for tree-sitter grammar WASM)

`packages/tree-sitter` builds the grammar WASM via `emcc` inside Docker. OrbStack or Docker Desktop must be running when you execute `npm run build` in that package.

The failure is worth recognising, because it does not look like a build problem: `dist/` is never produced, and the next thing you run reports *test* failures — several `apps/dot-agent-cli` files failing to **load** with `Cannot find module …/@dot-agent/tree-sitter/dist/index.cjs`, shown as failed files with zero failing assertions. Start Docker, rebuild, and they pass.

### Rust WASM targets (required for `parser-dsl` and `kernel-dsl`)

Both crates compile to WASM through the shared [`scripts/build-wasm.sh`](scripts/build-wasm.sh) at the
repository root — not a per-package script. It needs `zig` on `$PATH` and `wasm-bindgen-cli`:

```bash
cargo install wasm-bindgen-cli
# zig: https://ziglang.org/download/
```

## Build

The root script builds every package in dependency order:

```bash
npm run build
```

Or build individual packages:

```bash
npm run build --workspace=packages/compiler
cd packages/kernel-dsl && npm run build:debug   # faster, larger WASM binary
```

To check the whole release build without committing or publishing anything:

```bash
node scripts/release.mjs --dry-run
```

## Tests

```bash
# Rust unit tests (native target)
cargo test --workspace

# TypeScript / Node.js tests
npm test --workspaces --if-present
```

## Releases

Publishing is **tag-driven; there is no local `npm publish`.** Versions are bumped and cross-package
dependencies re-pinned on `main`, then a `<package>@<version>` tag is pushed — `tree-sitter@0.4.1`,
`kernel-dsl@0.1.3`, `vscode@0.3.3` — and the matching `publish-*.yml` workflow in
[`.github/workflows/`](.github/workflows/) runs `npm publish --provenance` over OIDC.

The packages depend on each other with exact pins, so a release cascades: bumping a package obliges you to
re-pin and re-release its dependents, in topological order. The full runbook, including the
human-approval gate before any tag is pushed, is the `/publish` skill in
[`.agents/skills/publish/`](.agents/skills/publish/).

The two version axes — the DSL milestone and per-package semver — and the rule that maps one to the other
are in [`ROADMAP.md`](ROADMAP.md).

## Changing a dependency

The root `package.json` carries an `allowScripts` block — npm's install-script allowlist, written by
`npm approve-scripts`. It **pins by exact version**, so bumping any dependency that has an install script
leaves its own approval behind and the new version unreviewed:

```bash
npm approve-scripts <pkg>    # rewrites the stale pin to the installed version
```

Today npm only prints a warning during `npm install` and runs the script anyway. A future npm release
blocks unreviewed install scripts, and for a package like `esbuild` the install script is what puts its
native binary in place — so a stale allowlist is a build break waiting for that release.

Do not try to enforce this in CI with `npm approve-scripts --allow-scripts-pending`. It reports pending
packages on stdout but **exits 0 either way**, so the obvious check passes forever and tells you nothing.

## Licensing and attribution

The project is Apache-2.0. Contributions are licensed under it, and **each contributor keeps copyright
over their own work** — there is no copyright assignment.

Attribution is collective. `LICENSE` reads *"Copyright (c) 2026 The dot-agent Authors"*, and
[`AUTHORS`](AUTHORS) is the list of who that means. **Add yourself to `AUTHORS` in the same commit as your
first contribution**, sorted by first appearance.

Source files carry a one-line SPDX identifier and no per-file copyright line:

```
// SPDX-License-Identifier: Apache-2.0
```

A per-file copyright line goes stale the moment somebody else edits the file, which is why
[ASF's own guidance](https://www.apache.org/legal/src-headers.html) recommends against it and why the
name in a header is never how this project records who wrote what — `AUTHORS` and `git log` are.

CI checks the header on every pull request. If it fails, run `./scripts/ensure-license-headers.sh` from
the repository root. Two paths are excluded and must stay that way: `tools/wasi-stub/` is third-party code
and must never carry our notice, and `generated-*` files are rewritten by their generator.
