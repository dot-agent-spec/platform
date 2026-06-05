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

declare module '@dot-agent/kernel-dsl' {
  export class AgentDSLKernel {
    constructor()
    get_current_state(): string
    get_graph(): any
    get_memory(): any
    get_valid_intents(): string[]
    load_behavior(text: string): any
    observe(callback: Function): void
    send_complete(): any
    send_event(event: string): any
    send_failed(): any
    send_intent(intent: string): any
    send_offtopic(): any
    set_memory(domain: string, key: string, value_json: string): void
    tick_prompt(): any
    free(): void
  }

  export function init(): Promise<void>
}
