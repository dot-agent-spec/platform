// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { AgentDSLKernel, init as initKernel } from '@dot-agent/kernel-dsl'
import type { AgentBundle, Effect, EffectHandler } from './types.js'

export class AgentSession {
  private kernel: AgentDSLKernel
  private handlers = new Map<string, EffectHandler>()
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

  // Call after registerHandler() — loads the behavior and fires initial effects.
  start(): void {
    this.dispatchRaw(this.kernel.load_behavior(this.bundle.files.behavior))
  }

  registerHandler(effectType: string, handler: EffectHandler): void {
    this.handlers.set(effectType, handler)
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
  sendComplete(): void              { this.dispatchRaw(this.kernel.send_complete()) }
  sendFailed(): void                { this.dispatchRaw(this.kernel.send_failed()) }
  sendOfftopic(): void              { this.dispatchRaw(this.kernel.send_offtopic()) }
  tickPrompt(): void                { this.dispatchRaw(this.kernel.tick_prompt()) }

  getState(): string            { return this.kernel.get_current_state() }
  getValidIntents(): Array<any> { return this.kernel.get_valid_intents() }
  getGraph(): string            { return this.kernel.get_graph() }

  injectMemory(domain: string, key: string, value: string): void {
    this.kernel.set_memory(domain, key, value)
  }

  dispose(): void { this.kernel.free() }
}
