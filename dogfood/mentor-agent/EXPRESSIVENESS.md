> ⚠️ Point-in-time DSL usability snapshot (2026-06-23). NOT spec truth — may be obsolete. Source of truth: dsl/ + packages/.

# Expressiveness Report — `mentor-agent` dogfood

**Agent modeled:** `mentor-agent`
**DSL files:** `agent.behavior`, `agent.description`
**Run date:** 2026-06-28
**Model:** gemini-pro

---

# Expressiveness Feedback

## What expressed cleanly
* A separação de responsabilidades estruturais foi muito intuitiva. Dividir os metadados e capacidades (`agent.description`), o fluxo e regras de interação (`agent.behavior`), e a persona (`SOUL.md`) tornou a tradução de um prompt longo (a Gem original) para o formato `.agent` uma tarefa simples e altamente legível.
* A definição de `capabilities` no arquivo description ajuda muito a prever as actions antes mesmo de olhar o comportamento.
* Conectar via MCP (Stdio ou HTTP) para ler a evolução da FSM, intents e state via `resources/read` e iterar com `tools/call` (`send_intent`) fluiu incrivelmente bem para emular a interação, e o manifesto exportado foi muito completo.

## Gaps & limitations
* **[RFC] Transições incondicionais em estados iniciais:** Ao tentar usar uma transição direta (ex: `transition to recebendo_insumos`) a partir do estado `init`, sem uma clausula `interact` ou evento associado, o compilador traduziu o `init` para `<final id="init" _active="true"/>` no SCXML. Isso gerou confusão, pois a intenção era um salto automático (auto-transition), mas a FSM foi finalizada prematuramente. Seria útil ter suporte claro para transições não-condicionais no momento do spawn (ou um aviso no linter de que o estado se tornou final).

## Parser & linter error-message quality

* **Erro/Aviso Encontrado:**
  `⚠ agent.behavior:1:7 W013 'interact' without 'goal' — the prettifier will insert one. To set it explicitly, add 'goal "..."' before 'interact'.`
* **Contexto:** Ao tentar corrigir o estado `init` adicionando `interact` para evitar que se tornasse um nó final, acabei omitindo a string do `goal`. 
* **Melhoria Sugerida:** A mensagem já é excelente e bastante direcional. Uma pequena adição seria mostrar **qual** goal padrão o prettifier está inserindo (ex: *"the prettifier will insert a default empty goal"*), para o autor saber o impacto exato na interface do usuário (já que o goal geralmente pauta o prompt de status do agente).
