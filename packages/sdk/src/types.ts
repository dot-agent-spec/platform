// SPDX-License-Identifier: Apache-2.0

import type { AboutMe, AgentBundle, AgentFiles } from '@dot-agent/compiler/core'

export type { AboutMe, AgentBundle, AgentFiles }

export type EffectHandler = (effect: Effect) => void | Promise<void>

export interface Effect {
  type: string
  [key: string]: unknown
}
