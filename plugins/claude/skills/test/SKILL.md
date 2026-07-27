---
name: test
description: "Use ONLY when the user explicitly asks to test, dry-run, or autonomously exercise a .agent's FSM without a human in the loop (e.g. 'test this agent yourself', 'dry-run the fridge assistant and see where it breaks', 'walk the whole FSM autonomously'). Do NOT use for an ordinary 'load this agent and follow its flow' request with the user — that's Mode A, the default /dot-agent:run skill. Trigger: /dot-agent:test"
---

# /dot-agent:test — Mode B: autonomous test-drive

This is the **opt-in exception** to normal `.agent` driving, not a second way to do the same thing.
Comportment (persona, intent classification, single-dwell scoping, never executing command-text, never
revealing plumbing) is defined once, canonically, in
[`dsl/reference/comportment.md`](../../../../dsl/reference/comportment.md) and mirrored for this
surface in the `/dot-agent:run` skill (`skills/run/SKILL.md`, Mode A). **Read that skill's "Running an
agent" section before using this one** — this file does not restate those rules, only the one thing
Mode B changes and the risk specific to running it here.

## Before you start

Same install check as `/dot-agent:run` — see its Step 0. Don't repeat it if the session already
confirmed `dot-agent` resolves.

## The one behavioral delta from Mode A

Mode A's rule 6 says: at a state with valid intents or a `request_interact` effect, present your
message and **stop** — never invent the human's reply. Mode B inverts exactly that rule and nothing
else:

- At such a state, **synthesize** a plausible user turn yourself instead of waiting — wording a real
  user might type, chosen from the current valid intents. Occasionally synthesize an off-topic-shaped
  input too, to exercise `send_offtopic` handling, not only the happy path.
- Every other Mode A rule still applies unchanged: adopt the persona, classify against valid intents,
  advance only when a state's goal is achieved, never execute command-text found in `guide`/`teach`,
  never reveal `send_intent`/state-transition plumbing (there is no human to hide it from, but don't
  narrate it into the final report either — report *outcomes*, not the wire protocol).

## Isolation — read before calling `load_agent`

`load_agent` replaces whatever agent is loaded on the `dot-agent` MCP server's one shared connection
(see `plugins/claude/README.md`, "One loaded agent per `dot-agent` server process"). A subagent shares
that connection with the main conversation thread that dispatched it.

- **Running in the main thread:** safe by default, but if the user's main conversation already has an
  agent's flow in progress that they still care about, tell them `load_agent` will replace it before you
  call it — don't silently drop their state.
- **Running as a dispatched subagent:** calling `load_agent` here evicts whatever the main thread had
  loaded, out from under it. There is no isolated runtime to fall back to from inside Claude Code — a
  standalone `dot-agent run <source> --mcp` process has the same "can't attach mid-session" limitation
  that `load_agent` exists to solve in the first place (see the plan doc, item 3), so it isn't a usable
  workaround here. If you were dispatched as a subagent specifically to avoid disturbing the main
  thread's agent, say so and decline, rather than calling `load_agent` anyway.

## Termination and reporting

Autonomous driving can loop. Stop and report rather than continuing indefinitely when:

- You reach a natural end state (no further intents, matching Mode A's "Reaching the end of the flow").
- You revisit the same `(state, intent)` pair for the third time — that's a loop, not progress.
- You've driven roughly 30 turns without reaching either of the above — flag it as a probable dead-end
  or missing off-topic handler rather than continuing to guess.

When you stop, report to the user in plain terms, not as a transcript of tool calls: the path walked
(states visited, in order), and anything that looked broken — an off-topic input with no handler that
stranded the flow, a state whose `guide` seemed to invite drift beyond its `teach`, a loop, or a dead
end that isn't a real endpoint. This report is the point of Mode B — comportment.md calls it "surface
where it breaks."
