"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AgentSession: () => AgentSession,
  loadAgent: () => loadAgent
});
module.exports = __toCommonJS(index_exports);

// src/load.ts
var import_jszip = __toESM(require("jszip"), 1);
var import_core = require("@dot-agent/compiler/core");
async function loadAgent(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  (0, import_core.validateMagicBytes)(bytes);
  const zip = await import_jszip.default.loadAsync(bytes);
  (0, import_core.validateZipBomb)(zip, bytes.length);
  const aboutmeFile = zip.file(".agent/aboutme.json");
  if (!aboutmeFile) throw new Error("Missing .agent/aboutme.json in bundle");
  const aboutme = (0, import_core.parseAboutme)(JSON.parse(await aboutmeFile.async("text")));
  const filesJsonFile = zip.file(".agent/files.json");
  if (!filesJsonFile) throw new Error("Missing .agent/files.json in bundle");
  const filesJson = JSON.parse(await filesJsonFile.async("text"));
  const descFile = zip.file(filesJson.description);
  const behavFile = zip.file(filesJson.behavior);
  if (!descFile) throw new Error(`Missing ${filesJson.description} in bundle`);
  if (!behavFile) throw new Error(`Missing ${filesJson.behavior} in bundle`);
  const soulFile = zip.file("SOUL.md");
  const allFiles = await (0, import_core.extractFiles)(zip);
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
var import_kernel_dsl = require("@dot-agent/kernel-dsl");
var AgentSession = class _AgentSession {
  kernel;
  handlers = /* @__PURE__ */ new Map();
  effectListener;
  bundle;
  constructor(kernel, bundle) {
    this.kernel = kernel;
    this.bundle = bundle;
  }
  static async create(bundle) {
    await (0, import_kernel_dsl.init)();
    const kernel = new import_kernel_dsl.AgentDSLKernel();
    return new _AgentSession(kernel, bundle);
  }
  // Register a synchronous fallback called when a `merge "…"` path is not in the bundle.
  // Must be called before start(). Return null/undefined if the path cannot be resolved.
  setFileResolver(resolver) {
    this.kernel.set_file_resolver(resolver);
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
  setEffectListener(listener) {
    this.effectListener = listener;
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
      this.effectListener?.(effect);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentSession,
  loadAgent
});
//# sourceMappingURL=index.cjs.map