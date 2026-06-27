// src/load.ts
import JSZip from "jszip";
import { parseAboutme, extractFiles } from "@dot-agent/compiler/core";
var MAX_ZIP_SIZE = 500 * 1024 * 1024;
var MAX_COMPRESSION_RATIO = 100;
function validateMagicBytes(bytes) {
  if (!(bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4)) {
    throw new Error("Not a valid .agent file (invalid magic bytes)");
  }
}
function validateZipBomb(zip, compressedSize) {
  let totalUncompressed = 0;
  zip.forEach((_path, file) => {
    if (!file.dir) totalUncompressed += file._data?.uncompressedSize || 0;
  });
  if (totalUncompressed > MAX_ZIP_SIZE) {
    throw new Error(`Bundle exceeds 500MB uncompressed: ${totalUncompressed}`);
  }
  if (totalUncompressed / compressedSize > MAX_COMPRESSION_RATIO) {
    throw new Error(`Compression ratio exceeds 100x: ${(totalUncompressed / compressedSize).toFixed(1)}x`);
  }
}
async function loadAgent(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  validateMagicBytes(bytes);
  const zip = await JSZip.loadAsync(bytes);
  validateZipBomb(zip, bytes.length);
  const aboutmeFile = zip.file(".agent/aboutme.json");
  if (!aboutmeFile) throw new Error("Missing .agent/aboutme.json in bundle");
  const aboutme = parseAboutme(JSON.parse(await aboutmeFile.async("text")));
  const filesJsonFile = zip.file(".agent/files.json");
  if (!filesJsonFile) throw new Error("Missing .agent/files.json in bundle");
  const filesJson = JSON.parse(await filesJsonFile.async("text"));
  const descFile = zip.file(filesJson.description);
  const behavFile = zip.file(filesJson.behavior);
  if (!descFile) throw new Error(`Missing ${filesJson.description} in bundle`);
  if (!behavFile) throw new Error(`Missing ${filesJson.behavior} in bundle`);
  const soulFile = zip.file("SOUL.md");
  const allFiles = await extractFiles(zip);
  const guides = [];
  const knowledge = [];
  const behaviors = [];
  for (const [path, content] of allFiles) {
    if (path.startsWith("guides/") && path !== "guides/.gitkeep") {
      guides.push({ path, content });
    } else if (path.startsWith("knowledge/") && path !== "knowledge/.gitkeep") {
      knowledge.push({ path, content });
    } else if (path.startsWith("behaviors/") && path !== "behaviors/.gitkeep") {
      behaviors.push({ path, content });
    }
  }
  return {
    id: aboutme.id,
    aboutme,
    files: {
      description: await descFile.async("text"),
      behavior: await behavFile.async("text"),
      soul: soulFile ? await soulFile.async("text") : void 0,
      guides,
      knowledge,
      behaviors
    }
  };
}

// src/session.ts
import { AgentDSLKernel, init as initKernel } from "@dot-agent/kernel-dsl";
var AgentSession = class _AgentSession {
  kernel;
  handlers = /* @__PURE__ */ new Map();
  bundle;
  constructor(kernel, bundle) {
    this.kernel = kernel;
    this.bundle = bundle;
  }
  static async create(bundle) {
    await initKernel();
    const kernel = new AgentDSLKernel();
    return new _AgentSession(kernel, bundle);
  }
  // Call after registerHandler() — loads the behavior and fires initial effects.
  // Passes all merged behavior files as a bundle so the kernel can resolve `merge "…"` paths.
  start() {
    const bundle = {};
    for (const { path, content } of this.bundle.files.behaviors) {
      bundle[path] = content;
    }
    this.dispatchRaw(
      this.kernel.load_behavior_with_bundle(
        this.bundle.files.behavior,
        JSON.stringify(bundle)
      )
    );
  }
  registerHandler(effectType, handler) {
    this.handlers.set(effectType, handler);
  }
  dispatchRaw(raw) {
    if (!raw) return;
    let effects;
    try {
      effects = JSON.parse(raw);
    } catch {
      console.error("[AgentSession] failed to parse effects JSON:", raw);
      return;
    }
    if (!Array.isArray(effects)) return;
    for (const effect of effects) {
      const handler = this.handlers.get(effect.type);
      if (handler) {
        Promise.resolve(handler(effect)).catch((err) => {
          console.error(`[AgentSession] handler error for effect "${effect.type}":`, err);
        });
      }
    }
  }
  sendIntent(intent) {
    this.dispatchRaw(this.kernel.send_intent(intent));
  }
  sendEvent(event) {
    this.dispatchRaw(this.kernel.send_event(event));
  }
  sendOfftopic() {
    this.dispatchRaw(this.kernel.send_offtopic());
  }
  tickPrompt() {
    this.dispatchRaw(this.kernel.tick_prompt());
  }
  getState() {
    return this.kernel.get_current_state();
  }
  getValidIntents() {
    return this.kernel.get_valid_intents();
  }
  getGraph() {
    return this.kernel.get_graph();
  }
  getMemory() {
    return JSON.parse(this.kernel.get_memory());
  }
  injectMemory(domain, key, value) {
    this.kernel.set_memory(domain, key, value);
  }
  dispose() {
    this.kernel.free();
  }
};
export {
  AgentSession,
  loadAgent
};
//# sourceMappingURL=index.js.map