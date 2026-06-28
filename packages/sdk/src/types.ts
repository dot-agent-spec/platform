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

import type { AboutMe, AgentBundle, AgentFiles } from '@dot-agent/compiler/core'

export type { AboutMe, AgentBundle, AgentFiles }

export type EffectHandler = (effect: Effect) => void | Promise<void>

export interface Effect {
  type: string
  [key: string]: unknown
}
