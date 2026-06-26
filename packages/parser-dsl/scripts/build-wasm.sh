#!/bin/bash
# behavior-parser/scripts/build-wasm.sh
# Build WASM behavior parser targeting wasm32-wasip1 with Zig CC for C dependencies.
# wasi-stub post-processes the output to remove WASI imports, making the WASM
# browser-compatible without a shim. Release builds also drop ubsan handlers.

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

echo -e "${BLUE}===> Building WASM behavior-parser (dot-agent) with Zig CC...${NC}"
echo -e "${GREEN}[INFO] Building for $TARGET ($PROFILE_DIR)...${NC}"

cargo build --target $TARGET $CARGO_FLAGS

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Build failed.${NC}"
    exit 1
fi

echo -e "${GREEN}[INFO] Generating JS bindings with wasm-bindgen...${NC}"

if ! command -v wasm-bindgen &> /dev/null; then
    echo -e "${YELLOW}[WARN] wasm-bindgen-cli not found. Installing...${NC}"
    cargo install wasm-bindgen-cli
fi

WORKSPACE_ROOT="$(cd "$(dirname "$0")/../../../" && pwd)"

wasm-bindgen --target bundler \
    --out-dir ./pkg \
    "$WORKSPACE_ROOT/target/$TARGET/$PROFILE_DIR/dot_agent_parser_dsl.wasm"

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] wasm-bindgen failed.${NC}"
    exit 1
fi

echo -e "${GREEN}[INFO] Stubbing WASI imports (browser-compatible output)...${NC}"

if ! command -v wasi-stub &> /dev/null; then
    echo -e "${YELLOW}[WARN] wasi-stub not found. Installing...${NC}"
    cargo install wasi-stub
fi

wasi-stub pkg/dot_agent_parser_dsl_bg.wasm -o pkg/dot_agent_parser_dsl_bg.wasm

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] wasi-stub failed.${NC}"
    exit 1
fi

echo -e "${GREEN}[INFO] Patching wasm-bindgen output...${NC}"
node -e "
const fs = require('fs');
// Remove auto-WASM import from main JS (causes issues with custom loading)
const mainPath = './pkg/dot_agent_parser_dsl.js';
let main = fs.readFileSync(mainPath, 'utf-8');
main = main
  .replace(/import \* as wasm from [\"']\.\/dot_agent_parser_dsl_bg\.wasm[\"'];?\\n/g, '')
  .replace(/import { __wbg_set_wasm } from [\"']\.\/dot_agent_parser_dsl_bg\.js[\"'];?\\n/g, '')
  .replace(/^__wbg_set_wasm\(wasm\);\\n/m, '')
  .replace(/^wasm\.__wbindgen_start\(\);\\n/m, '');
fs.writeFileSync(mainPath, main);
// Fix stale Uint8Array cache after WASM memory.grow
const bgPath = './pkg/dot_agent_parser_dsl_bg.js';
let bg = fs.readFileSync(bgPath, 'utf-8');
const stale = 'if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {';
const fresh = 'if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0 || cachedUint8ArrayMemory0.buffer !== wasm.memory.buffer) {';
if (bg.includes(stale)) { fs.writeFileSync(bgPath, bg.replace(stale, fresh)); }
"

echo -e "${GREEN}[SUCCESS] Build complete! Artifacts in behavior-parser/pkg/${NC}"
