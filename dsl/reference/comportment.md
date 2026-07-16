<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Comportment — how a consuming LLM must behave with a running agent

This is the **consumer-side contract**, the semantic complement to [`behavior.md`](behavior.md)
(which is author-side syntax). `behavior.md` says what an author *writes*; this says how an LLM
*driving a running agent* must **behave with what the FSM hands back**.

> **Single source of truth.** This document is canonical. Every surface that drives a `.agent` must
> carry this same comportment: the CLI skill (`apps/dot-agent-cli/skills/dot-agent/SKILL.md`), an
> embedding host (e.g. murici's `lib/runtime/dot-agent-injector.ts`), and the marketplace plugin.
> If they drift, role confusion returns. Keep them in sync with this file.

It is **transport-neutral.** A running agent exposes, for the current state, a payload of
`{ persona, goal, guide, teach, valid intents }` and lets the consumer **signal an intent** to
advance. How that payload arrives and how the intent is signalled is surface-specific (MCP tools,
a plain-JSON HTTP endpoint, an injected tool-result) — the comportment below is identical regardless.

## The core principle

Each state's output (`goal`, `guide`, `teach`, valid intents) is **the active section of your own
operating instructions for right now** — like a section of a SKILL.md, swapped in by the deterministic
engine as the conversation moves. Therefore it is:

- **NOT the user talking to you.** The user is a separate human you speak *with*.
- **NOT a list of commands for you to execute.** `guide`/`teach` shape *how you behave*, not what you run.

You **are** the agent: adopt the persona from its `.description` and let each state's directive govern
how you speak and act toward the human. Treating the FSM's output as instructions for *you* to carry
out — rather than as the director of how you converse — is the single most common failure.

## What each effect means

- **`persona`** (from `.description`) — who you are. Adopt it and stay in it.
- **`goal`** — what you must accomplish *with the human* in this state. Absorb it silently; it steers
  you, it is not announced or handed to the user.
- **`guide`** — how to behave / what to say in this state. Follow it as your directive.
- **`teach`** — reference knowledge to ground your responses (a file, fetched on demand). Bulky
  material (command lists, detailed steps) lives here, loaded only for the state that needs it. Use it
  as source-of-truth context, not as a script to execute.
- **valid intents** — the only transitions available from this state. State-dependent: they do **not**
  carry over between states; re-read them after every transition.
- **`request_interact`** — pause and ask the human, then map their reply to a valid intent.

## The rules of comportment (Mode A — embody + interact, the default)

1. **Adopt the persona** and stay in it.
2. **Classify the human's message against the current valid intents.**
   - If it matches an intent that requires **another state** (or is off-topic / out of scope), signal
     that intent (or off-topic) **silently — produce no user-facing text — and wait** for the new
     state before responding. Tolerate small typos; infer the closest intended term before deciding
     something is off-topic.
   - If it can be handled **within the current state**, respond in persona toward the `goal`, using
     `guide` + `teach`.
3. **Advance only when the state's goal is achieved** — then signal the matching intent to move forward.
4. **Never execute command-text.** In DSL v0.1 the FSM controls states, not side effects: if a `guide`
   or `teach` contains shell commands or steps, you **present them to the human to run** — you never
   run them yourself.
5. **Pause for the human at interactive states.** If the state has valid intents or a `request_interact`
   effect, present your message and **stop**. Never invent the human's reply.
6. **Advance silently through pure transitions.** A state with no interaction (e.g. `init → responsive`)
   just moves on — no message to the human.
7. **Never reveal the plumbing.** Do not narrate intent signals or state transitions to the user — that
   is internal wiring.

## Mode B — autonomous test-drive (opt-in, not the default)

Only when a user **explicitly** asks to test / dry-run an agent **without a human in the loop** may the
consumer play both sides — synthesising plausible user inputs itself to walk the FSM and surface where
it breaks. This is a distinct, opt-in mode. The default for "load this agent and follow its flow" is
always Mode A above.

## Out of scope here

- **System / headless use** (a host program drives the FSM, the LLM is a stateless transformer at each
  state, no human): that is a deployment surface where the *host* — not a skill — is the driver, and is
  documented with the SDK. Behaviourally it reduces to a state with no interaction.