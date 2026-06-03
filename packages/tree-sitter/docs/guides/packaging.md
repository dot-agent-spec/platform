# Three-Layer Packaging

The .agent ecosystem uses a three-layer architecture to decouple human-authored logic from machine-managed metadata.

### Layer 1: Human DX (Authoring)
What the developer maintains. Focused on intent and logic.
- **Includes**: `.agent` manifest, `.behavior` flow, `AGENTS.md` (persona).
- **Excluded**: Version tags, file lists, or marketplace categories.
- **Metadata**: Identity (`domain`), `license`, `terms`, and `privacy` are declared here as fundamental compliance data.

### Layer 2: Tooling & AI (The Envelope)
Automatically generated during the build or publish phase.
- **Versioning**: Derived from Git history (e.g., `urn:agent:com.figma:v2:a1b2c3d4`).
- **Categorization**: Inferred by LLMs based on `input`/`output` types (e.g., classifying an agent as `FinanceApplication`).
- **Integrity**: Checksums and file manifests generated to prevent unauthorized modifications.

### Layer 3: Machine (Execution & Registry)
The optimized bundle read by the Runtime OS.
- **Includes**: Transpiled JSON-LD, WASM binaries, and the merged manifest for discovery.
