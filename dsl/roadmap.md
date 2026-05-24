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

## Etapa 3 — Revisão e consolidação do texto da spec

Os documentos atuais herdaram estrutura e linguagem de quando eram dois projetos separados. O objetivo é reescrever a spec como um documento coeso, com voz unificada, seções que fazem sentido juntas e sem redundâncias ou artefatos de origem.

- [ ] Definir estrutura-alvo dos documentos de spec (quais arquivos, quais seções)
- [ ] Consolidar `language.agent.md` e `language.flow.md` — avaliar merge em um único `language.md` ou manter separados com seções revisadas
- [ ] Revisar `grammar.agent.md` — adequar tom e estrutura ao padrão consolidado
- [ ] Revisar `grammar.flow.md` — adequar tom e estrutura, garantir cobertura do `merge` e demais adições recentes
- [ ] Revisar `manifesto.md` — contextualizar no ecossistema unificado (não mais como projeto standalone)
- [ ] Atualizar `README.md` da pasta `dsl/` conforme estrutura final

---

## Etapa 4 — Tree-sitter

- [ ] Criar grammar tree-sitter para `.flow` (atualmente só existe TextMate grammar em `dsl-old/flow-lang/syntax/`)
- [ ] Alinhar `tree-sitter-agent/grammar.js` com spec atualizado em `grammar.agent.md`
- [ ] Avaliar unificação dos dois parsers em um repositório `tree-sitter-agent-flow`
- [ ] Atualizar `dsl/tree-sitter-agent/` com resultado

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
