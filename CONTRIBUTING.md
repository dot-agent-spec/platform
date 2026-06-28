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
