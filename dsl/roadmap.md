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

## Etapa 4 — Tree-sitter ✅

- [x] Resolve open question: `project` → `worksession` memory domain name — aligned in `grammar.flow.md` and `language.md`
- [x] Create tree-sitter grammar for `.flow` — `dsl/tree-sitter/flow/grammar.js` (10/10 tests passing)
- [x] Align `tree-sitter/grammar.js` with updated spec — `?` moved before `:`, `agent_meta_key`/`optional_marker`/`run_type`/`assignment_op` as named rules (8/8 tests passing)
- [x] Unified both parsers in `dsl/tree-sitter/` — `flow/` subdirectory, `tree-sitter.json` updated
- [x] Rename local directory `tree-sitter-agent` → `tree-sitter` and update submodule pointer in `.gitmodules`
- [x] Delete `grammar.agent.md` and `grammar.flow.md` — `dsl/tree-sitter/` is now the canonical source

---

## Etapa 5 — Extensões (VS Code / Zed) ✅

- [x] Consolidar `dsl-old/flow-lang/syntax/` e `dsl/vscode-extension/` em uma única extensão que suporte `.agent` e `.flow`
- [x] Atualizar extensão Zed (`dsl/zed-agent/`) para incluir highlighting de `.flow`

---

## Etapa 6 — Exemplos

- [ ] Adicionar arquivo `.flow` companion para cada exemplo em `dot-agent-spec/examples/` (hoje só `.agent`)
- [ ] Adicionar arquivo `.agent` para os exemplos em `dsl-old/flow-lang/examples/`
- [ ] Mover exemplos consolidados (pares `.agent` + `.flow`) para `dot-agent-spec/examples/`
- [ ] Avaliar mover `dsl-old/flow-lang/compiled/` para `dot-agent-spec/` como referência de compilação


---

## Etapa 7 — Contratos
- [ ] [Correção Spec] Resolver a ambiguidade do Contrato de Retorno Oculto: Adicionar à especificação textual a obrigatoriedade da sintaxe de injeção explícita para saídas de subagentes (ex: run subagent "Name" into context.target).
- [ ] Resolve open question: project vs worksession memory domain name — align grammar and spec. Definição recomendada: Adotar worksession globalmente devido à semântica de isolamento de tarefas de IA.
- [ ] [Aprimoramento] Adicionar suporte gramatical inicial para propriedades de resiliência (ex: palavra reservada timeout aceita em blocos de execução de ferramentas e subagentes).

---

## Etapa 8 — Extensões (VS Code / Zed) ⚙️ (Foco em UX e Salvaguardas de Dev)
- [ ] [Implementação de Proteção (Linter)] Implementar uma regra de análise estática (Linter) na extensão para injetar um Warning visual caso o usuário declare um tipo customizado que cause Shadowing nos tipos nativos (std.*).
- [ ] [Navegabilidade Sênior] Implementar a diretiva de renderização de links clicáveis para caminhos de arquivos (merge, run script, guide, teach) conforme exigido pelo design de experiência do desenvolvedor (DX).
- [ ] Publicar extensão VS Code atualizada no marketplace

---

## Etapa 9 — Exemplos 🧪 (Foco em Validação Prática e Casos Complexos)
- [ ] [Validação do Arquiteto] Garantir que os novos arquivos .flow de exemplo façam uso da nova sintaxe de atribuição into para subagentes, validando o Data Lineage nos exemplos práticos.
- [ ] [Antipadrão Docs] Incluir na documentação de exemplos um caso de uso demonstrando "Quando migrar do .flow para o .run", aplicando o limiar prático da densidade cognitiva (ex: demonstrando um fluxo que exigiria loops complexos sendo elegantemente substituído por um módulo compilado em WASM).