# offtopic_handler: why it is optional

## Decision

`on offtopic` is an **optional** handler inside an oriented state. At least one `on intent` handler is required, but `on offtopic` may be omitted.

## Context

Early versions of the grammar required every oriented state to declare an `on offtopic` handler. The intent was to guarantee that every state had an exit path — no dead ends.

## The problem: mandatory offtopic creates a cognitive loop

Consider a dedicated state for handling off-topic conversation:

```behavior
state handle_offtopic
  guide "You are limited to kitchen and recipe assistance.
         Politely inform the user that their request is outside your scope.
         Then, offer to return to the recipe suggestions or list the available catalog."
  goal "Redirect the conversation back to the core functionality when the user goes off-topic."
  interact
  on intent "back_to_suggestions"
    transition to responsive
  on intent "list_recipes"
    transition to show_catalog
  on offtopic
    transition to handle_offtopic
```

This state is intentionally self-contained: it stays active until the user makes a clear choice. The `on offtopic` handler loops back to itself — if the user is still off-topic, the state keeps redirecting.

Now suppose `on offtopic` were mandatory on every state. Every other state in the file — `responsive`, `show_catalog`, `reservation`, etc. — would also need to declare `on offtopic`, typically routing to `handle_offtopic`. This creates two problems:

1. **Boilerplate in every state**: the author must write `on offtopic transition to handle_offtopic` everywhere, even in states that have nothing to do with off-topic handling.
2. **Cognitive loop in state design**: the FSM author must think about off-topic exit at every state boundary, rather than modeling it once in the dedicated state.

The mandatory requirement turns a cross-cutting concern into per-state noise.

## The correct invariant

A state has a guaranteed exit path as long as it has at least one `on intent` handler. The LLM will always classify the user's reply into one of the declared intents or into `offtopic`. If `offtopic` is not handled, the FSM does not react to off-topic input in that state — which may be the right behavior when the state expects a specific response.

Off-topic handling belongs in a **dedicated state** reached when another state explicitly routes to it via `on offtopic transition to handle_offtopic`. Only states that need to react to off-topic input declare the handler.

## Design principle

A state stays active until the user completes the action that brought them there, or expresses a different intent. Off-topic is one possible intent — it does not require special grammar-level enforcement.

| Approach | Pros | Cons |
|---|---|---|
| Mandatory `on offtopic` everywhere | No state can silently ignore off-topic input | Forces boilerplate; cognitive loop when designing the FSM |
| Optional `on offtopic` | Clean state definitions; dedicated off-topic state models the concern once | Author must consciously choose where to handle offtopic |
