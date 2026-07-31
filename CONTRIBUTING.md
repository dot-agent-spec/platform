# Contributing

## Toolchain setup

Install Rust (stable), Node.js ≥ 20, and npm ≥ 10. Then install workspace dependencies:

```bash
npm install
```

### wasi-stub (required for WASM builds)

The WASM post-processing tool is a local patched fork. Install it once after cloning — and re-run if `tools/wasi-stub/` changes:

```bash
cargo install --path tools/wasi-stub --force
```

### Docker / OrbStack (required for tree-sitter grammar WASM)

`packages/tree-sitter` builds the grammar WASM via `emcc` inside Docker. OrbStack or Docker Desktop must be running when you execute `npm run build` in that package.

The failure is worth recognising, because it does not look like a build problem: `dist/` is never produced, and the next thing you run reports *test* failures — several `apps/dot-agent-cli` files failing to **load** with `Cannot find module …/@dot-agent/tree-sitter/dist/index.cjs`, shown as failed files with zero failing assertions. Start Docker, rebuild, and they pass.

## Build

Each package has a `build` script. To build everything in dependency order, run the release script in check mode (no commits, no publish):

```bash
node scripts/release.mjs --dry-run
```

Or build individual packages:

```bash
cd packages/kernel-dsl && npm run build
cd packages/compiler && npm run build
```

## Tests

```bash
# Rust unit tests (native target)
cargo test --workspace

# TypeScript / Node.js tests
npm test --workspaces --if-present
```

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
