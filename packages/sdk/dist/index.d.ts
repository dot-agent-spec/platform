import { AgentBundle } from '@dot-agent/compiler/core';
export { AboutMe, AgentBundle, AgentFiles } from '@dot-agent/compiler/core';

type EffectHandler = (effect: Effect) => void | Promise<void>;
interface Effect {
    type: string;
    [key: string]: unknown;
}

declare function loadAgent(input: Uint8Array | ArrayBuffer): Promise<AgentBundle>;

declare class AgentSession {
    private kernel;
    private handlers;
    private effectListener?;
    readonly bundle: AgentBundle;
    private constructor();
    static create(bundle: AgentBundle): Promise<AgentSession>;
    setFileResolver(resolver: (path: string) => string | null | undefined): void;
    start(): void;
    registerHandler(effectType: string, handler: EffectHandler): void;
    setEffectListener(listener: ((effect: Effect) => void) | undefined): void;
    private dispatchRaw;
    sendIntent(intent: string): void;
    sendEvent(event: string): void;
    sendOfftopic(): void;
    tickPrompt(): void;
    getState(): string;
    getValidIntents(): Array<any>;
    getGraph(): string;
    getMemory(): Array<{
        domain: string;
        key: string;
        value: unknown;
    }>;
    injectMemory(domain: string, key: string, value: string): void;
    dispose(): void;
}

export { AgentSession, type Effect, type EffectHandler, loadAgent };
