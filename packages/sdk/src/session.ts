// SPDX-License-Identifier: Apache-2.0

import { AgentDSLKernel, init as initKernel } from '@dot-agent/kernel-dsl'
import type { AgentBundle, Effect, EffectHandler } from './types.js'
import {
  SNAPSHOT_FORMAT,
  SNAPSHOT_VERSION,
  encodeMemoryValue,
  readSnapshot,
  type AgentSnapshot,
  type MemoryEntry,
  type SnapshotBody,
} from './snapshot.js'

export interface StartOptions {
  /** Hand the bundle's knowledge/guide files to the kernel so teach/guide effects carry content. Default true. */
  resolveContent?: boolean
}

type Lifecycle = 'created' | 'started' | 'restored'

export class AgentSession {
  private kernel: AgentDSLKernel
  private handlers = new Map<string, EffectHandler>()
  private effectListener?: (effect: Effect) => void
  private fileResolver?: (path: string) => string | null | undefined
  private lifecycle: Lifecycle = 'created'
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
  // For the teach/guide case, the path arrives normalized as the packer normalizes it — leading
  // `./` stripped, `\` turned into `/` — so it is the bundle key rather than the literal DSL
  // argument, and inline prose never reaches the resolver: only text ending in `.txt`/`.md` is
  // offered to it. The merge case gets none of that: the kernel passes the literal `merge "…"`
  // argument as written, unnormalized and with whatever extension the author gave it (typically
  // `.behavior`) — do not gate on `.txt`/`.md` or assume a stripped leading `./` there.
  setFileResolver(resolver: (path: string) => string | null | undefined): void {
    this.fileResolver = resolver
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
  //
  // A session restored from a snapshot has already been started by restore(): calling start() on
  // it throws, because reloading would re-enter the init state and discard the restored position.
  start(options: StartOptions = {}): void {
    if (this.lifecycle === 'restored') {
      throw new Error(
        'AgentSession.start: the session was already restored from a snapshot — restore() replaces start()',
      )
    }
    this.lifecycle = 'started'
    this.dispatchRaw(this.loadBehavior(options))
  }

  // Load the behavior into the kernel and return the raw effects of entering the init state.
  private loadBehavior(options: StartOptions): string {
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
    return this.kernel.load_behavior_with_bundle(
      this.bundle.files.behavior,
      JSON.stringify(bundle),
    )
  }

  // Capture the session — FSM position, prompt count and memory — as a JSON-serialisable value.
  // Store it however you like (JSON.stringify it), and hand it to restore() on a fresh session
  // created from the same bundle. The value is opaque: only its JSON-serialisability is contract.
  // Throws before start() or restore(), and after a start() whose behavior failed to parse —
  // either way there is no position to capture, and a snapshot of it would be refused by every
  // restore. start() itself keeps reporting a parse failure as a `parse_error` effect.
  snapshot(): AgentSnapshot {
    if (this.lifecycle === 'created') {
      throw new Error('AgentSession.snapshot: the session has not started — call start() or restore() first')
    }
    if (this.kernel.get_current_state() === '') {
      throw new Error(
        'AgentSession.snapshot: no behavior loaded — start() reported a parse_error, so there is no position to capture',
      )
    }
    const body: SnapshotBody = {
      format: SNAPSHOT_FORMAT,
      v: SNAPSHOT_VERSION,
      agent: this.bundle.id,
      kernel: this.kernel.serialize_state(),
      memory: this.readMemoryEntries(),
    }
    return body as unknown as AgentSnapshot
  }

  // Rehydrate from a snapshot() value, in place of start(). Takes start()'s options, since the
  // content map is handed to the kernel on load either way.
  //
  // Follows the kernel's sequence — load the behavior, discard the init state's entry effects
  // (they describe a state the session already left, so no handler or listener sees them),
  // clear the memory that load wrote, reposition the FSM, then write the snapshot's memory back.
  // The restored memory is exactly the snapshot's: memory injected before restore() is replaced.
  // Nothing is emitted: the host resumes by sending the next intent, event or prompt tick.
  //
  // Throws, leaving the session unstarted and usable for start() — with any memory injected
  // before the call still in place — when the snapshot is malformed, carries a version this SDK
  // or kernel does not read, was taken from a different agent or a revision whose state graph
  // changed, or names a state the behavior does not declare, and when the behavior fails to
  // parse. Throws too when the session has already been started or restored.
  restore(snapshot: AgentSnapshot, options: StartOptions = {}): void {
    if (this.lifecycle !== 'created') {
      throw new Error(
        'AgentSession.restore: the session has already started — restore only a session fresh from AgentSession.create()',
      )
    }
    const body = readSnapshot(snapshot)
    if (body.agent !== this.bundle.id) {
      throw new Error(
        `AgentSession.restore: snapshot belongs to a different agent ("${body.agent}", this session runs "${this.bundle.id}")`,
      )
    }
    const memoryBefore = this.readMemoryEntries()
    try {
      const loadEffects = this.loadBehavior(options)
      const parseError = findParseError(loadEffects)
      if (parseError !== undefined) {
        throw new Error(`AgentSession.restore: the behavior failed to load — ${parseError}`)
      }
      this.kernel.clear_memory()
      try {
        this.kernel.restore_state(body.kernel)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(`AgentSession.restore: the kernel refused the snapshot — ${message}`, { cause: err })
      }
      this.writeMemoryEntries(body.memory)
    } catch (err) {
      // The load has already put a behavior in the kernel, and the kernel has no call to unload
      // one: a fresh kernel is the only way back to "unstarted". Memory injected before the call
      // is carried across, so a refused restore changes nothing the host can observe.
      this.resetKernel()
      this.writeMemoryEntries(memoryBefore)
      throw err
    }
    this.lifecycle = 'restored'
  }

  private resetKernel(): void {
    this.kernel.free()
    this.kernel = new AgentDSLKernel()
    if (this.fileResolver) this.kernel.set_file_resolver(this.fileResolver as unknown as Function)
  }

  private writeMemoryEntries(entries: MemoryEntry[]): void {
    for (const { domain, key, value } of entries) {
      this.kernel.set_memory(domain, key, encodeMemoryValue(value))
    }
  }

  // The kernel's get_memory() answers `{ entries: [...] }`; accept a bare array too.
  private readMemoryEntries(): MemoryEntry[] {
    const raw = JSON.parse(this.kernel.get_memory()) as MemoryEntry[] | { entries: MemoryEntry[] }
    return Array.isArray(raw) ? raw : raw.entries
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

function findParseError(raw: string): string | undefined {
  try {
    const effects = JSON.parse(raw) as Effect[]
    const found = Array.isArray(effects) ? effects.find(e => e.type === 'parse_error') : undefined
    return found ? String(found.message ?? 'parse error') : undefined
  } catch {
    return undefined
  }
}
