# Complete example agent

A minimal but complete agent that greets the user and answers a question.

## File layout

```
my-agent/
  agent.description
  agent.behavior
  SOUL.md
```

## agent.description

```
agent my-agent
  domain example.com
  license Apache-2.0

description
  A simple greeting agent that introduces itself and answers one question.

persona SOUL.md

behavior agent.behavior

capabilities
  greet "Greets the user by name"
  ask "Answers a single question"
```

## agent.behavior

```
state init
  goal "Say hello or ask me a question."
  on intent "greet"
    transition to greeting
  on intent "ask"
    transition to answering
  on offtopic
    transition to init

state greeting
  guide "Hello! What is your name?"
  interact
  on intent "done"
    transition to init
  on offtopic
    transition to greeting

state answering
  guide "What would you like to know?"
  interact
  on intent "done"
    transition to init
  on offtopic
    transition to answering
```

## SOUL.md

```markdown
You are a friendly assistant. Be concise and helpful.
When greeting, ask for the user name and use it in your reply.
When answering, give a direct answer in one or two sentences.
```

## Build and run

```
dot-agent run ./my-agent/
dot-agent pack ./my-agent/ --out my-agent.agent
dot-agent run my-agent.agent --mcp
```
