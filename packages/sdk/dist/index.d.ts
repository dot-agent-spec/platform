import { AboutMe } from '@dot-agent/compiler/core';
export { AboutMe } from '@dot-agent/compiler/core';

interface AgentFiles {
    description: string;
    behavior: string;
    soul?: string;
    guides: Array<{
        path: string;
        content: string;
    }>;
    knowledge: Array<{
        path: string;
        content: string;
    }>;
    behaviors: Array<{
        path: string;
        content: string;
    }>;
}
interface AgentBundle {
    id: string;
    aboutme: AboutMe;
    files: AgentFiles;
}
type EffectHandler = (effect: Effect) => void | Promise<void>;
interface Effect {
    type: string;
    [key: string]: unknown;
}

declare function loadAgent(input: Uint8Array | ArrayBuffer): Promise<AgentBundle>;

declare class AgentSession {
    private kernel;
    private handlers;
    readonly bundle: AgentBundle;
    private constructor();
    static create(bundle: AgentBundle): Promise<AgentSession>;
    start(): void;
    registerHandler(effectType: string, handler: EffectHandler): void;
    private dispatchRaw;
    sendIntent(intent: string): void;
    sendEvent(event: string): void;
    sendComplete(): void;
    sendFailed(): void;
    sendOfftopic(): void;
    tickPrompt(): void;
    getState(): string;
    getValidIntents(): Array<any>;
    getGraph(): string;
    injectMemory(domain: string, key: string, value: string): void;
    dispose(): void;
}

export { type AgentBundle, type AgentFiles, AgentSession, type Effect, type EffectHandler, loadAgent };
