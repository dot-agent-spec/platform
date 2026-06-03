# @dot-agent/kernel-dsl — API Reference

← Back to [README.md](README.md) for architecture overview and build instructions.

## The two-sided contract

The kernel works like a native WebAssembly module with an **import object**: JS provides functions that WASM calls, and WASM provides functions that JS calls. Neither side is passive.

```
┌─────────────────────────────────────────────────────────┐
│                    JS / LLM Runtime                     │
│                                                         │
│  load_behavior() send_intent() send_event() tick_prompt()│
│       │              │             │             │       │
│       ▼              ▼             ▼             ▼       │
│  ┌─────────────────────────────────────────────────┐    │
│  │           @dot-agent/kernel-dsl (WASM)          │    │
│  │                    FSM                          │    │
│  └─────────────────────────────────────────────────┘    │
│       │              │             │             │       │
│       ▼              ▼             ▼             ▼       │
│   goal()         guide()      run_script()  transition() │
│   teach()    request_interact()  run_tool()  set_memory()│
│                                                         │
│  ← observer callback receives each effect above         │
└─────────────────────────────────────────────────────────┘
```

### Effect categories

| Category | Effects | Who must act |
|----------|---------|-------------|
| **LLM directives** | `goal`, `guide`, `teach` | LLM runtime — must inject into model context |
| **Interaction control** | `request_interact` | LLM runtime — must pause and wait for user input |
| **Execution** | `run_script`, `run_subagent`, `run_tool` | JS runtime — must execute and call `send_event` when done |
| **UI** | `apply_css`, `remove_css`, `apply_html`, `remove_html`, `apply_video`, `remove_video` | UI layer — must apply changes to the DOM/renderer |
| **Informational** | `transition`, `set_memory`, `parse_error` | Optional — JS may observe for logging, debugging, or derived state |

Without handling the **LLM directives** and **execution** categories, a loaded flow produces no observable behavior.

---

## Observer setup

Register before loading any behavior. The observer is the equivalent of the `importObject` in a raw `WebAssembly.instantiateStreaming` call:

```typescript
const engine = new AgentDSLKernel();

engine.observe((effect: Effect) => {
  switch (effect.type) {
    case "goal":             handleGoal(effect.text); break;
    case "guide":            handleGuide(effect.text); break;
    case "teach":            handleTeach(effect.text); break;
    case "request_interact": handleInteract(effect.requiring); break;
    case "run_script":       handleScript(effect); break;
    case "run_subagent":     handleSubagent(effect); break;
    case "run_tool":         handleTool(effect); break;
    case "apply_css":        injectCss(effect.value); break;
    case "transition":       onStateChange(effect.from, effect.to); break;
    // …
  }
});
```

- The callback is called **once per Effect**, not once per action.
- Only one observer at a time; calling `observe()` again replaces the previous one.
- Effects are also returned as an array from each method (for imperative use). Both channels fire simultaneously.

---

## JS → WASM (exports)

### `new AgentDSLKernel()`

Instantiates the engine with no loaded flow. Register an observer before calling `load_behavior`.

---

### `observe(callback: (effect: Effect) => void): void`

Registers the observer. This is the **required integration point** — without it, all WASM→JS directives are silently dropped.

```typescript
engine.observe((effect) => { /* handle each effect */ });
```

---

### `load_behavior(text: string): Effect[]`

Parses a `.flow` DSL string and initializes the FSM to the first declared state. Fires the observer with the entry effects of that state (typically `goal` + `request_interact`).

```typescript
const effects = engine.load_behavior(`
state welcome
  goal "Help the user get started"
  guide "You are an onboarding assistant."
  interact
  on intent "continue" next setup
`);
// observer fires: goal → guide → request_interact
// effects === [{ type: "goal", text: "…" }, { type: "guide", text: "…" }, { type: "request_interact", requiring: null }]
```

On parse error, fires and returns `[{ type: "parse_error", message: "…" }]`.

---

### `send_intent(intent: string): Effect[]`

Dispatches an intent name to the current state's `on intent` handlers. Call this after the LLM classifies a user message into one of the declared intents.

```typescript
// LLM classified user input as "continue"
const effects = engine.send_intent("continue");
// observer fires: transition → goal (of new state) → …
```

If no handler matches, returns `[]` and the state does not change.

**The valid intents for the current state are available via `get_valid_intents()`** — pass them to the LLM classifier as the allowed output set.

---

### `send_escape(): Effect[]`

Fires the current state's `on escape` block. Call when the user explicitly breaks out of the current flow (e.g. types `/exit`, presses Escape, or navigates away).

```typescript
engine.send_escape();
```

---

### `send_fallback(): Effect[]`

Fires the current state's `on fallback` block. Call when the runtime cannot fulfil a required action (e.g. a tool call fails, a subagent is unavailable).

```typescript
engine.send_fallback();
```

---

### `send_event(event: string): Effect[]`

Fires any top-level `on event "name"` trigger whose name matches. Use this to notify the FSM when async operations complete.

```typescript
// After run_script finishes:
engine.send_event("script.done");

// After session ends:
engine.send_event("session.ended");
```

---

### `tick_prompt(): Effect[]`

Increments the internal prompt counter and fires any `after N prompts` handlers in the current state that match the new count. Call once per LLM completion turn.

```typescript
// After every LLM response is processed:
engine.tick_prompt();
```

---

### `get_current_state(): string`

Returns the name of the current state. Useful for debugging and for persisting flow position across page reloads.

---

### `get_valid_intents(): string[]`

Returns the intent names declared in the current state (`on intent "…"`). Pass this list to the LLM classifier as the constrained output set so the model only outputs intents the FSM can handle.

```typescript
const intents = engine.get_valid_intents();
// ["continue", "skip", "help"]
// → send to LLM: "Classify the user's message as one of: continue, skip, help"
```

---

### `get_memory(): MemEntry[]`

Returns a flat array of all memory entries across all domains.

```typescript
type MemEntry = { domain: string; key: string; value: string | number | boolean | null };
const mem = engine.get_memory();
// [{ domain: "session", key: "lang", value: "pt" }, …]
```

---

### `set_memory(domain: string, key: string, value_json: string): void`

Writes a value into the memory store from JS. `value_json` must be a JSON primitive serialized as a string.

```typescript
engine.set_memory("session", "lang", '"pt"');
engine.set_memory("session", "turn_count", "3");
engine.set_memory("context", "confirmed", "true");
```

---

### `get_graph(): GraphInfo | null`

Returns the state graph for visualization. Returns `null` if no flow is loaded.

```typescript
type GraphInfo = {
  states: string[];
  transitions: Array<{ from: string; to: string; label: string }>;
  current: string;
};
```

---

## WASM → JS (required handlers)

These are the effects the WASM fires through the observer. Each one represents a directive that the JS/LLM runtime **must** implement for the flow to have any effect.

---

### `{ type: "goal", text: string }`

**What it is:** Sets the active goal for the current state. This text defines what the LLM should be trying to achieve during this state.

**What JS must do:** Inject `text` into the LLM's system prompt or context as the active goal. This orients the model's behavior for the duration of the state.

```typescript
case "goal":
  llm.setSystemContext({ role: "goal", content: effect.text });
  break;
```

---

### `{ type: "guide", text: string }`

**What it is:** A behavioral constraint or instruction for the LLM specific to this moment in the flow.

**What JS must do:** Inject `text` into the LLM's context — typically as a system message or a high-priority prompt injection. Unlike `goal` (which is persistent for the state), `guide` may be injected transiently (e.g. prefixed to the next user turn).

```typescript
case "guide":
  llm.prependInstruction(effect.text);
  break;
```

---

### `{ type: "teach", text: string }`

**What it is:** Knowledge or reference material the LLM should have access to.

**What JS must do:** Load `text` into the LLM's context — via prompt injection, context cache (e.g. Anthropic's prompt caching), RAG retrieval pre-population, or a function call result. The mechanism depends on the runtime; the intent is to enrich the model's knowledge for this state.

```typescript
case "teach":
  await llm.loadContextCache(effect.text);
  break;
```

---

### `{ type: "request_interact", requiring: string | null }`

**What it is:** The flow has reached an interactive state and is waiting for user input.

**What JS must do:** Enable the input UI and wait for the user's next message. If `requiring` is non-null, it's a constraint on what the user must provide (e.g. `"a file upload"`, `"a yes/no answer"`).

After receiving user input, classify it with the LLM using `get_valid_intents()` as the allowed set, then call `send_intent(classifiedIntent)`.

```typescript
case "request_interact":
  ui.enableInput({ hint: effect.requiring });
  break;
```

---

### `{ type: "run_script", target: string, label: string | null, silent: boolean }`

**What it is:** Execute a script module. `target` is a file path or module identifier. `label` is an optional human-readable name for logging.

**What JS must do:** Dynamically import or execute the script. When complete (or on failure), notify the FSM:

```typescript
case "run_script":
  try {
    const mod = await import(effect.target);
    await mod.default({ engine, memory: engine.get_memory() });
    engine.send_event("script.done");
  } catch {
    engine.send_fallback();
  }
  break;
```

If `silent` is `true`, suppress any UI output the script might produce.

---

### `{ type: "run_subagent", target: string, label: string | null, background: boolean }`

**What it is:** Spawn a sub-agent defined by the `.flow` or `.agent` file at `target`.

**What JS must do:** Instantiate a new `AgentDSLKernel` with the referenced flow (or delegate to the agent runtime), run it to completion, and notify the parent FSM:

```typescript
case "run_subagent":
  if (effect.background) {
    spawnDetached(effect.target).then(() => engine.send_event("subagent.done"));
  } else {
    await runSubagent(effect.target);
    engine.send_event("subagent.done");
  }
  break;
```

---

### `{ type: "run_tool", target: string, label: string | null }`

**What it is:** Invoke a tool (MCP tool, function call, API endpoint). `target` is the tool name or identifier.

**What JS must do:** Call the tool through the appropriate mechanism (MCP client, function call API, direct HTTP). Pass results back to the LLM context and notify the FSM:

```typescript
case "run_tool":
  const result = await mcpClient.call(effect.target, currentArgs);
  llm.addToolResult(effect.target, result);
  engine.send_event("tool.done");
  break;
```

---

### `{ type: "apply_css", value: string }` / `{ type: "remove_css", value: string }`

Inject or remove a CSS class or style string from the UI. `value` is the class name or inline style.

---

### `{ type: "apply_html", value: string }` / `{ type: "remove_html", value: string }`

Inject or remove an HTML fragment or component identifier into the UI.

---

### `{ type: "apply_video", value: string }` / `{ type: "remove_video", value: string }`

Start or stop a video resource identified by `value`.

---

## Informational effects (no action required)

### `{ type: "transition", from: string, to: string }`

The FSM moved from state `from` to state `to`. Use for logging, analytics, or updating the Flow Graph display.

### `{ type: "set_memory", domain: string, key: string, value: … }`

A memory write occurred inside the FSM (from a `set` statement). Use to mirror memory state in JS if needed.

### `{ type: "parse_error", message: string }`

The `.flow` text could not be parsed. Log `message` and prevent further execution.

---

## Memory domains

| Domain | Lifetime | Cleared by | Typical use |
|--------|----------|------------|-------------|
| `context` | Current LLM turn | Runtime per turn | Active working data for the current response |
| `session` | Conversation thread | Session end | Cross-turn state (user preferences, progress) |
| `worksession` | Current work unit | Work unit boundary | Task-scoped data (document being edited, etc.) |
| `user` | Long-term, persistent | Never (or explicit reset) | User profile, language, history |

JS can read any domain with `get_memory()` and write with `set_memory()`. The FSM reads and writes via `set` statements in the flow. Both sides share the same in-memory store.

---

## TypeScript reference

```typescript
type Effect =
  | { type: "goal";             text: string }
  | { type: "guide";            text: string }
  | { type: "teach";            text: string }
  | { type: "request_interact"; requiring: string | null }
  | { type: "transition";       from: string; to: string }
  | { type: "run_script";       target: string; label: string | null; silent: boolean }
  | { type: "run_subagent";     target: string; label: string | null; background: boolean }
  | { type: "run_tool";         target: string; label: string | null }
  | { type: "set_memory";       domain: string; key: string; value: string | number | boolean | null }
  | { type: "apply_css";        value: string }
  | { type: "remove_css";       value: string }
  | { type: "apply_html";       value: string }
  | { type: "remove_html";      value: string }
  | { type: "apply_video";      value: string }
  | { type: "remove_video";     value: string }
  | { type: "parse_error";      message: string };

type MemEntry = { domain: string; key: string; value: string | number | boolean | null };

type GraphInfo = {
  states: string[];
  transitions: Array<{ from: string; to: string; label: string }>;
  current: string;
};

interface AgentDSLKernelHandlers {
  goal(text: string): void;
  guide(text: string): void;
  teach(text: string): Promise<void> | void;
  requestInteract(requiring: string | null): void;
  runScript(target: string, label: string | null, silent: boolean): Promise<void>;
  runSubagent(target: string, label: string | null, background: boolean): Promise<void>;
  runTool(target: string, label: string | null): Promise<void>;
  applyCss(value: string): void;
  removeCss(value: string): void;
  applyHtml(value: string): void;
  removeHtml(value: string): void;
  applyVideo(value: string): void;
  removeVideo(value: string): void;
}
```

---

## React hook example

```typescript
import { useRef, useEffect, useCallback } from "react";

export function useAgentDSLKernel(handlers: AgentDSLKernelHandlers) {
  const engineRef = useRef<import("dot-agent-kernel").AgentDSLKernel | null>(null);

  useEffect(() => {
    let engine: import("dot-agent-kernel").AgentDSLKernel;

    import("dot-agent-kernel").then(async (mod) => {
      await mod.default();
      engine = new mod.AgentDSLKernel();

      engine.observe((effect: Effect) => {
        switch (effect.type) {
          case "goal":             handlers.goal(effect.text); break;
          case "guide":            handlers.guide(effect.text); break;
          case "teach":            handlers.teach(effect.text); break;
          case "request_interact": handlers.requestInteract(effect.requiring); break;
          case "run_script":       handlers.runScript(effect.target, effect.label, effect.silent); break;
          case "run_subagent":     handlers.runSubagent(effect.target, effect.label, effect.background); break;
          case "run_tool":         handlers.runTool(effect.target, effect.label); break;
          case "apply_css":        handlers.applyCss(effect.value); break;
          case "remove_css":       handlers.removeCss(effect.value); break;
          case "apply_html":       handlers.applyHtml(effect.value); break;
          case "remove_html":      handlers.removeHtml(effect.value); break;
          case "apply_video":      handlers.applyVideo(effect.value); break;
          case "remove_video":     handlers.removeVideo(effect.value); break;
        }
      });

      engineRef.current = engine;
    });

    return () => { engine?.free(); };
  }, []);

  const loadFlow  = useCallback((text: string) => engineRef.current?.load_behavior(text), []);
  const sendIntent = useCallback((i: string)  => engineRef.current?.send_intent(i), []);
  const sendEvent  = useCallback((e: string)  => engineRef.current?.send_event(e), []);
  const tickPrompt = useCallback(()           => engineRef.current?.tick_prompt(), []);

  return { loadFlow, sendIntent, sendEvent, tickPrompt, engineRef };
}
```
