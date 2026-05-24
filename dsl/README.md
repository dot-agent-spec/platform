# DSL — Especificação Consolidada

Especificação unificada dos dois formatos de arquivo do ecossistema de agentes: `.agent` (manifesto) e `.flow` (comportamento).

## Estrutura

| Arquivo | Papel |
|---------|-------|
| [`grammar.agent.md`](grammar.agent.md) | Gramática formal EBNF do formato `.agent` |
| [`language.agent.md`](language.agent.md) | Design, sintaxe e arquitetura do `.agent` |
| [`grammar.flow.md`](grammar.flow.md) | Gramática formal EBNF do formato `.flow` |
| [`language.flow.md`](language.flow.md) | Design philosophy e decisões do `.flow` |
| [`manifesto.md`](manifesto.md) | O espaço que `.flow` ocupa — motivação e fronteiras |
| [`roadmap.md`](roadmap.md) | Próximas etapas da especificação |

## Tooling

| Diretório | Função |
|-----------|--------|
| [`tree-sitter-agent/`](tree-sitter-agent/) | Parser tree-sitter para `.agent` (git submodule) |
| [`vscode-extension/`](vscode-extension/) | Extensão VS Code para `.agent` |
| [`zed-agent/`](zed-agent/) | Extensão Zed para `.agent` |

> `.flow` tem TextMate grammar e snippets em `dsl-old/flow-lang/syntax/`. Consolidação de extensões é a Etapa 4 do roadmap.

## Modelo mental

```
.agent  =  header (.h em C)     — o que o agente é, consome e expõe
.flow   =  implementação (.c)   — como ele funciona, estado por estado
```

O `.agent` aponta para o `.flow` via `behavior main.flow`. O runtime lê o manifesto para sandbox e discovery; executa o flow para orquestração.

## Histórico

O conteúdo desta pasta foi consolidado a partir de dois diretórios anteriores:
- `dot-agent-spec/DSL/` — spec original do `.agent`
- `flow-lang/` — spec standalone do `.flow`

O estado anterior está preservado em `entelekheia/dsl-old/`.
