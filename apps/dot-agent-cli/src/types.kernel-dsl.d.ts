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
    send_fallback(): any
    send_intent(intent: string): any
    send_offtopic(): any
    tick_prompt(): any
    free(): void
  }

  export function init(): Promise<void>
}
