# Roadmap da DSL

Próximas etapas de evolução da especificação consolidada.

> Contexto e análise de base: `entelekheia/merge.md`

---

## Etapa 1 — Reorganização e consolidação documental ✅

- [x] Criar `dsl-old/` com backup do estado anterior
- [x] Mover `flow-lang/` para `dsl-old/`
- [x] Renomear `DSL/` → `dsl/`
- [x] Incorporar spec do `.flow` em `dsl/` (`grammar.flow.md`, `language.flow.md`, `manifesto.md`)
- [x] Criar `README.md` e `roadmap.md`

---

## Etapa 2 — Revisão de Vocabulário / Sintaxe ✅

- [x] Decidir keyword e semântica de composição de flows → `merge "file.flow"` (preamble, eager)
- [x] Remover `run flow` do `run_type` em `grammar.flow.md`
- [x] Adicionar `merge_decl` ao top-level de `grammar.flow.md`
- [x] Atualizar `language.flow.md` — §3 (flat states), §4 (IDE doc links), nova subseção de composição
- [x] `grammar.agent.md` sem impacto — `behavior` mantido como está
- [x] Sem lazy loading — casos complexos delegados a `.run` / WASM

---

## Etapa 3 — Spec text consolidation ✅

- [x] Merge `language.agent.md` + `language.flow.md` + `manifesto.md` → unified `language.md` (English)
- [x] Clarify `.flow` / `.run` relationship: same purpose, text subset vs compiled WASM
- [x] Add deprecation notices to `grammar.agent.md` and `grammar.flow.md`
- [x] Fix broken links in grammar files (old `grammar.md` and `DSL/` path references)
- [x] Remove "How to use this documentation?" section from `grammar.flow.md`
- [x] Update `README.md` for new file structure
- [x] Note `.logic` → `.run` rename still needed in `org-spec/` (separate submodule)

---

## Etapa 4 — Tree-sitter

- [ ] Resolve open question: `project` vs `worksession` memory domain name — align grammar and spec
- [ ] Create tree-sitter grammar for `.flow` (currently only TextMate grammar in `dsl-old/flow-lang/syntax/`)
- [ ] Align `tree-sitter-agent/grammar.js` with updated spec in `grammar.agent.md`
- [ ] Evaluate unifying both parsers into a single `tree-sitter-agent-flow` repository
- [ ] **After tree-sitter grammars are finalized: delete `grammar.agent.md` and `grammar.flow.md`**
- [ ] Update `dsl/tree-sitter-agent/` with result

---

## Etapa 5 — Extensões (VS Code / Zed)

- [ ] Consolidar `dsl-old/flow-lang/syntax/` e `dsl/vscode-extension/` em uma única extensão que suporte `.agent` e `.flow`
- [ ] Atualizar extensão Zed (`dsl/zed-agent/`) para incluir highlighting de `.flow`
- [ ] Publicar extensão VS Code atualizada no marketplace

---

## Etapa 6 — Exemplos

- [ ] Adicionar arquivo `.flow` companion para cada exemplo em `dot-agent-spec/examples/` (hoje só `.agent`)
- [ ] Adicionar arquivo `.agent` para os exemplos em `dsl-old/flow-lang/examples/`
- [ ] Mover exemplos consolidados (pares `.agent` + `.flow`) para `dot-agent-spec/examples/`
- [ ] Avaliar mover `dsl-old/flow-lang/compiled/` para `dot-agent-spec/` como referência de compilação
