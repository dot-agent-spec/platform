# dot-agent CLI — Spec V1

## Repositório

```
https://github.com/dot-agent-spec/dot-agent
```

Publicado no npm como `dot-agent` (bin: `dot-agent`).

## Referência Canônica

A estrutura do arquivo `.agent` (ZIP) e o formato do `aboutme.json` seguem a especificação em [`file structure.md`](./file%20structure.md). O CLI implementa a validação, empacotamento e execução dessa especificação.

---

## Ecossistema de Dependências

O CLI **não reimplementa parsing nem execução de FSM**. Consome os pacotes já existentes na org:

| Pacote | Repo | Papel no CLI |
|---|---|---|
| `@dot-agent/tree-sitter` | `dot-agent-spec/tree-sitter` v0.3.2+ | Parse + lint sintaxe de `.description` e `.behavior` via WASM |
| `@dot-agent/kernel-dsl` | `dot-agent-spec/kernel-dsl` | Carregamento de `.behavior` (usa tree-sitter internamente + valida semântica) + execução FSM ao runtime |

**Tree-sitter** exporta `agentWasmPath` e `behaviorWasmPath` — caminhos absolutos para os `.wasm` pré-compilados em `dist/`:
- `tree-sitter-agent.wasm` para `.description` / `.type`
- `tree-sitter-behavior.wasm` para `.behavior` (sintaxe)

O CLI carrega ambos via `web-tree-sitter` (já WASM, sem binding C nativo).

**Kernel-dsl** (`AgentDSLKernel`) é instanciado no `pack` (para validação semântica via `load_behavior()`) e no `run` (para execução FSM). Internamente, o kernel:
- Usa tree-sitter para parse robusto
- Valida semântica (referências de estados, memory, etc)
- Executa como FSM (intents, transitions, effects)

Se `load_behavior()` retorna `parse_error` effect, o lint mapeia para E006.

---

## Visão Geral

O `dot-agent` expõe dois pontos de entrada com a mesma base de código:

| Ponto de entrada | Quem usa | Como | Status |
|---|---|---|---|
| `index.ts` (API JS) | Electron / app | `import { run, pack, unpack, init } from 'dot-agent'` | ✅ Implementado |
| `cli.ts` (bin) | Terminal / npx | `npx dot-agent <comando>` | ✅ Implementado |

O `cli.ts` é um wrapper fino: parse de args → chama a mesma função de `index.ts`.

---

## Estrutura do Pacote

```
dot-agent/
├── src/
│   ├── commands/
│   │   ├── init.ts       ← gera scaffold
│   │   ├── pack.ts       ← valida + empacota → .agent
│   │   ├── unpack.ts     ← extrai .agent → fontes
│   │   └── run.ts        ← carrega .agent, retorna AgentContext
│   ├── core/
│   │   ├── lint.ts       ← orquestra validação (tree-sitter + kernel-dsl)
│   │   ├── zip.ts        ← leitura/escrita ZIP (jszip)
│   │   ├── envelope.ts   ← parse/geração do aboutme.json
│   │   ├── id.ts         ← geração e parsing de id (namespace/name:version~digest)
│   │   └── types.ts      ← validação e geração de types.json (tipos públicos)
│   ├── index.ts          ← export público da API
│   └── cli.ts            ← bin entry point
├── tests/
├── package.json
└── tsconfig.json
```

---

## package.json (estrutura relevante)

```json
{
  "name": "dot-agent",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "dot-agent": "dist/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "@dot-agent/tree-sitter": "^0.3.2",
    "@dot-agent/kernel-dsl": "latest",
    "jszip": "^3.10.1",
    "web-tree-sitter": "^0.25.0"
  }
}
```

**Nota:** `"type": "module"` é obrigatório pois `@dot-agent/kernel-dsl` é ESM-only. Requer Node 18+.

---

## WASM Initialization

O CLI deve inicializar tree-sitter e kernel-dsl uma vez, antes de qualquer lint ou run. Ambas as bibliotecas fornecem WASM via `fetch()` nativo (Node 18+).

### Tree-sitter

O pacote `@dot-agent/tree-sitter` exporta **apenas paths**, não instâncias Parser:

```typescript
import Parser from 'web-tree-sitter'
import { agentWasmPath, behaviorWasmPath } from '@dot-agent/tree-sitter'

// Chamado uma vez, preferencialmente em core/lint.ts
async function initTreeSitter() {
  await Parser.init()
  const agentLang = await Parser.Language.load(agentWasmPath)
  const behaviorLang = await Parser.Language.load(behaviorWasmPath)
  return { agentParser: new Parser(), behaviorParser: new Parser(), agentLang, behaviorLang }
}
```

Após `initTreeSitter()`, as instâncias são **reutilizadas** via `parser.setLanguage()`:

```typescript
const { agentParser, agentLang } = await initTreeSitter()
agentParser.setLanguage(agentLang)
const tree = agentParser.parse(descriptionText)
```

### Kernel-dsl

O pacote `@dot-agent/kernel-dsl` exporta `{ AgentDSLKernel, init }` — `init()` é async, sem parâmetros, idempotente:

```typescript
import { AgentDSLKernel, init as initKernel } from '@dot-agent/kernel-dsl'

await initKernel() // carrega WASM (~1.7MB via fetch)
const kernel = new AgentDSLKernel()
```

Se `new AgentDSLKernel()` for chamado antes de `initKernel()`, lança erro. Seguro chamar `initKernel()` múltiplas vezes — é idempotente.

### Padrão para o CLI

Em `core/lint.ts`, implementar lazy singleton:

```typescript
let _initialized = false

async function ensureWasmInit() {
  if (_initialized) return
  await Parser.init()
  await initKernel()
  _initialized = true
}

// Exportado
export async function createLinter() {
  await ensureWasmInit()
  // ... retorna funções de lint
}
```

---

## Mapeamento de Erros (tree-sitter → lint codes)

Tree-sitter retorna uma AST onde erros são nós nomeados `ERROR` ou nodes com `isMissing === true`. O CLI coleta erros via:

```typescript
function collectSyntaxErrors(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
  const errors: Parser.SyntaxNode[] = []
  if (node.isError || node.isMissing) errors.push(node)
  for (const child of node.children) errors.push(...collectSyntaxErrors(child))
  return errors
}
```

**Mapeamento para lint codes:**

- Erros em `.description` (tree-sitter):
  - Campo obrigatório ausente (ex: `domain`, `name`, `version`) → E001
  - Campo obrigatório em `capability` (ex: `type`) ausente → E002
  - `.description` arquivo não encontrado → E003

- Erros em `.behavior` (tree-sitter sintaxe):
  - Erro de sintaxe DSL (state, on, transition, if, etc) → E004
  - `.behavior` arquivo não encontrado → E007

- Erros do kernel (`load_behavior()` effects):
  - `parse_error` effect com message → E006
  - Estado referenciado não existe (pode ser detectado via `get_graph()` comparado com `on intent "..."`) → E005

- Erros manuais:
  - Arquivo referenciado em `files.json` não existe → E008

---

## Estrutura do `.agent` (ZIP)

Conforme especificado em [`file structure.md`](./file%20structure.md):

```
meu-agente.agent (ZIP)
│
│  # Metadados gerados — Layer 2 🤖
├── .agent/
│   ├── aboutme.json       ← sempre presente
│   ├── types.json         ← quando há tipos públicos
│   └── files.json         ← quando há fontes
│
│  # Comportamento — Layer 1 👤
├── agent.description
├── agent.behavior
├── behaviors/
│   └── *.behavior
├── guides/
│   └── *.md
├── knowledge/
│   └── *.md
└── SOUL.md
```

O `aboutme.json` é o único arquivo obrigatório. Os fontes ficam na raiz do ZIP. O `files.json` referencia arquivos relativos à raiz:

```json
{
  "description": "agent.description",
  "behavior":    "agent.behavior",
  "behaviors":   ["behaviors/*.behavior"],
  "guides":      ["guides/*.md"],
  "knowledge":   ["knowledge/*.md"]
}
```

### Exemplo concreto de `aboutme.json` V1

```json
{
  "schemaVersion": "dot-agent/1.0",
  "id": "entelekheia.ai/doctor:v1.0~a1b2c3d",
  "name": "Doctor",
  "description": "Agente médico para triagem inicial de pacientes.",
  "version": "v1.0",
  "domain": "entelekheia.ai",
  "license": "Apache-2.0",
  "persona": "SOUL.md",
  "compiler": "dot-agent/1.0.0",
  "commit": "a1b2c3d",
  "skills": [
    { "id": "TriagePatient", "description": "Triagem inicial de pacientes" }
  ],
  "requires": ["UserProfile"],
  "integrity": {
    "sha256": "e3b0c44298fc1c149afbaf8b2b...",
    "files": ".agent/files.json"
  }
}
```

**Notas:**
- `purpose` omitido no V1 (mapeado futuramente por `builder.agent` + LLM)
- `integrity.types` só aparece quando há tipos públicos
- `compiler` é a versão do dot-agent CLI que gerou o pacote
- `commit` fica ausente se o projeto não usa Git

---

## API Pública (`index.ts`)

```typescript
export function init(options: InitOptions): Promise<InitResult>
export function pack(options: PackOptions): Promise<PackResult>
export function unpack(options: UnpackOptions): Promise<UnpackResult>
export function run(options: RunOptions): Promise<AgentContext>
```

---

## Comandos

---

### ✅ `dot-agent init`

Gera o scaffold completo do projeto.  
Não é interativo na V1 — o desenvolvedor edita os arquivos gerados.

**CLI:**
```
dot-agent init [--name <nome>] [--domain <domínio>] [--dir <pasta>]
```

**API:**
```typescript
interface InitOptions {
  name?: string       // padrão: nome da pasta atual
  domain?: string     // padrão: "example.com" (⚠ W003 no pack)
  dir?: string        // padrão: process.cwd()
}

interface InitResult {
  dir: string
  files: string[]     // lista de arquivos criados
}
```

**Arquivos gerados:**
```
<dir>/
├── agent.description
├── agent.behavior
├── behaviors/          (.gitkeep)
├── guides/             (.gitkeep)
├── knowledge/          (.gitkeep)
├── SOUL.md
├── AGENTS.md           (vazio — para documentação de dependências)
├── README.md
└── LICENSE             (Apache 2.0)
```

**Templates:**

`agent.description`:
```
agent {{Name}}
  domain {{domain}}
  license Apache-2.0

description
  {{Describe what this agent does.}}

behavior agent.behavior

capabilities
  {{ActionName}} "{{Describe this capability}}"
```

`agent.behavior`:
```
state init
  next responsive

state responsive
  goal "{{Help the user with their task.}}"
  interact
  on intent "start" next responsive
```

`SOUL.md`: Texto livre sobre persona/voz do agente. Placeholder:
```markdown
# {{Name}} — Persona

## Voice and Tone

{{Describe the agent's voice, personality, and communication style.}}
```

`README.md`: Título + descrição + seção de uso (placeholders).

**Comportamento:**
- Aborta se o diretório já contiver `agent.description`
- Não preenche `version` no `.description` — versão é resolvida em tempo de `pack`
- Developer edita os templates antes de chamar `pack`

---

### ✅ `dot-agent pack`

Valida a DSL e empacota os fontes em um arquivo `.agent` (ZIP).

**CLI:**
```
dot-agent pack [--dir <pasta>] [--out <arquivo.agent>] [--commit <hash>] [--version <tag>]
```

**API:**
```typescript
interface PackOptions {
  dir?: string
  out?: string        // padrão: <name>.agent no dir
  commit?: string     // override para git rev-parse --short HEAD
  version?: string    // override para git describe --tags --abbrev=0
}

interface PackResult {
  path: string
  id: string          // namespace/name:version~digest (conforme file structure.md)
  warnings: LintMessage[]
}

interface LintMessage {
  file: string
  line: number
  col: number
  severity: 'error' | 'warning'
  code: string
  message: string
}
```

**Resolução de `version` e `commit`:**

| Campo | Prioridade |
|---|---|
| `version` | 1. `--version <tag>` 2. `git describe --tags --abbrev=0` 3. Interativo: `Agent version (e.g. v1.0):` |
| `commit` | 1. `--commit <hash>` 2. `git rev-parse --short HEAD` 3. Ausente (não bloqueia pack) |

Se Git não estiver disponível e versão não for passada, o pack pergunta interativamente.

**Fluxo interno:**
1. Localiza `agent.description` e `agent.behavior` no `dir`

   **Lint do `.description`:**
2. Parse via `@dot-agent/tree-sitter` (WASM)
3. Valida campos obrigatórios: `domain`, `name`, `version`, `capability` com `type`
4. Valida semântica: tipos bem-formados, nomes únicos, referências válidas → mapeia erros para E001

   **Lint do `.behavior`:**
5. Parse via `@dot-agent/tree-sitter` (WASM)
6. Valida sintaxe DSL (if/on/state/transition/etc) → mapeia erros para E007
7. Carrega kernel: `AgentDSLKernel.load_behavior()` para validação semântica
8. Se retorna `parse_error`, mapeia para E006
9. Extrai grafo (via `kernel.get_graph()`) para detectar states sem transições → W001

10. **Se houver qualquer `error`: aborta, não gera `.agent`**
11. Warnings incluídos no `PackResult` mas não bloqueiam
12. Coleta todos os arquivos: `agent.description`, `agent.behavior`, `SOUL.md` (opt), `behaviors/`, `guides/`, `knowledge/`
13. Computa SHA-256 do conteúdo do ZIP → extrai primeiros 8 chars → `<digest>`
14. Gera `id`: `<domain>/<name>:<version>~<digest>` (ex: `entelekheia.ai/doctor:v1.0~a1b2c3d`)
15. Monta `.agent/aboutme.json` com `id`, `schemaVersion`, `compiler`, `commit`, `integrity`, etc (conforme file structure.md)
16. Monta `.agent/files.json` com mapa de fontes
17. Monta `.agent/types.json` (opcional, se agente expõe tipos públicos)
18. Cria ZIP:
    - Raiz: `.agent/aboutme.json`, `.agent/types.json` (opt), `.agent/files.json`
    - Raiz: todos os fontes
19. Salva como `<name>.agent`

**Saída CLI (sucesso):**
```
✓ Lint passed (0 errors, 2 warnings)
  ⚠ agent.behavior:12:3  W001  state "idle" has no transitions
  ⚠ agent.description:2:1  W003  domain still has default value "example.com"
✓ Packed → ./doctor.agent
  ID: entelekheia.ai/doctor:v1.0~a1b2c3d
```

**Saída CLI (erro):**
```
✗ Lint failed (2 errors)
  ✗ agent.description:5:1   E001  missing required field: domain
  ✗ agent.behavior:23:7     E006  parse error: unknown state reference "triage_v2"
Pack aborted.
```

---

### ✅ `dot-agent unpack`

Extrai um `.agent` e restaura os fontes.

**CLI:**
```
dot-agent unpack <arquivo.agent> [--out <pasta>] [--force]
```

**API:**
```typescript
interface UnpackOptions {
  file: string
  out?: string        // padrão: ./<name>/ no cwd
  force?: boolean     // sobrescreve se pasta já existir
}

interface UnpackResult {
  dir: string
  id: string          // extraído do aboutme.json
  files: string[]
  aboutme: object     // conteúdo do aboutme.json
}
```

**Fluxo interno:**
1. Valida se arquivo `.agent` é ZIP válido (magic bytes)
2. Valida ZIP bomb (soma descompactado; aborta se > 500 MB ou ratio > 100×)
3. Lê `.agent/aboutme.json` → valida e extrai `id`
4. Extrai todos os arquivos da raiz para `out/<arquivo>`
5. Aborta se `out` já existir, a menos que `--force`
6. Restaura estrutura de pastas original

**Comportamento:**
- Valida integridade: lê `integrity.sha256` e compara com ZIP recompactado
- Se hash não bate, avisa mas continua (⚠ —verbose mostra detalhes)
- Extrai apenas fontes por padrão
- `--verbose` exibe também o conteúdo do `aboutme.json`

---

### ✅ `dot-agent run`

Carrega um `.agent` (ou pasta de fontes) e retorna o `AgentContext`.

No terminal é usado para smoke-test. O Electron usa a API.

**CLI:**
```
dot-agent run <arquivo.agent | pasta>
```

**API:**
```typescript
interface RunOptions {
  source: string      // caminho do .agent ou pasta com fontes
}

interface FileEntry {
  path: string        // caminho relativo
  content: string     // conteúdo em memória
}

// AgentContext é EventEmitter + objeto com tudo parsed
interface AgentContext extends EventEmitter {
  id: string                    // namespace/name:version~digest
  description: ParsedDescription // AST parseada pelo tree-sitter
  behavior: ParsedBehavior      // AST parseada pelo kernel-dsl
  kernel: AgentDSLKernel        // instância pronta para executar
  files: {
    soul?: string
    guides: FileEntry[]
    knowledge: FileEntry[]
    behaviors: FileEntry[]
  }
  aboutme: object               // conteúdo do aboutme.json

  // Eventos emitidos durante o carregamento:
  // 'progress'  → { step: string, pct: number }
  // 'warning'   → LintMessage
  // 'ready'     → AgentContext
  // 'error'     → Error
}
```

**Fluxo interno:**
1. Emite `progress` { step: 'opening', pct: 0 }
2. Detecta se é `.agent` (ZIP) ou pasta de fontes
3. Se `.agent`: valida ZIP bomb (soma descompactado; aborta se > 500 MB ou ratio > 100×)
4. Emite `progress` { step: 'parsing', pct: 30 }
5. Lê `.agent/aboutme.json` (se ZIP) → extrai `id`
6. Lê `agent.description`; parse via `@dot-agent/tree-sitter` → `ParsedDescription`
7. Lê `agent.behavior`; parse via `@dot-agent/tree-sitter` (sintaxe)
8. Carrega kernel: `AgentDSLKernel.load_behavior()` (tree-sitter + semântica + FSM)
9. Emite warnings do lint se houver
10. Emite `progress` { step: 'loading-files', pct: 60 }
11. Carrega guides, knowledge, behaviors em memória
12. Emite `progress` { step: 'ready', pct: 100 }
13. Emite `ready` e resolve a Promise com o `AgentContext`

**O runtime recebe o `AgentContext` e:**
- Usa `context.kernel` (já carregado) para enviar intents via `send_intent()`
- Usa `context.description` para montar system prompt do LLM
- Usa `context.files.soul` e `context.files.guides` como contexto adicional
- Reage aos `Effect[]` retornados pelo kernel para orquestrar estados

---

## Lint — Códigos de Erro V1

| Código | Severidade | Detecção | Descrição |
|---|---|---|---|
| E001 | error | tree-sitter (`.description` lint) | Campo obrigatório ausente (`domain`, `name`, `version`) |
| E002 | error | tree-sitter (`.description` lint) | Campo obrigatório ausente em `capability` (tipo ou descrição) |
| E003 | error | manual | Arquivo `.description` ausente |
| E004 | error | tree-sitter (`.behavior` lint) | Erro de sintaxe DSL (state, on, transition, if, etc) |
| E005 | error | kernel-dsl (semântica) | Estado referenciado não existe (ex: `transition to unknown`) |
| E006 | error | kernel-dsl (`load_behavior()`) | `parse_error` effect — erro semântico no FSM |
| E007 | error | manual | Arquivo `.behavior` ausente |
| E008 | error | manual | Arquivo referenciado em `files.json` não existe |
| W001 | warning | kernel-dsl (`get_graph()`) | State sem transições de entrada ou saída |
| W002 | warning | tree-sitter (`.behavior` lint) | Text block acima de 280 chars (goal, guide, teach) |
| W003 | warning | tree-sitter (`.description` lint) | Campo `domain` ainda com valor padrão (`example.com`) |

---

## Relação com os Outros Pacotes da Org

```
dot-agent (CLI / npm)
├── depende de → @dot-agent/tree-sitter   (parse + lint ambos .description e .behavior, WASM)
│                ├── dist/tree-sitter-agent.wasm    (para .description / .type)
│                └── dist/tree-sitter-behavior.wasm (para .behavior sintaxe)
│
├── depende de → @dot-agent/kernel-dsl    (semântica + FSM + execução, WASM)
│                └── usa tree-sitter internamente via Rust FFI
│                    para parse de .behavior com validação semântica
│
├── depende de → jszip                    (leitura/escrita ZIP)
│
├── produz → AgentContext
│             ├── .id (namespace/name:version~digest)
│             ├── .description (ParsedDescription via tree-sitter)
│             ├── .behavior (ParsedBehavior, kernel carregado)
│             ├── .kernel (AgentDSLKernel instância pronta)
│             └── .files (guides, knowledge, behaviors em memória)
│
├── consumido por → Electron / Runtime (recebe AgentContext)
│
└── não depende de → language-server      (tooling de editor, LSP standalone)
                  → vscode-dot-agent      (extensão VSCode, cliente LSP)
```

---

## Estratégia de Migração para Rust (VNext)

O pacote npm mantém a mesma API pública.  
Os binários nativos entram como `optionalDependencies`:

```json
{
  "optionalDependencies": {
    "dot-agent-darwin-arm64": "1.x",
    "dot-agent-darwin-x64": "1.x",
    "dot-agent-linux-x64": "1.x",
    "dot-agent-win32-x64": "1.x"
  }
}
```

O `index.ts` detecta se o binário nativo está disponível e delega; caso contrário, cai no fallback JS. Zero breaking change para o Electron.

---

## Decisões V1

| Decisão | Resultado |
|---|---|
| **Nome do pacote npm** | ✅ `dot-agent` — publicado como bin e import padrão |
| **Estrutura do ZIP** | ✅ `.agent/` contém metadados; raiz contém fontes (conforme `file structure.md`) |
| **Nomenclatura** | ✅ `id` no formato `namespace/name:version~digest` em vez de URN |
| **Arquivo de metadados** | ✅ `aboutme.json` em `.agent/` (não `envelope.json` na raiz) |
| **CLI module format** | ✅ ESM (`"type": "module"`) — obrigatório para `@dot-agent/kernel-dsl` |
| **Campo `purpose`** | ✅ Omitido no V1 — mapeado futuramente por `builder.agent` + LLM |
| **Resolução de `version`** | ✅ Prioridade: `--version`, git tags, interativo |
| **Resolução de `commit`** | ✅ Prioridade: `--commit`, git HEAD, ausente (não bloqueia) |

---

## Questões Abertas VNext

1. **`inputModes` / `outputModes` em `skills[]`** — Runtime converte tipos estruturados para formato de transporte. A2A-compatibility completa ainda em exploração.

2. **`ui/` e `assets/` no ZIP** — Onde empacotar UI gerada? Na raiz do ZIP (fonts) ou em `.agent/` (artifacts gerados)? Exploração pendente.

3. **Tipagem de `requires[]`** — Hoje é string simples (`UserProfile`). Granularidade de ação (`Read:`, `Edit:`) e escopo (`resource.write`) em exploração para VNext.