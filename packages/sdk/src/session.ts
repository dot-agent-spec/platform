// SPDX-License-Identifier: Apache-2.0

import { AgentDSLKernel, init as initKernel } from '@dot-agent/kernel-dsl'
import type { AgentBundle, Effect, EffectHandler } from './types.js'

export class AgentSession {
  private kernel: AgentDSLKernel
  private handlers = new Map<string, EffectHandler>()
  private effectListener?: (effect: Effect) => void
  readonly bundle: AgentBundle

  private constructor(kernel: AgentDSLKernel, bundle: AgentBundle) {
    this.kernel = kernel
    this.bundle = bundle
  }

  static async create(bundle: AgentBundle): Promise<AgentSession> {
    await initKernel()
    const kernel = new AgentDSLKernel()
    return new AgentSession(kernel, bundle)
  }

  // Register a synchronous fallback for a file path the kernel was not handed: a `merge "…"` path
  // absent from the bundle (where returning nothing fails the load), and a `teach`/`guide` path
  // absent from the content map (where it just leaves `content` null). Must be called before
  // start(). Return null/undefined if the path cannot be resolved.
  //
  // The path arrives normalized as the packer normalizes it — leading `./` stripped, `\` turned
  // into `/` — so it is the bundle key rather than the literal DSL argument. Inline prose never
  // reaches the resolver: only text ending in `.txt`/`.md` is offered to it.
  setFileResolver(resolver: (path: string) => string | null | undefined): void {
    this.kernel.set_file_resolver(resolver as unknown as Function)
  }

  // Call after registerHandler() — loads the behavior and fires initial effects.
  // Passes all merged behavior files as a bundle so the kernel can resolve `merge "…"` paths, and
  // the knowledge/guide files separately so `teach`/`guide` effects arrive with their `content`
  // filled in beside the path (the path itself is never replaced).
  //
  // `resolveContent: false` skips that second half, and a host wants it when it serves the files
  // itself: the CLI's MCP server hands the path on as a `dot-agent://<path>` resource URI and lets
  // the LLM host fetch it when it needs it. Resolving for such a host would inline every knowledge
  // file into every effect payload it forwards — the exact cost the lazy fetch exists to avoid.
  start(options: { resolveContent?: boolean } = {}): void {
    const bundle: Record<string, string> = {}
    for (const { path, content } of this.bundle.files.behaviors) {
      bundle[path] = content
    }
    if (options.resolveContent !== false) {
      const contentFiles: Record<string, string> = {}
      const named = [...(this.bundle.files.knowledge ?? []), ...(this.bundle.files.guides ?? [])]
      for (const { path, content } of named) {
        contentFiles[path] = content
      }
      this.kernel.set_content_files(JSON.stringify(contentFiles))
    }
    this.dispatchRaw(
      this.kernel.load_behavior_with_bundle(
        this.bundle.files.behavior,
        JSON.stringify(bundle),
      )
    )
  }

  registerHandler(effectType: string, handler: EffectHandler): void {
    this.handlers.set(effectType, handler)
  }

  setEffectListener(listener: ((effect: Effect) => void) | undefined): void {
    this.effectListener = listener
  }

  private dispatchRaw(raw: string): void {
    if (!raw) return
    let effects: Effect[]
    try {
      effects = JSON.parse(raw)
    } catch {
      console.error('[AgentSession] failed to parse effects JSON:', raw)
      return
    }
    if (!Array.isArray(effects)) return
    for (const effect of effects) {
      this.effectListener?.(effect)
      const handler = this.handlers.get(effect.type)
      if (handler) {
        Promise.resolve(handler(effect)).catch(err => {
          console.error(`[AgentSession] handler error for effect "${effect.type}":`, err)
        })
      }
    }
  }

  sendIntent(intent: string): void  { this.dispatchRaw(this.kernel.send_intent(intent)) }
  sendEvent(event: string): void    { this.dispatchRaw(this.kernel.send_event(event)) }
  sendOfftopic(): void              { this.dispatchRaw(this.kernel.send_offtopic()) }
  tickPrompt(): void                { this.dispatchRaw(this.kernel.tick_prompt()) }

  getState(): string            { return this.kernel.get_current_state() }
  getValidIntents(): Array<any> { return this.kernel.get_valid_intents() }
  getGraph(): string            { return this.kernel.get_graph() }
  getMemory(): Array<{ domain: string; key: string; value: unknown }> {
    return JSON.parse(this.kernel.get_memory())
  }

  injectMemory(domain: string, key: string, value: string): void {
    this.kernel.set_memory(domain, key, value)
  }

  dispose(): void { this.kernel.free() }
}
