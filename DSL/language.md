# Agent DSL — Linguagem e Arquitetura

Referência completa da linguagem `.agent`: princípios de design, sintaxe, sistema de tipos, modelo de segurança e estratégia de empacotamento.

Para a especificação formal (EBNF) consulte [`grammar.md`](grammar.md). Para a implementação do parser consulte [`tree-sitter-agent/grammar.js`](tree-sitter-agent/grammar.js).

---

## 1. Visão Geral: Runtime como Sistema Operacional

A Runtime (seja Gemini, Claude, ou um motor customizado) atua como o "Sistema Operacional" do ecossistema de agentes. Ela lê os manifestos, resolve dependências e orquestra a execução de sub-agentes e fluxos.

```
Ecossistema
 ├── Agents      — Manifestos declarativos: "O que eu sou"
 ├── Behaviors   — Arquivos .flow: "Como eu funciono"
 ├── Types       — Contratos de dados mapeados a Wikidata/Schema.org
 ├── Capabilities — Ações e permissões de sandbox
 └── Runtime     — O "OS": resolve dependências, roda LLMs, valida contratos
```

Um conceito central é o **determinismo**: a Runtime não inventa a estrutura de dados em runtime. Todo dado que trafega entre agentes precisa de um contrato explícito.

### Exemplo de orquestração via `requires`

1. Um sistema aciona o agente `Doctor`
2. A Runtime lê: `requires Prontuario`
3. Percebe que o `Prontuario` não está no contexto da chamada
4. Busca na rede de agentes quem tem `output Prontuario`
5. Aciona o agente `Triage`, valida se o JSON retornado bate com a estrutura declarada, e repassa ao `Doctor`

---

## 2. Princípios de Design

1. **Zero ruído:** Sem chaves `{}`, sem vírgulas `,` obrigatórias em blocos, sem dois-pontos `:` em chave-valor. O arquivo deve parecer um diagrama textual, não código.
2. **Indentação semântica:** O escopo é definido por indentação de 2 espaços (similar a Python/YAML). O parser usa um scanner externo para rastrear níveis de indentação.
3. **Schema.org como padrão:** Tipos não qualificados assumem Schema.org como referência em tempo de design. Em runtime, a resolução segue a hierarquia de namespaces (ver §9).
4. **Determinismo:** Tipos customizados devem ser declarados explicitamente com âncora semântica (Wikidata). O LLM nunca infere estrutura de um tipo customizado dinamicamente.

---

## 3. Estrutura Base (`agent`)

A keyword `agent` define o nó principal. Os metadados de identidade (`domain`, `license`, `terms`, `privacy`) ficam indentados sob o `agent`. Os blocos semânticos (`description`, `behavior`, `requires`, etc.) são **top-level** no arquivo, implicitamente associados ao agent que os precede.

```
agent Analyst
  domain figma.com
  license MIT
  terms https://figma.com/terms
  privacy https://figma.com/privacy

description
  Um agente financeiro que analisa despesas e gera relatórios

behavior analyst.flow
requires BankStatement
input
  Person "O usuário pedindo análise financeira"
capabilities
  CalculateAction "Permite realizar cálculos matemáticos"
  SearchAction "Busca taxas financeiras externas"
output
  FinancialProduct "O produto recomendado para o usuário"
```

### Keywords dos blocos semânticos

| Keyword | Função |
|---|---|
| `description` | Texto livre descrevendo o agente. Usado pela Runtime para indexação semântica. |
| `behavior` | Arquivo `.flow` que gerencia estado e transições. Sempre inline: `behavior agent.flow`. |
| `requires` | Tipos que a Runtime deve garantir no contexto antes de acionar o `.flow`. |
| `input` | Tipos de dados de entrada necessários para o agente operar. |
| `capabilities` | Ações (Schema.org `Action`) ou recursos que o agente pode usar. Também é o contrato de sandboxing. |
| `output` | Tipo de dado retornado pelo agente. |

---

## 4. Tipos Customizados (`type`)

Sempre que um agente usar um dado que não existe no Schema.org, o tipo deve ser declarado com `type`. A declaração serve como **contrato duro** para a Runtime — o LLM nunca tenta inferir a estrutura de um Custom Type.

```
type BankStatement
  concept https://www.wikidata.org/wiki/Q806653
  account: Person "Titular da conta"
  transactions: [Transaction]
  balance: Number
  status: Enum(active, closed, suspended)
  avatar?: ImageObject "Foto do titular (opcional)"
```

### Keywords dentro de `type`

| Keyword | Função |
|---|---|
| `concept` | URL Wikidata ou Schema.org que ancora o significado semântico globalmente. Evita ambiguidade entre agentes de fornecedores diferentes. |
| `schema` | (Opcional) Arquivo JSON Schema estrito para validação: `schema bankstatement.json` |

### Formas de valor de propriedade

| Forma | Exemplo | Semântica |
|---|---|---|
| Tipo simples | `account: Person` | Referência a um tipo |
| Array | `transactions: [Transaction]` | Lista tipada |
| Enum | `status: Enum(active, closed)` | Conjunto fechado de literais |
| Opcional | `avatar?: ImageObject` | O `?` marca campo opcional |
| Com descrição | `account: Person "Titular"` | String entre aspas documenta a propriedade |

---

## 5. Comentários

Qualquer linha (ou trecho) iniciado com `//` é ignorado pelo parser.

```
// Este agente está em rascunho
agent Draft
  domain example.com
```

Comentários podem aparecer inline ou em linhas próprias, incluindo dentro de blocos.

---

## 6. Convenções de Nomenclatura

| Elemento | Convenção | Exemplos |
|---|---|---|
| Agent name | Palavras separadas por espaço (cada uma capitalizada) | `agent Doctor`, `agent Mickey Mouse` |
| Tipo customizado | PascalCase contínuo | `UserProfile`, `BankStatement`, `MedicalCondition` |
| Stdlib namespace | `std.` + PascalCase | `std.Prompt`, `std.ImageObject` |
| Custom namespace | `custom.` + PascalCase | `custom.SpeechSynthesis` |
| Propriedade de tipo | camelCase | `patient`, `createdAt`, `transactionList` |

O parser distingue os dois contextos estruturalmente: após `agent` sempre vem um `agent_name` (palavras); após `input`, `output`, etc. sempre vem referências de tipo (PascalCase).

---

## 7. Modos de Sintaxe: Compact vs Documented

Os blocos `requires`, `input`, `capabilities` e `output` suportam dois modos:

### Compact (inline, sem descrições)

```
input Patient, MedicalCondition
capabilities DiagnoseAction, CreateAction
requires Prontuario, UserProfile
```

### Documented (bloco indentado, com descrições opcionais)

```
input
  Patient "O paciente a ser atendido"
  MedicalCondition

capabilities
  DiagnoseAction "Emite diagnósticos clínicos"
  custom.SpeechSynthesis "Síntese de voz com a voz do personagem"

requires
  Prontuario ("Electronic health record")
  UserProfile
```

A diferença entre anotação e descrição:
- **Anotação em parênteses** `Type ("texto")` — em `type_reference`, documenta o significado daquele tipo naquele contexto específico
- **Descrição em string** `Type "texto"` — em `typed_item`/`cap_item` (blocos de input/output/capabilities), documenta a finalidade do item

---

## 8. O Paradigma do "Header File" (`.agent` vs `.flow`)

O arquivo `.agent` é análogo a um **Header File (`.h`)** em C: expõe publicamente o que o agente faz, o que consome e o que requer.

O arquivo `.flow` é a **Implementação (`.c`)**: contém a lógica de estado, injeção de prompts e execução.

**Por que isso é necessário:** em um ecossistema distribuído, ler dezenas de arquivos `.flow` extensos para descobrir agentes seria inviável. O `.agent` permite indexação e Tool Discovery instantâneos. O bloco `capabilities` força o desenvolvedor a declarar suas capacidades, que a Runtime obriga a serem mapeadas no `.flow`.

---

## 9. Hierarquia de Namespaces e Shadowing

Para manter a sintaxe limpa (sem imports no topo do arquivo), a linguagem usa resolução de escopo implícita. A prioridade em runtime é:

1. **Customizado** — declarações `type` no próprio pacote (precedência absoluta)
2. **Standard Library** (`std.*`) — tipos pré-definidos pela Spec
3. **Global** — Schema.org / Wikidata

O escopo local tem *shadowing* absoluto: se existir um `type Prompt` local, ele sobrescreve `std.Prompt` automaticamente, prevenindo que atualizações de terceiros quebrem o agente.

*Exemplo:* O tipo `Prompt` é lido. Se houver `type Prompt` local → usa local. Caso contrário, a Runtime acha `std.Prompt`.

---

## 10. Segurança e Capabilities

O bloco `capabilities` não é apenas descritivo — é um **Contrato de Sandboxing**. A Runtime usa essa lista para determinar quais permissões o agente possui.

Se o agente declarar `SelfEvolution` ou `AgentCreation`, a Runtime intercepta essas requisições e pode exigir autorização humana explícita (Human-in-the-Loop) antes de alterar pacotes em `.agents/*`.

### 10.1 Identidade e Anti-Spoofing (o bloco `domain`)

Declarar `domain figma.com` transforma o manifesto local em um ponteiro para a autoridade oficial:

1. **Validação W3C:** A Runtime verifica a identidade usando W3C DIDs ou diretórios `.well-known`
2. **Sincronização:** A Runtime pode buscar a definição canônica em `https://figma.com/.well-known/agents/Figma.agent` e sobrescrever o manifesto local
3. **Anulação de falsificações:** Se um atacante criar um agente com `domain figma.com`, a Runtime fará o fetch no servidor real. Se o servidor não listar aquele agente, o pacote local é invalidado

Agentes comunitários informais podem omitir `domain` — a Runtime os trata como "Não-verificado".

---

## 11. Empacotamento em 3 Camadas

Para manter o manifesto humano livre de ruído sistêmico (versões, changelogs, categorias de marketplace), o ecossistema adota uma arquitetura de 3 camadas:

### Layer 1: Human DX (Authoring)

O que o desenvolvedor humano escreve e mantém:

- **Contém:** `.agent`, `.flow`, `AGENTS.md` (persona e diretrizes)
- **Não contém:** versões (`v1.0.2`), changelogs, listas de arquivos, categorias de marketplace
- **Exceção:** `domain`, `license`, `terms`, `privacy` ficam aqui por serem identidade e compliance fundamentais

### Layer 2: Tooling & AI Generated (The Envelope)

Gerado por CLIs de build ou pela Runtime no momento de publicação:

- **Versionamento:** Derivado do histórico git (ex: `urn:agent:com.figma:v2:a1b2c3d4`). O humano não escreve `version`.
- **Categorização:** Inferida pela LLM de ingestão com base nos tipos de `input`/`output`. Se o agente consome `BankStatement` e produz `FinancialReport`, é classificado como `FinanceApplication` automaticamente.
- **Integridade de arquivos:** O empacotador audita `/data` e `/scripts` e gera um `checksum.lock` invisível ao autor.

### Layer 3: Machine (Execution & Registry)

A representação otimizada que o SO da Runtime lê:

- **Contém:** JSON-LD transpilado, binários WASM (se houver `.run`), e o `.agent` fundido com o envelope da Layer 2 para descoberta via MCP

### Decisões de design resolvidas

| Questão | Decisão |
|---|---|
| Onde fica Persona/Prompt? | Arquivos `.md` isolados. O `.flow` invoca via `guide "AGENTS.md"`. O `.agent` não se envolve. |
| Como mapear Actions a arquivos? | O `.agent` declara a Action. O `.flow` escuta e aciona o script. |
| Onde fica o versionamento? | Layer 2 (inferido do git). Ausente na Layer 1. |
| Como declarar interfaces HTTP/MCP? | Em aberto — candidatos: keyword `server` ou `endpoint` na DSL, ou atributo na Layer 2. |

### Questão em aberto: declaração de interfaces de acesso

Se o agente for um wrapper de MCP (como o `figma.agent`), ainda não há sintaxe formal para declarar que ele expõe endpoints HTTP. Candidatos sendo avaliados:

- Keyword `server` na DSL (Layer 1)
- Atributo na Layer 2 inferido por análise estática das `capabilities`
- Registro explícito no `.well-known` do domínio
