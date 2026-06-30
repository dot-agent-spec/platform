#!/bin/bash
# scripts/build-wasm.sh <CRATE_NAME>
# Centralised WASM build for dot-agent packages. Must be run from the package directory.
# Usage (e.g. from packages/parser-dsl/): bash ../../scripts/build-wasm.sh dot_agent_parser_dsl

CRATE_NAME="${1:?Usage: build-wasm.sh <crate_name> (e.g. dot_agent_parser_dsl)}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

TARGET="wasm32-wasip1"
PROFILE_DIR="debug"
CARGO_FLAGS=""
if [ "$RELEASE" = "true" ]; then
    PROFILE_DIR="release"
    CARGO_FLAGS="--release"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}===> Building WASM (${CRATE_NAME}) targeting ${TARGET}...${NC}"

cargo build --target $TARGET $CARGO_FLAGS

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] cargo build failed.${NC}"
    exit 1
fi

echo -e "${GREEN}[INFO] Generating JS bindings with wasm-bindgen...${NC}"

if ! command -v wasm-bindgen &> /dev/null; then
    echo -e "${YELLOW}[WARN] wasm-bindgen-cli not found. Installing...${NC}"
    cargo install wasm-bindgen-cli
fi

wasm-bindgen --target bundler \
    --out-dir ./pkg \
    "$WORKSPACE_ROOT/target/$TARGET/$PROFILE_DIR/${CRATE_NAME}.wasm"

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] wasm-bindgen failed.${NC}"
    exit 1
fi

echo -e "${GREEN}[INFO] Stubbing WASI imports (browser-compatible output)...${NC}"

if ! command -v wasi-stub &> /dev/null; then
    echo -e "${YELLOW}[WARN] wasi-stub not found. Installing...${NC}"
    cargo install wasi-stub
fi

wasi-stub "pkg/${CRATE_NAME}_bg.wasm" -o "pkg/${CRATE_NAME}_bg.wasm"

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] wasi-stub failed.${NC}"
    exit 1
fi

echo -e "${GREEN}[INFO] Patching wasm-bindgen output...${NC}"
node -e "
const fs = require('fs');
const mainPath = './pkg/${CRATE_NAME}.js';
let main = fs.readFileSync(mainPath, 'utf-8');
main = main
  .replace(/import \* as wasm from [\"']\.\/${CRATE_NAME}_bg\.wasm[\"'];?\\n/g, '')
  .replace(/import { __wbg_set_wasm } from [\"']\.\/${CRATE_NAME}_bg\.js[\"'];?\\n/g, '')
  .replace(/^__wbg_set_wasm\(wasm\);\\n/m, '')
  .replace(/^wasm\.__wbindgen_start\(\);\\n/m, '');
fs.writeFileSync(mainPath, main);
const bgPath = './pkg/${CRATE_NAME}_bg.js';
let bg = fs.readFileSync(bgPath, 'utf-8');
const stale = 'if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {';
const fresh = 'if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0 || cachedUint8ArrayMemory0.buffer !== wasm.memory.buffer) {';
if (bg.includes(stale)) { fs.writeFileSync(bgPath, bg.replace(stale, fresh)); }
"

echo -e "${GREEN}[SUCCESS] Build complete! Artifacts in pkg/${NC}"
