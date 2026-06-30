# review_dsl.md — Revisão Interna da `.agent DSL` para v1.0

> **Propósito:** Documento de referência interna que consolida a sintaxe atual, mapeia ambiguidades entre a especificação e a gramática canônica, e lista as decisões em aberto para fechar a v1.0.
>
> **Fonte de verdade da gramática:** `dsl/tree-sitter-agent/grammar.js` (`.agent`) e `dsl/tree-sitter-agent/flow/grammar.js` (`.flow`). Quando a gramática e outro documento divergem, a gramática é o estado atual de implementação — e o conflito é registrado na Seção 3.
>
> **Data de geração:** 2026-05-30

---

## 1. Visão Geral da Sintaxe Atual

### 1.1 Sistema de dois arquivos

Todo agente é definido por exatamente dois arquivos:

| Arquivo | Papel | Analogia |
|---|---|---|
| `.agent` | Manifesto público: o que o agente é, consome e expõe | `.h` em C |
| `.flow` | Comportamento privado: execução estado a estado | `.c` em C |

O `.agent` aponta para o `.flow` via `behavior main.flow`. A Runtime lê o manifesto para sandboxing e discovery sem nunca executar o `.flow`. O `.flow` não é exposto a outros agentes.

### 1.2 Princípios sintáticos

1. **Sem ruído estrutural.** Sem chaves `{}`, sem vírgulas obrigatórias em blocos, sem dois-pontos em pares chave-valor de metadados. Os dois-pontos só aparecem nas declarações de propriedade de tipos (`campo: Tipo`).
2. **Indentação semântica.** Escopo definido por 2 espaços. O parser usa um scanner externo (`src/scanner.c`) que emite tokens `INDENT`, `DEDENT` e `NEWLINE` — o Tree-sitter não tem suporte nativo a indentação.
3. **Comentários de linha.** Qualquer trecho a partir de `//` é ignorado, inline ou em linha própria.
4. **Determinismo obrigatório.** Tipos customizados devem ser declarados explicitamente com âncora semântica (Wikidata). A LLM nunca infere a estrutura de um tipo customizado em runtime.

### 1.3 Relação `.flow` / `.run`

```
Prompt  →  .flow  →  .run (WASM)  →  Runtime
```

- `.flow` é um subconjunto textual e compilável do que `.run` faz.
- Tudo expressável em `.flow` pode ser escrito em `.run`. O inverso não é verdade.
- **Quando usar `.flow`:** o fluxo é estruturado demais para um prompt, simples demais para WASM.
- **Quando usar `.run`:** loops, agregações complexas, rollback transacional, aritmética, lógica IP-protegida.
- **Critério de travessia:** densidade cognitiva, não contagem de linhas. Um `.flow` deve ser escaneável em menos de 30 segundos.

### 1.4 Estrutura geral de um arquivo `.agent`

```
agent NomeDoAgente
  domain exemplo.com       ← metadados de identidade (indentados sob `agent`)
  license MIT
  terms  https://exemplo.com/terms
  privacy https://exemplo.com/privacy

description                ← blocos semânticos (top-level, não indentados sob `agent`)
  Texto livre de descrição.

behavior main.flow

requires TipoA, TipoB

input
  TipoC "Descrição do input"

capabilities
  AçãoX "O que permite"

output TipoD

type TipoD                 ← declarações de tipo (top-level)
  concept https://www.wikidata.org/wiki/QXXXXXXX
  campo: string
```

### 1.5 Estrutura geral de um arquivo `.flow`

```
merge "outro.flow"         ← preamble: apenas merge_decl, antes de qualquer state

on event "nome_evento"     ← observers globais (top-level)
  guide "orientação"
  next estado_destino

state nome_do_estado       ← estados planos (sem hierarquia em runtime)
  goal "propósito"
  guide "instrução"
  interact
  on intent "intenção" next outro_estado
  on escape
    next responsive
  on fallback
    next error
```

---

## 2. Dicionário de Palavras-Chave

> **Legenda de escopo:**
> - `[A:raiz]` = top-level do arquivo `.agent`
> - `[A:meta]` = indentado sob `agent`
> - `[A:tipo]` = dentro de bloco `type`
> - `[F:raiz]` = top-level do arquivo `.flow`
> - `[F:bloco]` = dentro de um bloco `state` ou `on event`
> - `[SPEC]` = definido em `syntax.md` mas **ausente na gramática canônica** — conflito registrado na Seção 3

---

### `.agent` — Keywords

#### `agent`

- **Descrição:** Declara o nó raiz do manifesto. O nome do agente segue imediatamente, podendo ser multi-palavra com cada palavra capitalizada.
- **Escopo:** `[A:raiz]` — exatamente uma declaração por arquivo.
- **Exemplo válido:**
  ```agent
  agent Mickey Mouse
    domain disney.com
  ```

---

#### `domain`

- **Descrição:** Domínio web do proprietário do agente. Usado pela Runtime para verificação de identidade (W3C DID ou `.well-known`) e prevenção de spoofing. Agentes sem `domain` são tratados como "Unverified".
- **Escopo:** `[A:meta]` — indentado sob `agent`, somente uma vez.
- **Exemplo válido:**
  ```agent
  agent Analyst
    domain figma.com
  ```

---

#### `license`

- **Descrição:** Identificador de licença (ex: `MIT`, `Apache-2.0`, `Copyright`).
- **Escopo:** `[A:meta]` — indentado sob `agent`.
- **Exemplo válido:**
  ```agent
  agent Analyst
    domain figma.com
    license MIT
  ```

---

#### `terms`

- **Descrição:** URL para os termos de uso do agente.
- **Escopo:** `[A:meta]` — indentado sob `agent`.
- **Exemplo válido:**
  ```agent
  agent Analyst
    domain figma.com
    terms https://figma.com/terms
  ```

---

#### `privacy`

- **Descrição:** URL para a política de privacidade do agente.
- **Escopo:** `[A:meta]` — indentado sob `agent`.
- **Exemplo válido:**
  ```agent
  agent Analyst
    domain figma.com
    privacy https://figma.com/privacy
  ```

---

#### `description`

- **Descrição:** Bloco de texto livre descrevendo o agente. Usado pela Runtime para indexação semântica e pelo registro para discovery. Pode ter múltiplas linhas.
- **Escopo:** `[A:raiz]` — top-level, uma ocorrência por arquivo.
- **Exemplo válido:**
  ```agent
  description
    Agente financeiro que analisa despesas e gera relatórios.
    Suporta múltiplas moedas e formatos de extrato.
  ```

---

#### `behavior`

- **Descrição:** Aponta para o arquivo `.flow` que contém o comportamento do agente. Sempre inline — sem bloco indentado sob ele.
- **Escopo:** `[A:raiz]` — top-level, exatamente uma ocorrência.
- **Exemplo válido:**
  ```agent
  behavior analyst.flow
  ```
- **Inválido:** conteúdo indentado sob `behavior` (conflito #15 na Seção 3).

---

#### `requires`

- **Descrição:** Tipos que a Runtime deve garantir no contexto antes de invocar o `.flow`. O agente não executa se algum tipo listado não estiver disponível.
- **Escopo:** `[A:raiz]` — top-level. Aceita forma inline (lista com vírgulas) ou bloco indentado.
- **Exemplo válido — inline:**
  ```agent
  requires Prontuario, UserProfile
  ```
- **Exemplo válido — bloco:**
  ```agent
  requires
    Prontuario
    UserProfile
  ```

---

#### `input`

- **Descrição:** Tipos de dados que o agente precisa para operar. Diferente de `requires`: `requires` é pré-condição garantida pela Runtime; `input` é o dado esperado do chamador.
- **Escopo:** `[A:raiz]` — top-level. Aceita inline ou bloco documentado.
- **Exemplo válido:**
  ```agent
  input
    Patient "O paciente a ser atendido"
    MedicalCondition
  ```

---

#### `capabilities`

- **Descrição:** Ações (Schema.org `Action`) ou recursos que o agente pode usar. Também é o **contrato de sandboxing**: a Runtime só permite as permissões listadas aqui.
- **Escopo:** `[A:raiz]` — top-level. Aceita inline ou bloco documentado.
- **Exemplo válido:**
  ```agent
  capabilities
    DiagnoseAction         "Emite diagnósticos clínicos"
    custom.SpeechSynthesis "Síntese de voz"
  ```

---

#### `output`

- **Descrição:** Tipo de dado retornado pelo agente. Forma o contrato de saída verificado pela Runtime.
- **Escopo:** `[A:raiz]` — top-level. Aceita inline ou bloco documentado.
- **Exemplo válido:**
  ```agent
  output
    FinancialProduct "O produto recomendado"
  ```

---

#### `type`

- **Descrição:** Declara um tipo customizado com âncora semântica. É um contrato duro: a Runtime nunca infere a estrutura de um tipo customizado.
- **Escopo:** `[A:raiz]` — top-level. O corpo é um bloco indentado com `concept`, `schema`, e declarações de propriedade.
- **Exemplo válido:**
  ```agent
  type BookingConfirmation
    concept https://schema.org/Reservation
    reservationId: string
    pickupDate: string
    car: Car
  ```

---

#### `concept`

- **Descrição:** URL de âncora semântica dentro de um bloco `type`. Aceita Wikidata QIDs (`wikidata.org/wiki/Q...`) ou Schema.org (`schema.org/...`). Previne ambiguidade entre agentes de diferentes vendors.
- **Escopo:** `[A:tipo]` — primeira linha do bloco `type`.
- **Status atual:** único campo URI obrigatório na gramática. `syntax.md` propõe substituição por `category` (ver conflito #8 e #16 na Seção 3).
- **Exemplo válido:**
  ```agent
  type Car
    concept https://schema.org/Product
    make: string
    model: string
  ```

---

#### `category` `[SPEC]`

- **Descrição:** URL de Wikidata QID obrigatório em todo bloco `type`. Proposto em `syntax.md` para substituir `concept` como campo obrigatório de âncora. Usado pela Runtime para verificação de compatibilidade de adapter entre agentes.
- **Escopo:** `[A:tipo]` — proposto como primeira linha de `type`.
- **Status:** **Definido em `syntax.md`, ausente na gramática canônica. Nenhum exemplo usa esta keyword. Decisão de implementação pendente.**
- **Exemplo de uso (conforme spec):**
  ```agent
  type BookingConfirmation
    category https://www.wikidata.org/wiki/Q1783551
    concept  https://schema.org/Reservation    // agora opcional
    reservationId: string
  ```

---

#### `schema`

- **Descrição:** Aponta para um arquivo JSON Schema para validação estrita do tipo.
- **Escopo:** `[A:tipo]` — dentro do bloco `type`, opcional.
- **Exemplo válido:**
  ```agent
  type BankStatement
    concept https://www.wikidata.org/wiki/Q806653
    schema bankstatement.json
    account: Person
  ```

---

#### `Enum`

- **Descrição:** Conjunto fechado de literais como valor de uma propriedade de tipo.
- **Escopo:** `[A:tipo]` — lado direito de uma declaração de propriedade.
- **Exemplo válido:**
  ```agent
  type Account
    concept https://schema.org/BankAccount
    status: Enum(active, closed, suspended)
  ```

---

#### `?` (optional marker)

- **Descrição:** Marca uma propriedade de tipo como opcional. Posicionado entre o nome do campo e o `:`.
- **Escopo:** `[A:tipo]` — na declaração de propriedade individual.
- **Exemplo válido:**
  ```agent
  type UserProfile
    concept https://www.wikidata.org/wiki/Q5
    name: string
    avatar?: ImageObject "Foto do usuário (opcional)"
  ```

---

#### Primitivos de tipo

Os seguintes nomes são resolvidos como tipos primitivos. A gramática os trata como `type_ref` (identificador simples), não como keywords reservadas:

| Nome | Semântica | Status |
|---|---|---|
| `string` | Texto livre | Na gramática (como identifier) |
| `Number` | Numérico | Usado em `language.md`; conflito de casing: ver #12 |
| `number` | Numérico | Usado em exemplos; conflito de casing: ver #12 |
| `Timestamp` | UTC timestamp | `[SPEC]` — planejado, fora da gramática |
| `Currency` | Valor monetário ISO 4217 | `[SPEC]` — planejado, fora da gramática |
| `URL` | URL RFC 3986 | `[SPEC]` — planejado, fora da gramática |
| `Email` | E-mail RFC 5322 | `[SPEC]` — planejado, fora da gramática |
| `PhoneE164` | Telefone ITU-T E.164 | `[SPEC]` — planejado, fora da gramática |
| `Date` | Data sem hora | `[SPEC]` — planejado, fora da gramática |

---

#### Constraints de `string` `[SPEC]`

Definidos em `syntax.md`, ausentes na gramática canônica:

| Constraint | Forma | Exemplo |
|---|---|---|
| `template` | Padrão estrutural com alfabeto legível (`9`=dígito, `A`=maiúscula, `a`=minúscula, `#`=alfanum, `*`=qualquer) | `flightNumber: string(template: "AA-9999")` |
| `format` | Tipo semântico nomeado do catálogo | `email: string(format: email)` |
| `regexp` | Regex como escape hatch | `iata: string(regexp: /^[A-Z]{2}[0-9]{1,4}$/)` |

Catálogo de `format`: `email`, `e164`, `iso8601`, `date`, `url`, `uuid`, `currency`, `country`, `language`.

---

### `.flow` — Keywords

#### `merge`

- **Descrição:** Incorpora os estados de outro arquivo `.flow` no namespace plano do arquivo atual. Todos os estados do arquivo mesclado ficam disponíveis como se fossem declarados inline.
- **Escopo:** `[F:raiz]` — **preamble-only**: deve aparecer antes de qualquer declaração `state` ou `on event`. Resolvido em compile-time (eager). Sem lazy loading.
- **Exemplo válido:**
  ```flow
  merge "phases/planning.flow"
  merge "phases/review.flow"

  state responsive
    interact
  ```

---

#### `on event`

- **Descrição:** Observer global que monitora um evento de background enquanto a máquina de estados principal executa. Equivalente a estados ortogonais em Statecharts.
- **Escopo:** `[F:raiz]` — top-level, após o preamble de `merge`.
- **Exemplo válido:**
  ```flow
  on event "action_failed"
    set worksession.backlog_count += 1
    run script "scripts/log_error.sh" "erro"
  ```

---

#### `state`

- **Descrição:** Declara um estado da máquina de estados. Estados são sempre planos — sem hierarquia em runtime. O nome pode usar ponto como separador lógico de namespace (`planning.context`), mas todos pertencem ao mesmo namespace plano.
- **Escopo:** `[F:raiz]` — top-level.
- **Exemplo válido:**
  ```flow
  state planning.context
    set worksession.active_phase = "planning"
    next planning.checks
  ```

---

#### `set`

- **Descrição:** Atribui um valor a uma variável de memória. Operadores: `=` (atribuição), `+=` (incremento), `-=` (decremento).
- **Escopo:** `[F:bloco]` — dentro de estados ou blocos `on event`. **Top-level `set` é inválido na gramática** (conflito #9).
- **Exemplo válido:**
  ```flow
  set context.active_phase   = "planning"
  set session.prompt_count   += 1
  set user.language          = "pt-br"
  set worksession.count      -= 1
  ```

---

#### `run`

- **Descrição:** Executa uma unidade de efeito colateral atômica. O tipo especifica o que será executado.
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Subtipos:**

| Subtipo | Semântica |
|---|---|
| `run script "arquivo.sh"` | Executa um script externo |
| `run subagent "nome"` | Invoca outro agente como subagente |
| `run tool "nome"` | Chama uma ferramenta/MCP |

- **Modificadores (após o target):**
  - `silent` — executa sem expor output ao usuário
  - `in background` — executa de forma não-bloqueante
  - `each context.colecao` — batch paralelo `[SPEC experimental]`

- **Exemplo válido:**
  ```flow
  run tool "booking.api" silent
  run script "scripts/detect-env.sh"
  run subagent "reviewer" in background
  ```

---

#### `guide`

- **Descrição:** Injeta texto de instrução no contexto da LLM. Aceita string literal ou caminho de arquivo (como string). Usado para orientar o comportamento da LLM no estado atual.
- **Escopo:** `[F:bloco]` — dentro de estados ou blocos de trigger.
- **Exemplo válido:**
  ```flow
  guide "Pergunte ao usuário qual carro prefere."
  guide "AGENTS.md"
  guide "planning-guide.md#phase_1"
  ```

---

#### `teach`

- **Descrição:** Injeta conhecimento no contexto. Semanticamente distinto de `guide` (instrução comportamental): `teach` injeta conteúdo factual ou referência de conhecimento.
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Exemplo válido:**
  ```flow
  teach "websearch.knowledge"
  ```

---

#### `goal`

- **Descrição:** Anotação do propósito do estado. Usada pela Runtime para documentação e pelo LSP. Aceita string literal.
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Forma na gramática:** `goal "texto"` — apenas string.
- **Forma em `syntax.md`:** `goal CapabilityName "texto"` — com identificador de capability antes da string. **Ausente na gramática** (conflito #6).
- **Exemplo válido (gramática atual):**
  ```flow
  goal "Coletar detalhes da reserva"
  ```
- **Exemplo em spec (não parseável hoje):**
  ```flow
  goal BookingAction "Coletar detalhes da reserva"
  ```

---

#### `interact`

- **Descrição:** Pausa a máquina de estados aguardando input do usuário. A LLM entra em modo conversacional até que um `on intent` seja satisfeito.
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Modificador:** `requiring "pergunta"` — orienta a LLM com uma pergunta específica para fazer. 
> [!error] COMENTÁRIO DO DANILO
> `interact requiring` existe por  alucinação de LLM durante vibe coding, deve ser removido ASAP.

- **Exemplo válido:**
  ```flow
  interact
  interact requiring "Qual agente deve ser evoluído?"
  ```

---

#### `apply` / `remove`

- **Descrição:** Manipulação de UI. Aplica ou remove um elemento de interface.
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Targets válidos:** `css`, `html`, `video`.
>[!warning] COMENTÁRIO DO DANILO
> Planejado para a v1 somente "arquivo.ext", não considerei manipulação direta de CSS ou HTML. Restringir e documentar a regra.

- **Exemplo válido:**
  ```flow
  apply css ".banner { display: none }"
  remove html "#modal"
  ```

---

#### `if` / `else`

- **Descrição:** Condicional. Avalia uma condição após a entrada no estado (procedural, não declarativo como XState). `else` é opcional.
- **Escopo:** `[F:bloco]` — dentro de estados ou blocos.
- **Operadores lógicos:** `and`, `or`.
- **Operadores de comparação:** `==`, `!=`, `>`, `<`, `>=`, `<=`.
- **Exemplo válido:**
  ```flow
  if session.is_first_time
    next onboarding
  else
    next responsive

  if worksession.count > 3 and session.has_context
    next review
  ```

---

#### `next`

- **Descrição:** Transição de estado — redireciona o fluxo para o estado nomeado.
- **Escopo:** `[F:bloco]` — dentro de estados, blocos de trigger, blocos `if/else`.
- **Status:** Keyword ativa na gramática canônica. `syntax.md` propõe substituição por `transition to` (conflito #1). **Os dois coexistem atualmente nos exemplos.**
- **Exemplo válido:**
  ```flow
  next responsive
  next planning.context
  ```

---

#### `transition to` `[SPEC]`

- **Descrição:** Proposta de substituição para `next` em `syntax.md`. Leitura mais natural em inglês. `go to` foi descartado (associação negativa). Seta `→` foi descartada (dependência de não-ASCII).
- **Escopo:** `[F:bloco]` — substituto direto de `next`.
- **Status:** **Definido em `syntax.md` e usado em `main.flow`. Ausente na gramática canônica. Decisão de migração pendente.**
- **Exemplo de uso (conforme spec):**
  ```flow
  on intent "goodbye" transition to completed
  ```

---

#### `on intent`

- **Descrição:** Trigger interpretado pela LLM. Quando a LLM identifica que o usuário expressou a intenção nomeada, o bloco ou transição inline é executado.
- **Escopo:** `[F:bloco]` — dentro de estados, após `interact`.
- **Formas:**
  - **Inline:** `on intent "texto" next estado`
  - **Bloco:** `on intent "texto"` seguido de bloco indentado
  - **Com contrato de dados** `[SPEC]`: `on intent "texto" with TipoNome` — ausente na gramática (conflito #5)
- **Exemplo válido (gramática atual):**
  ```flow
  on intent "confirm_booking" next completed
  on intent "cancel"
    guide "Reserva cancelada."
    next responsive
  ```
- **Exemplo em spec (não parseável hoje):**
  ```flow
  on intent "confirm_booking" with BookingConfirmation
    complete BookingAction
    transition to completed
  ```

---

#### `on escape`

- **Descrição:** Handler para quando o usuário abandona explicitamente a tarefa atual (identificado pela LLM). Perguntas off-topic dentro do estado **não** disparam `on escape`.
- **Escopo:** `[F:bloco]` — dentro de estados (local, sobrepõe o global) ou `[F:raiz]` (global, aplica a todos os estados).
- **Forma:** somente bloco indentado. Forma inline (`on escape next X` na mesma linha) gera ERROR no tree-sitter (conflito #14).
- **Exemplo válido:**
  ```flow
  // Global (top-level)
  on escape
    guide "Usuário abandonou a tarefa."
    next responsive

  // Local (dentro de state)
  state car_reservation
    on escape
      guide "Reserva cancelada. Retornando ao menu."
      next responsive
  ```

---

#### `on fallback`

- **Descrição:** Handler para falhas de runtime — ferramenta indisponível, subagente não respondeu, `run tool` retornou erro. **Não** é disparado por intenção não reconhecida (isso é apenas o loop `interact` continuando).
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Forma:** somente bloco indentado (mesma restrição de `on escape`).

- **Exemplo válido:**
  ```flow
  on fallback
    guide "Serviço indisponível. Retornando ao início."
    next responsive
  ```

---

#### `on offtopic` `[SPEC]`

- **Descrição:** Handler para quando o usuário muda voluntariamente de assunto para fora do domínio do estado atual (identificado pela LLM). Distinto de `on escape` (abandono explícito) e de intenção não reconhecida (loop continua).
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Status:** **Definido em `syntax.md`. Ausente na gramática canônica. Decisão de implementação pendente.**
>[!warning] COMENTÁRIO DO DANILO
> Planejado para substituir on escape, conceito original do on escape era esse, divergiu por alucinação da LLM durante vibe coding.
- **Exemplo de uso (conforme spec):**
  ```flow
  on offtopic transition to responsive
  ```

---

#### `complete` `[SPEC]`

- **Descrição:** Declara que o estado atual cumpre a capability nomeada e entrega o tipo especificado como output. Pode aparecer dentro de um bloco `on intent` ou como statement autônomo antes de `transition to`.
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Status:** **Definido em `syntax.md` e usado em `main.flow`. Ausente na gramática canônica** (conflito #2).
- **Exemplo de uso (conforme spec):**
  ```flow
  complete BookingAction
  complete BookingAction with BookingConfirmation
  complete GenerateAction with AvatarWithEars or AvatarWithMickey
  ```

---

#### `start ... in` `[SPEC]`

- **Descrição:** Chama uma capability de outro agente. Forma nomeada especifica o agente diretamente; forma anônima delega à Runtime encontrar o melhor match no registro.
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Status:** **Definido em `syntax.md` e usado em `travel (call car renting).flow`. Ausente na gramática canônica** (conflito #3).
- **Exemplo de uso (conforme spec):**
  ```flow
  // Nomeado
  start BookingAction in "carrent.com"
  on complete with BookingConfirmation
    set context.car_booking = results
    transition to confirm_trip
  on failed
    transition to error

  // Anônimo (Runtime resolve)
  start BookingAction
  on complete with BookingConfirmation
    transition to confirm_trip
  ```

---

#### `after N prompts` (experimental)

- **Descrição:** Trigger temporal: dispara após N trocas de prompt dentro do estado atual. Útil para pacing ou nudge de conversas inativas.
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Exemplo válido:**
  ```flow
  state waiting
    interact
    after 3 prompts
      guide "Ainda aqui — digite /done quando terminar."
  ```

---

#### `parallel` (experimental)

- **Descrição:** Executa um bloco de `run` statements em paralelo. Resultados disponíveis para `on complete`.
- **Escopo:** `[F:bloco]` — dentro de estados.
- **Exemplo válido:**
  ```flow
  parallel
    run subagent "meta_checks"
    run subagent "automation_radar"
  on complete
    set context.results = results
    next review_summary
  on failed
    next handle_error
  ```

---

#### `on complete` / `on failed`

- **Descrição:** Handlers para o resultado de um bloco `parallel`. `on complete` recebe os resultados agregados em `results`; `on failed` trata falhas parciais ou totais.
- **Escopo:** `[F:bloco]` — imediatamente após `parallel`, no mesmo nível de indentação.
- **Nota:** `on complete with TipoNome` após `start ... in` é uma forma diferente, definida em `syntax.md` mas ausente na gramática (conflito #7).
- **Exemplo válido:**
  ```flow
  parallel
    run subagent "checker"
  on complete
    next summary
  on failed
    next error
  ```

---

#### `into` (experimental)
>[!warning] COMENTÁRIO DO DANILO
> Não considerei inicialmente esse formato, ainda estou explorando isso vs atribuição `set xpto = run subagent`
- **Descrição:** Modificador de `run subagent` que atribui o output do subagente a uma variável de memória nomeada em vez de usar convenção implícita de sessão.
- **Escopo:** `[F:bloco]` — modificador de `run subagent`.
- **Status:** **Usado em `builder.flow`. Ausente na gramática canônica.** Roadmap Stage 7 identifica como "Hidden Return Contract ambiguity" pendente de resolução (conflito #11).
- **Exemplo de uso:**
  ```flow
  run subagent "planning_quality_checker" into worksession.quality_result
  ```

---

### Domínios de memória

| Domain | Lifetime | Semântica |
|---|---|---|
| `context` | Turno atual da LLM | Memória de trabalho ativa para o modelo |
| `session` | Thread de conversa atual | Estado cross-turn dentro de uma conversa |
| `worksession` | Unidade de trabalho atual | Dados de escopo de tarefa |
| `user` | Persistente (longo prazo) | Preferências e histórico do usuário |

**Operadores de assignment:** `=`, `+=`, `-=`.

---

## 3. Pontos de Ambiguidade e Conflitos de Sintaxe

> Cada conflito cita a fonte autoritativa do estado atual (gramática canônica) e a fonte divergente.

---

### Conflito #1 — `next` vs `transition to`

**Descrição:** `syntax.md` declara que `transition to` substitui `next`. A gramática canônica (`flow/grammar.js`) implementa somente `next`. Os exemplos divergem.

| Arquivo | Usa |
|---|---|
| `flow/grammar.js` (canônico) | `next` |
| `dsl/language.md §4.4` | `next` |
| `examples/builder/builder.flow` | `next` |
| `syntax.md` | `transition to` (substituto) |
| `examples/car renting/main.flow` | `transition to` |
| `examples/car renting/travel (call car renting).flow` | `transition to` |

**Impacto:** `main.flow` e `travel.flow` falham o parse com a gramática atual.

**Decisão necessária:** Qual é o keyword canônico para v1? Se `transition to`, a gramática e `language.md` precisam ser atualizados. Se `next`, os exemplos precisam ser corrigidos.

---

### Conflito #2 — `complete` ausente na gramática

**Descrição:** `complete BookingAction` e `complete BookingAction with BookingConfirmation` são definidos em `syntax.md` como statements de exit de capability. `main.flow` usa esta syntax. Não existe regra `complete_stmt` em `flow/grammar.js`.

**Nota:** `parallel_trigger` usa `on complete` (evento de parallel) — construção diferente, sem relação.

**Impacto:** `main.flow` falha o parse; o sistema de capabilities fica sem statement de fechamento válido.

---

### Conflito #3 — `start ... in` ausente na gramática

**Descrição:** `start BookingAction in "carrent.com"` é definido em `syntax.md` e usado em `travel (call car renting).flow`. Não existe regra `start_stmt` em `flow/grammar.js`.

**Impacto:** `travel.flow` falha o parse; chamadas cross-agent não têm representação na gramática.

---

### Conflito #4 — `on offtopic` ausente na gramática

**Descrição:** `on offtopic transition to responsive` é definido em `syntax.md`. Não existe regra correspondente em `flow/grammar.js`.

**Impacto:** Nenhum exemplo atual usa `on offtopic`; o conflito é spec-vs-gramática puro.

---

### Conflito #5 — `on intent ... with TypeName` ausente na gramática

**Descrição:** `syntax.md` e `main.flow` usam `on intent "x" with CarOptions`. A regra `intent_trigger` em `flow/grammar.js` não tem cláusula `with`.

```js
// Gramática atual — sem `with`
intent_trigger: $ => seq(
  'on', 'intent',
  field('intent', $.quoted_string),
  choice(
    seq('next', field('state', $.path), optional($._newline)),
    field('block', $.block),
  ),
),
```

**Impacto:** Contratos de dados em intents são impossíveis de declarar na gramática atual.

---

### Conflito #6 — `goal CapabilityName "text"` ausente na gramática

**Descrição:** `syntax.md` e `main.flow` usam `goal BookingAction "Coletar detalhes da reserva"`. A regra `goal_stmt` em `flow/grammar.js` aceita somente `quoted_string`.

```js
// Gramática atual — sem CapabilityName
goal_stmt: $ => seq('goal', field('text', $.quoted_string), optional($._newline)),
```

**Impacto:** A anotação de entry point de capability é inexpressável na gramática atual.

---

### Conflito #7 — `on complete with TypeName` após `start` ausente na gramática

**Descrição:** `travel (call car renting).flow` usa:
```flow
start BookingAction in "carrent.com"
on complete with BookingConfirmation
  ...
```
`parallel_trigger` em `flow/grammar.js` cobre `on complete/failed` mas sem cláusula `with`. Além disso, este `on complete` segue um `start`, não um `parallel`.

**Impacto:** A forma de receber output tipado de `start ... in` é inexpressável na gramática atual.

---

### Conflito #8 — `category` ausente na gramática

**Descrição:** `syntax.md` declara `category` como campo obrigatório em todo `type`, substituindo `concept` como campo URI principal. A gramática canônica (`grammar.js`) tem somente `concept_prop` e `schema_prop`. Nenhum exemplo usa `category`.

**Impacto:** A nova semântica de `category` (Wikidata QID para verificação de adapter) é inexpressável na gramática atual. Adotar `category` requer atualizar gramática + todos os exemplos.

---

### Conflito #9 — `set` top-level inválido na gramática

**Descrição:** `builder.flow` usa `set` antes de qualquer declaração de estado:
```flow
set worksession.active_phase = null
set worksession.backlog_count = 0
set user.has_profile = false
```
A regra `flow_file` em `flow/grammar.js` aceita somente `merge_decl`, `trigger_decl`, `state_decl`.

**Impacto:** `builder.flow` falha o parse na gramática atual.

---

### Conflito #10 — Assign de resultado de `run tool` inválido na gramática

**Descrição:** `builder.flow` usa:
```flow
set session.has_claude = run tool "Fs.Exists" "CLAUDE.md"
set context.claude_rules = run tool "Fs.ReadFile" "CLAUDE.md"
```
`run_stmt` é um statement, não uma expression. A gramática não permite `run_stmt` como valor do lado direito de `memory_stmt`.

**Impacto:** `builder.flow` falha o parse. Esta é uma feature de expressividade — run-as-expression — sem equivalente na gramática atual.

---

### Conflito #11 — `into` modifier ausente na gramática

**Descrição:** `builder.flow` usa:
```flow
run subagent "planning_quality_checker" into worksession.quality_result
```
`run_stmt` em `flow/grammar.js` aceita somente `silent`, `in background`, e `each collection`. `into` não é um modificador válido.

**Relação:** Roadmap Stage 7 identifica isso como "Hidden Return Contract ambiguity" pendente de resolução.

---

### Conflito #12 — `number` vs `Number` (casing de primitivo)

**Descrição:** Dois casos registrados:

| Arquivo | Usa |
|---|---|
| `examples/car renting/car renting.agent` | `amount: number` (lowercase) |
| `dsl/language.md §3.2` | `balance: Number` (PascalCase) |

A gramática trata ambos como `type_ref` (identifier simples). Não há distinção de parsing, mas a convenção de naming é contraditória: `language.md §3.3` estabelece PascalCase para tipos, o que implicaria `Number`.

**Decisão necessária:** Definir casing canônico. Recomendação implícita da spec: PascalCase (`Number`) — mas o exemplo diverge.

---

### Conflito #13 — `worksession` vs `project` (domain de memória)

**Descrição:** Dois registros contraditórios no roadmap:

| Estágio | Registro |
|---|---|
| Stage 4 ✅ | "Resolver: `project` vs `worksession` — alinhado. Adotar `worksession` globalmente." |
| Stage 7 (aberto) | "Resolver: `project` vs `worksession` — alinhar gramática e spec." |

A gramática atual usa `worksession` (correto). O Stage 7 relista como aberto — provavelmente referindo-se ao `org-spec/` que ainda usa `project`.

**Impacto:** Confusão de rastreabilidade. O conflito real está em `org-spec/`, não na gramática principal.

---

### Conflito #14 — `on escape` / `on fallback` forma inline

**Descrição:** Limitação conhecida documentada no `roadmap.md`: `on escape next X` e `on fallback next X` na mesma linha geram nó ERROR no tree-sitter porque a gramática exige bloco indentado.

```js
// Gramática atual — bloco obrigatório
escape_stmt:   $ => seq('on', 'escape',   field('block', $.block)),
fallback_stmt: $ => seq('on', 'fallback', field('block', $.block)),
```

**Decisão necessária para v1:** Manter somente a forma de bloco (consistente com a gramática atual, exige que exemplos não usem inline) **ou** adicionar suporte à forma inline?

---

### Conflito #15 — `behavior` com conteúdo indentado

**Descrição:** `builder.agent` tem comentários indentados sob `behavior builder.flow`:
```agent
behavior builder.flow
  // A Lógica, Persona e Mapeamento de Ferramentas residem estritamente no .flow.
  // ...
```
A gramática define:
```js
behavior_block: $ => seq('behavior', field('file', $.bare_string), $._newline),
```
Sem suporte a bloco indentado. O conteúdo seria um ERROR na gramática.

**Nota:** Trata-se de comentários em arquivo de exemplo — podem ser simplesmente removidos. Mas indica uma confusão de design sobre se `behavior` deveria aceitar metadados de bloco.

---

### Conflito #16 — `concept` obrigatoriedade vs `category`

**Descrição:** `syntax.md` estabelece:
- `category` = obrigatório (Wikidata QID, usado pela Runtime para adapter compatibility)
- `concept` = opcional (Schema.org ou Wikidata, não mais usado em decisões de runtime)

A gramática canônica lista somente `concept_prop` e `schema_prop` em `type_property`. `concept` permanece como única opção de âncora semântica.

**Todos os exemplos usam `concept`, nenhum usa `category`.**

**Impacto:** Se `category` for adotado como obrigatório para v1, exige: atualizar `grammar.js`, atualizar todos os exemplos, e definir o comportamento de `concept` legacy (ignorado? aviso do linter?).

---

## 4. Notas de Revisão e Decisões em Aberto

### 4.1 Decisões de sintaxe que bloqueiam o fechamento da v1

Estas decisões afetam diretamente a gramática canônica e precisam ser tomadas antes de qualquer bump de versão:

---

**D1 — Keyword de transição: `next` ou `transition to`?**

- `next` está na gramática, em `language.md`, e em `builder.flow`.
- `transition to` está em `syntax.md` e nos exemplos `car renting/`.
- **Opções:** (a) Adotar `transition to` globalmente, atualizar gramática e `language.md`; (b) Reverter para `next` como canônico, corrigir exemplos; (c) Aceitar ambas como formas válidas (aumenta superfície da gramática).

---

**D2 — Implementar `complete`, `start ... in`, `on offtopic` na gramática?**

Estes três statements estão em `syntax.md` e em exemplos, mas ausentes na gramática. São necessários para o modelo de capabilities funcionar end-to-end. Sem eles, nenhum exemplo de cross-agent flow é parseável.

---

**D3 — Implementar `with TypeName` em `on intent` e `on complete`?**

Cláusula de contrato de dados. Sem ela, a validação de tipo em fronteiras de intent é impossível na gramática.

---

**D4 — `category` é obrigatório em v1?**

Se sim: atualizar gramática (adicionar `category_prop`), tornar `concept` opcional, atualizar todos os exemplos. Se não: manter `concept` como único anchor e registrar `category` como feature futura.

---

**D5 — `number` ou `Number`?**

Definir casing canônico de primitivos. A convenção da spec (PascalCase para tipos) sugere `Number`. O exemplo `car renting.agent` usa `number`. Definir e corrigir os exemplos.

---

**D6 — Top-level `set` e `run-as-expression` no `.flow`?**

`builder.flow` usa ambos. São features de expressividade significativas (inicialização de variáveis de sessão, atribuição de resultado de ferramenta). Se aprovadas para v1, exigem extensões não triviais na gramática. Se rejeitadas, `builder.flow` precisa ser reescrito.

---

**D7 — `into` como modificador de `run subagent`?**

Resolve o Hidden Return Contract (Stage 7). Sem `into`, a forma de acessar o output de um subagent é implícita e não especificada — convenção que cada Runtime pode interpretar diferente.

---

**D8 — `on escape` / `on fallback` forma inline?**

Manter somente bloco (estado atual) ou adicionar suporte inline? A limitação está documentada no roadmap como "requer fix no `flow/grammar.js`".

---

**D9 — `goal CapabilityName "text"`?**

Necessário para marcar entry points de capabilities no flow. Sem isso, a Runtime não pode resolver `start BookingAction in "..."` para um estado específico sem convenção implícita de naming.

---

### 4.2 Questões abertas de `syntax.md`

- **`format` extensível por agente?** Deve ser possível declarar `format iata_airline /^[A-Z]{2}$/` localmente, ou o catálogo de `format` é apenas extensível via versões da spec?
- **`template` com segmentos opcionais?** `template: "AA[-9999]"` — segmentos opcionais são válidos, ou o template deve ser sempre totalmente preenchido?
- **Validação de `or` em `complete ... with A or B`:** Em parse-time (os tipos devem existir nas declarações de output do agente) ou somente em runtime?

---

### 4.3 Questões abertas de `language.md §7`

- **HTTP/MCP interface declaration:** Agentes que são wrappers MCP (como `figma.agent`) não têm forma de declarar que expõem endpoints HTTP. Candidatos: keyword `server` na DSL; atributo de Layer 2 inferido por análise estática; registro explícito no `.well-known`.
- **`each` dynamic parallelism:** `run subagent "x" each context.files` está na gramática como experimental. A semântica de runtime (acumulação de resultados, falha parcial) não está especificada.
- **Human-in-the-loop gate:** `interact` pausa para input conversacional. Workflows que precisam de autorização explícita antes de executar uma ferramenta de alto risco não têm mecanismo distinto.
- **Checkpointing:** Implícito em cada `next`/`transition to`, ou requer diretiva explícita?
- **Timeouts:** Sem limite temporal em `run tool` ou `run subagent`, uma chamada travada paralisa a máquina indefinidamente.
- **`.logic` em `org-spec/`:** Documentos do `org-spec/` ainda referenciam `.logic` (termo depreciado para `.run`). Exige atualização em passe separado naquele submodule.

---

### 4.4 TODOs de `builder.agent`

Registrados como comentários no arquivo; indicam buracos de spec não resolvidos:

- **Bloco `requirements`:** Para declarar dependências de ambiente (ex: `Runtime (Claude Code, Gemini)`). A gramática atual não tem este bloco.
- **Persona / System Prompt:** `builder.agent` pergunta onde mora `jobTitle`, `publishingPrinciples` e guidelines de persona. A spec atual delega ao `AGENTS.md` injetado via `guide "AGENTS.md"` — mas isso não é declarado no manifesto. Deve o `.agent` ter um bloco `persona`?
- **Endpoints CLI vs MCP (`softwareAddOn`):** Agentes que rodam via shell local ou servidor MCP não têm forma de declarar suas interfaces. Relacionado à questão de HTTP/MCP declaration.
- **Anatomia física do pacote (`hasPart`):** A spec atual foca na API lógica; não audita a estrutura de arquivos do pacote (ex: presença de `AGENTS.md`, `data/`, `phases/`). Deve o manifesto declarar `hasPart`?
- **Sandbox e tmp:** A spec deve padronizar se o sandbox tem ou não acesso a `tmp`? Relevante para dispositivos com armazenamento limitado (ex: Raspberry Pi com SD card).

---

### 4.5 Roadmap — itens abertos que afetam a gramática

| Estágio | Item | Impacto na gramática |
|---|---|---|
| Stage 7 | Spec fix: hidden return contract (`into` syntax) | Adicionar `into` como modificador de `run subagent` |
| Stage 7 | `timeout` como keyword reservada em blocos de execução | Nova regra de modificador |
| Stage 7 | `worksession` vs `project` em `org-spec/` | Sem impacto na gramática principal |
| Stage 8 | Linter para tipos que fazem shadow de `std.*` | LSP feature, sem impacto na gramática |

---

### 4.6 Itens já fechados (para referência)

| Decisão | Resultado |
|---|---|
| `on escape` requer bloco `guide`? | Não. `transition to` puro é suficiente. |
| `on fallback` para intents não reconhecidos? | Não. Intenção não reconhecida = loop `interact` continua. |
| Um `goal` e um `guide` por estado? | Sim. Mais de um = redesenhar em estado separado. |
| Lazy loading via `merge`? | Não. `merge` é preamble-only, eager. Casos complexos vão para `.run`. |
| Keyword de domain de memória: `worksession` ou `project`? | `worksession` (gramática já atualizada). |
| `concept` com anotação de label: `concept URL (label)`? | Suportado na gramática. |
