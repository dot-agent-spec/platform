#!/bin/bash
# kernel-dsl/scripts/build-wasm.sh
# Build WASM kernel targeting wasm32-wasip1 with Zig CC for C dependencies

# Output colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

TARGET="wasm32-wasip1"

PROFILE_DIR="debug"
CARGO_FLAGS=""
if [ "$RELEASE" = "true" ]; then
    PROFILE_DIR="release"
    CARGO_FLAGS="--release"
fi

echo -e "${BLUE}===> Building WASM Kernel (dot-agent) with Zig CC...${NC}"
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
    "$WORKSPACE_ROOT/target/$TARGET/$PROFILE_DIR/dot_agent_kernel_dsl.wasm"

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] wasm-bindgen failed.${NC}"
    exit 1
fi

echo -e "${GREEN}[SUCCESS] Build complete! Artifacts in kernel-dsl/pkg/${NC}"
