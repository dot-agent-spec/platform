# aboutme.json — Especificação e Comparativo com Open Standards

> Documento de trabalho
> ✅ = decidido | 🔲 = pendente | ⏳ = VNext

---

## Estado atual do aboutme.json V1

```json
{
  "schemaVersion": "dot-agent/1.0",
  "id": "entelekheia.ai/doctor:v1.0~a1b2c3d",

  "name": "Doctor",
  "description": "Agente médico para triagem inicial de pacientes.",
  "version": "v1.0",

  "domain": "entelekheia.ai",
  "license": "Apache-2.0",
  "persona": "src/SOUL.md",

  "compiler": "dot-agent/1.0.0",
  "commit": "a1b2c3d",

  "purpose": "https://www.wikidata.org/wiki/Q784111",

  "skills": [
    {
      "id": "TriagePatient",
      "description": "Triagem inicial de pacientes"
    }
  ],

  "requires": ["UserProfile"],

  "integrity": {
    "sha256": "e3b0c44298fc1c149afb...",
    "types": ".agent/types.json",
    "files": ".agent/files.json"
  },

  "⏳ did": "did:web:entelekheia.ai",

  "⏳ proof": {
    "type": "Ed25519Signature2020",
    "created": "2026-01-01T00:00:00Z",
    "verificationMethod": "did:web:entelekheia.ai#key-1",
    "proofValue": "..."
  },

  "⏳ endpoints": {
    "distribution": "https://entelekheia.ai/agents/doctor.agent",
    "mcp":          "https://api.entelekheia.ai/mcp",
    "a2a":          "https://api.entelekheia.ai/agent"
  },

  "⏳ securitySchemes": {
    "bearer": { "type": "http", "scheme": "bearer" }
  }
}
```

**types.json** — na raiz do ZIP, presente quando o agente declara tipos públicos:

```json
{
  "input": [
    { "$ref": "https://dot-agent.dev/schema/std/v1/Prompt.json" }
  ],
  "output": [
    { "$ref": "#/$defs/Diagnosis" }
  ],
  "$defs": {
    "Prontuario": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "x-category": "https://www.wikidata.org/wiki/Q177719",
      "x-concept": "https://schema.org/MedicalRecord",
      "type": "object",
      "properties": {
        "patient": { "$ref": "#/$defs/Person" },
        "exames":  { "type": "array", "items": { "$ref": "#/$defs/Exam" } },
        "status":  { "type": "string", "enum": ["active", "archived"] },
        "imagem":  { "$ref": "#/$defs/Avatar" }
      },
      "required": ["patient", "exames", "status"]
    }
  }
}
```

**files.json** — na raiz do ZIP, presente quando o agente empacota fontes:

```json
{
  "description": "src/agent.description",
  "behavior":    "src/agent.behavior",
  "behaviors":   ["src/behaviors/xpto.behavior"],
  "guides":      ["src/guides/ask-class-name.md"],
  "knowledge":   ["src/knowledge/swift-basics.md", "src/knowledge/swift-class-ref.md"]
}
```

---

---

## Seções de Design

### Domain / Provider — Tiers de Confiança

O `domain` é o namespace do publisher. A confiança da spec depende de quem garante a unicidade do namespace e se é possível verificação automática.

| Tier | Formato do `id` | Quem garante | Verificável | Selo |
|---|---|---|---|---|
| 1 — Domínio próprio | `entelekheia.ai/doctor:v1.0~a1b2c3d` | ICANN | ✅ via `.well-known` | ✅ verificado |
| 2 — Plataforma de código | `github.com/daniloborges/doctor:v1.0~a1b2c3d` | GitHub / GitLab / etc | ✅ via repo ou arquivo de config | ✅ verificado |
| 3 — Email | `contato@gmail.com` como namespace | Provedor de email | ❌ não dá para verificar programaticamente sem depender do provedor | ⚠️ tem contato, sem selo |
| 4 — Anônimo | sem namespace | ninguém | ❌ | 🚫 aviso ou bloqueio pela runtime |

**Por que email não tem verificação:**
Diferente de plataformas de código (onde a spec mantém lista de domínios conhecidos e estrutura `dominio/usuario`), provedores de email são impossíveis de enumerar e não expõem mecanismo padrão de autorização de arquivos por usuário. A consulta recairia sobre o domínio do provedor (`gmail.com`), não sobre o usuário — não é verificável. O email é útil como canal de contato no `aboutme.json`, não como namespace de identidade.

**Plataformas de código conhecidas pela spec** (lista mantida no compilador, atualizada via versão da CLI):

| Plataforma | Formato |
|---|---|
| GitHub | `github.com/<user>` |
| GitLab | `gitlab.com/<user>` |
| Codeberg | `codeberg.org/<user>` |
| Sourcehut | `srht.site/<user>` |

**Anônimo** — `id` válido localmente, não interoperável entre runtimes. A runtime que recebe um `.agent` sem namespace verificável pode executar mas não pode verificar autoria. Runtimes em ambientes seguros podem bloquear por política. Não há garantia de unicidade entre dois agentes anônimos com o mesmo nome — diferenciados apenas pelo hash do ZIP.

**Formato do `id` — separadores com semântica única:**

```
// Estrutura
namespace/name:version~digest

// Domínio próprio
entelekheia.ai/doctor:v1.0~a1b2c3d

// Plataforma de código
github.com/daniloborges/doctor:v1.0~a1b2c3d

// Email — @ exclusivo para este caso, sem ambiguidade com digest
contato@gmail.com/doctor:v1.0~a1b2c3d

// Links de compartilhamento — runtime prefixia o scheme
dot-agent://entelekheia.ai/doctor              ← mais recente
dot-agent://entelekheia.ai/doctor:v1.0         ← versão específica
dot-agent://entelekheia.ai/doctor:v1.0~a1b2c3d ← imutável

// Identidade criptográfica do autor (VNext)
did:web:entelekheia.ai
```

Cada separador tem papel único — nenhum aparece em dois contextos:

| Separador | Papel | Justificativa |
|---|---|---|
| `/` | namespace | hierarquia de path, universal |
| `:` | versão | convenção de container registry |
| `~` | digest | único sem conflito: válido em URI sem encoding (RFC 3986), sem significado em email, não é alias de email (`+`), não é fragmento de URL (`#`), não é semver, não é query string (`;`) |
| `@` | email como namespace | exclusivo — presença antes do primeiro `/` identifica tier de email |

### Estrutura do ZIP — Raiz e Arquivos Opcionais

```
meu-agente.agent (ZIP)
│
│  # Metadados gerados — Layer 2 🤖
├── .agent/
│   ├── aboutme.json       ← sempre presente
│   ├── types.json          ← quando há tipos públicos
│   └── files.json          ← quando há fontes
│
│  # Comportamento — Layer 1 👤
├── agent.description
├── agent.behavior
├── behaviors/
│   └── xpto.behavior
├── guides/
│   └── ask-class-name.md
├── knowledge/
│   └── swift-basics.md
├── SOUL.md
│
│  # Interface 🕵 em exploração
├── ui/
│   ├── index.html
│   ├── style.css
│   ├── app.tsx
│   └── components/
│       └── triagem-form.tsx
│
│  # Assets 🕵 em exploração
└── assets/
    ├── icon.svg
    ├── icon.png
    └── images/
        └── banner.png
```

O `aboutme.json` é o único arquivo obrigatório — dentro de `.agent/`. Agentes simples ou MCP-only podem ter só essa pasta. Os fontes ficam na raiz do ZIP como estão no projeto — quem abre o arquivo vê o código primeiro, não a geração. O `integrity{}` referencia os arquivos opcionais quando existirem:

```json
"integrity": {
  "sha256": "...",
  "types": ".agent/types.json",
  "files": ".agent/files.json"
}
```

O `files.json` referencia arquivos relativos à raiz do ZIP:

```json
{
  "description": "agent.description",
  "behavior":    "agent.behavior",
  "behaviors":   ["behaviors/xpto.behavior"],
  "guides":      ["guides/ask-class-name.md"],
  "knowledge":   ["knowledge/swift-basics.md"]
}
```

Essa separação serve dois propósitos: mantém o `aboutme.json` leve para descoberta e permite que a runtime carregue `types.json` só quando precisar fazer validação de adapter, e `files.json` só quando precisar de auditoria ou unpack.

### 🕵 Em Exploração — ui/ e assets/

Ainda sem decisão de spec. Três questões abertas:

**`ui/` no `files.json`** — faria sentido uma chave própria separada de `guides` e `knowledge`:
```json
{ "ui": ["ui/index.html", "ui/app.tsx", "ui/style.css"] }
```
Runtimes que suportam genUI sabem o que fazer; as que não suportam ignoram.

**`assets/icon.*` no `aboutme.json`** — ícone do agente merece campo próprio para descoberta, análogo ao `iconUrl` do A2A. Runtimes poderiam exibir o ícone sem parsear `files.json`:
```json
{ "icon": "assets/icon.svg" }
```

**`ui/app.tsx` — fonte ou bundle?** Se o ZIP empacota só fontes, `app.tsx` vai para a raiz e a runtime compila. Se empacotar também o bundle compilado, ele vai para `.agent/` como artefato gerado — sem poluir a view dos fontes.

Tipos `std.*` são definidos pela spec dot-agent e hospedados em URL canônico:

```
https://dot-agent.dev/schema/std/v1/Prompt.json
https://dot-agent.dev/schema/std/v1/Response.json
```

Na V1, hospedados no GitHub do projeto. Após domínio próprio, migram para `dot-agent.dev`.

A runtime mantém um dicionário interno de `std.*` para resolução offline. Tipos `schema.org` referenciados via `x-concept` são documentação — a runtime não precisa resolvê-los para executar.

### requires[] — Explorando Tipagem (VNext)

Na V1, `requires[]` é uma lista simples de nomes:

```json
"requires": ["UserProfile", "FileSystem", "PaymentGateway"]
```

A tipagem será explorada com calma no VNext. O problema com separar em camadas técnicas (`data:` / `service:` / `system:`) é que não reflete como humanos pensam sobre permissões — quando alguém diz "tem acesso a UserProfile", imagina acesso aos dados, à edição, e à interação com o sistema sobre isso, cruzando os domínios técnicos ao mesmo tempo.

Formatos em exploração:

```
// Opção A — prefixo de camada técnica (sugerido, descartado por ser pouco humano)
data:UserProfile
service:PaymentGateway
system:FileSystem

// Opção B — ação explícita (mais granular, mais próximo de permissões reais)
Read:UserProfile
Edit:UserProfile
Create:Agents
Edit:SelfAgent
Read:MedicalData

// Opção C — recurso com escopo de ação implícito (mais humano, menos preciso)
UserProfile          ← implica leitura
UserProfile.write    ← explicita escrita
MedicalData.read

// Opção D — declaração livre com registro público
UserProfile          ← definido no registro dot-agent.dev/registry/requires
                        o registro define quais ações estão implícitas
```

A questão central: granularidade de ação (Read/Edit/Create/Delete) deve estar no `requires` do agente ou é política da runtime? Um agente que declara `UserProfile` pode estar pedindo só leitura — mas quem garante isso é a spec do `requires` ou o comportamento declarado no `.behavior`?

### purpose — Vocabulário Wikidata

`purpose` é um QID Wikidata derivado pelo compilador dos `category` dos tipos de interface pública. Não é string livre — permite navegação hierárquica por orquestradores e sistemas de descoberta.

```json
"purpose": "https://www.wikidata.org/wiki/Q784111"
```

Hierarquia navegável: `Q784111` (triagem médica) ⊂ `Q11190` (medicina) ⊂ `Q336` (ciência da saúde). Um orquestrador que busca agentes de saúde encontra todos os subníveis.

### Coleção de Agentes — Agent Pack

Um link `dot-agent://` pode apontar para um único agente ou para uma coleção. A coleção é um arquivo JSON simples — um array de `id` — hospedado pelo publisher.

```
// Link de coleção
dot-agent://entelekheia.ai/collection      ← coleção nomeada
dot-agent://github.com/daniloborges/agents ← coleção de um dev

// Arquivo resolvido pela runtime
{
  "name": "Meus Agentes",
  "publisher": "entelekheia.ai",
  "agents": [
    "entelekheia.ai/doctor:v1.0~a1b2c3d",
    "entelekheia.ai/receptionist:v1.2~e5f6g7h",
    "entelekheia.ai/billing:v1.0~x9y8z7w"
  ]
}
```

A runtime ao receber uma coleção baixa e instala cada `id` listado, disponibiliza todos no contexto do usuário, respeita version + commit quando especificados, e instala a mais recente quando omitidos.

⏳ VNext — decisões pendentes:

| Decisão | |
|---|---|
| Nome do arquivo de coleção | `agents.json`, `pack.json`, `.agent-pack`? |
| Localização | Well-known do publisher ou path arbitrário? |
| Instalação | Runtime instala todos automaticamente ou pede confirmação por agente? |

### schemaVersion vs @context

`schemaVersion` = versão do formato do `aboutme.json` (para parsers da CLI).
`@context` W3C DID = ontologia linked-data (semântica de campos).
São conceitos distintos que coexistirão na VNext se o `aboutme.json` virar JSON-LD nativo.

### Transport

Transport = como as mensagens chegam ao agente em runtime. O `.agent` é pacote estático — transport é responsabilidade da runtime. Ausente no `aboutme.json` V1 por design.

---

## Campos Ausentes na V1

| Campo | Status | Motivo |
|---|---|---|
| `inputModes` / `outputModes` em `skills[]` | ⏳ VNext | Runtime converte tipos estruturados para o formato de transporte. Explorar compatibilidade A2A completa no VNext. |
| `url` / `endpoints` | ⏳ VNext | Host preenche no deploy; VNext: `endpoints{}` tipado |
| `did` | ⏳ VNext | Identidade criptográfica do autor |
| `proof` | ⏳ VNext | Assinatura Ed25519 do hash SHA-256 do ZIP |
| `securitySchemes` / `auth` | ⏳ VNext | Autenticação entre agentes |
| `domain_type` | ⏳ VNext | Política de confiança para subdomínios |
| `transport` | ✅ ausente por design | Responsabilidade da runtime |
| `tags` em `skills[]` | ✅ fora da spec | Responsabilidade de registry futuro — gerado a partir de `purpose` + `skills[].description` |

---

## Caminho de Evolução

```
V1   aboutme.json — leve, para descoberta e instalação
       id + purpose (Wikidata) + skills[] + requires[] + integrity{}
     types.json — opcional, na raiz do ZIP
       JSON Schema 2020-12 dos tipos públicos + input[] + output[]
       std.* em dot-agent.dev/schema/std/v1/
     files.json — opcional, na raiz do ZIP
       manifesto de fontes individuais (behavior, guides, knowledge)

V2   + domain_type (org / user / subdomain)
     + endpoints{} reservado

VNext  + endpoints{}     distribution / mcp / a2a
       + did             did:web ou did:key do autor
       + proof{}         assinatura Ed25519 do ZIP
       + @context        JSON-LD nativo para interop DID/A2A
       + dot-agent://    scheme de resolução e compartilhamento
       + agent pack      coleção de agentes via array de ids
       → publicável como Agent Card completo no /.well-known/
```

---

---

## Tabela Comparativa

Linhas com semântica diferente entre padrões aparecem em linhas próprias.
Célula vazia = o padrão não cobre esse campo.

| Campo | dot-agent `aboutme.json` | A2A Agent Card | MCP Server | W3C DID Document | Notas |
|---|---|---|---|---|---|
| **Identidade** | | | | | |
| Identificador do pacote | `id` — `namespace/name:version~digest`; `dot-agent://namespace/name` como link gerado pela runtime | — | — | — | ✅ Separadores únicos por papel: `/` namespace, `:` versão, `~` digest (semver), `@` exclusivo para email como namespace. |
| Identidade criptográfica do autor | — | — | — | `id` (DID URI) | ⏳ VNext: `did:web` ou `did:key`. |
| Nome legível | `name` | `name` ✱ | `name` | — | ✅ Extraído do `agent_decl`. |
| Descrição | `description` | `description` ✱ | `description` | — | ✅ Extraído do `description_block`. |
| Versão do agente | `version` | `version` ✱ | `version` | `versionId` | ✅ Versão semântica do agente. |
| Versão do schema do envelope | `schemaVersion` | — | — | — | ✅ Versão do formato do envelope, não do agente. ≠ `@context` W3C (que é ontologia). |
| Vocabulário linked-data | — | — | — | `@context` | ⏳ VNext: se envelope virar JSON-LD nativo. |
| Publisher / namespace | `domain` | `provider.organization` | — | — | ✅ Namespace para `id` e well-known (VNext). Ver seção Domain. |
| Controle criptográfico | — | — | — | `controller` | ⏳ VNext: `controller` referencia o `domain`. |
| Licença | `license` | — | — | — | ✅ Campo próprio. |
| Persona / voz | `persona` | — | — | — | ✅ Campo próprio — aponta para `SOUL.md`. |
| Versão do compilador | `compiler` | — | — | — | ✅ Campo próprio — proveniência de build. |
| Hash do commit Git | `commit` | — | — | — | ✅ Campo próprio — rastreabilidade de build. Deve ser idêntico ao sufixo do `id`. |
| **O que o agente faz** | | | | | |
| Categoria semântica derivada | `purpose` — QID Wikidata derivado dos `category` dos tipos de interface | — | — | — | ✅ QID Wikidata permite navegação hierárquica — subclasses agrupáveis por orquestradores. Ex: `Q784111` (triagem médica) ⊂ `Q11190` (medicina). |
| Entry points públicos | `skills[]` — `id` + `description`, traduzido das `capabilities` do `.description` | `skills[]` ✱ — `id`, `name`, `description`, `inputModes`, `outputModes`, `tags`, `examples` | `tools[]` — JSON Schema por tool | — | ✅ `capabilities` na DSL → `skills[]` no envelope. `inputModes`/`outputModes` omitidos — runtime converte tipos estruturados para o formato de transporte (JSON, XML, etc). ⏳ VNext: compatibilidade A2A completa. |
| Schema de dados (tipos públicos) | `types.json` — arquivo separado na raiz do ZIP; apenas tipos de interface pública (`input`/`output`/`capabilities`); JSON Schema 2020-12 com `x-category` e `x-concept` | — | `inputSchema` JSON Schema 2020-12 por tool | — | ✅ Padrão separado quando existir — agentes simples ou MCP-only não precisam de `types.json`. Compilador gera baseado nos tipos declarados. |
| MIME types de input | — | `defaultInputModes[]` | — | — | — |
| MIME types de output | — | `defaultOutputModes[]` | — | — | — |
| Input tipado (tipos estruturados) | `input[]` em `types.json` — refs para `$defs` ou URL canônico `std.*` | — | — | — | ✅ `std.*` resolvidos via `https://dot-agent.dev/schema/std/v1/`. Tipos custom em `#/$defs/`. |
| Output tipado (tipos estruturados) | `output[]` em `types.json` — refs para `$defs` | — | — | — | ✅ Linha própria: tipos estruturados da DSL ≠ MIME types do A2A. |
| Dependências | `requires[]` — string simples, replicado do `.description` | — | — | — | ✅ V1: nomes simples (`UserProfile`, `FileSystem`). Tipagem e granularidade de ação exploradas no VNext. |
| Features de protocolo | — | `capabilities{}` — streaming, pushNotifications | — | — | — |
| Primitivos do servidor | — | — | `capabilities{}` — tools, resources, prompts | — | — |
| **Confiança e descoberta** | | | | | |
| Integridade do pacote | `integrity.sha256` — hash do ZIP inteiro | Signed Agent Card (v1.0) | — | `proof{}` | ✅ V1: hash SHA-256 do ZIP. VNext: `proof{}` assina esse mesmo hash com chave Ed25519. |
| Descoberta web | — | `/.well-known/agent-card.json` | — | `/.well-known/did.json` | ⏳ VNext: `/.well-known/dot-agent.json`. |
| Autenticação | — | `securitySchemes{}` | `auth{}` | `verificationMethod[]` | ⏳ VNext. |
| **Fontes empacotados** | | | | | |
| Mapa de fontes | `files.json` — arquivo separado na raiz do ZIP; arquivos individuais listados explicitamente | — | — | — | ✅ Padrão separado quando existir — agentes MCP-only sem fontes não precisam de `files.json`. Arquivos individuais, não pastas. |
| Guias procedimentais | `files.json` → `guides[]` — lista de arquivos | — | — | — | ✅ Campo próprio. Carregamento lazy por state, não automático. |
| Base de conhecimento / RAG | `files.json` → `knowledge[]` — lista de arquivos | — | — | — | ✅ Campo próprio. Carregamento requisitado durante execução dos states, nunca automático. |
| **Transporte** | | | | | |
| Endpoints de execução | — | `url` ✱ | `url` | `service[].serviceEndpoint` | ⏳ VNext: `endpoints{}` tipado (distribution / mcp / a2a). |
| Transport | — | HTTP / SSE / JSON-RPC 2.0 / gRPC | STDIO / HTTP | — | ✅ Ausente — responsabilidade da runtime. |
| Governança | Danilo Borges (open, a doar) | Linux Foundation | Linux Foundation (AAIF) | W3C | ✅ Independente, intenção de doação futura. |

---


## Perguntas e Respostas

Registro de questões levantadas durante o design — respondidas ou encaminhadas.

**O `commit` no campo `id` e o campo `commit` separado são redundantes. Em caso de conflito, qual prevalece?**
O compilador garante que são sempre idênticos no momento do `pack`. O `commit` separado existe para leitura direta sem precisar fazer parse do `id`. Em conflito (pacote corrompido ou editado manualmente), o `id` prevalece — é o identificador imutável do pacote. A runtime deve rejeitar envelopes onde os dois divergem.

**`$ref` de `std.*` — como a runtime resolve tipos que não estão em `types{}`?**
Resolvidos via URL canônico `https://dot-agent.dev/schema/std/v1/`. A runtime mantém um dicionário interno de `std.*` para resolução offline. `$ref` com URL absoluto é JSON Schema padrão — sem tratamento especial no parser.

**`files.guides[]` e `files.knowledge[]` — pasta inteira ou arquivos individuais?**
Arquivos individuais listados explicitamente no `aboutme.json`. A pasta no ZIP é organização interna; o manifesto precisa ser explícito para verificação de integridade por arquivo. Carregamento é lazy — requisitado durante execução dos states, nunca automático na inicialização.

**`requires[]` como string plana — a runtime consegue distinguir o tipo de dependência?**
Na V1 não precisa — `requires[]` é lista simples de nomes (`UserProfile`, `FileSystem`). Tipagem e granularidade de ação são exploradas no VNext. O problema com prefixos técnicos (`data:` / `service:` / `system:`) é que cruzam domínios de forma pouco natural — "acesso a UserProfile" implica dados, edição e interação com o sistema ao mesmo tempo. Formatos alternativos em exploração: ação explícita (`Read:UserProfile`, `Edit:UserProfile`), escopo pontual (`UserProfile.write`), ou nome simples com semântica definida em registro público. Ver seção **requires[] — Explorando Tipagem**.

**`purpose` como string livre cria problema de descoberta — dois agentes médicos teriam valores diferentes.**
Resolvido usando QID Wikidata como valor de `purpose`. Derivado automaticamente pelo compilador dos `category` dos tipos de interface. Permite navegação hierárquica — orquestradores encontram agentes por categoria e subcategorias.

**`types.json` e `files.json` — inline no `aboutme.json` ou arquivos separados?**
Separados por padrão quando existirem — na raiz do ZIP ao lado do `aboutme.json`. O `aboutme.json` referencia via `integrity.types` e `integrity.files`. Mantém o envelope leve para descoberta. Runtime carrega `types.json` só para validação de adapter, `files.json` só para auditoria ou unpack. Agentes simples ou MCP-only não geram nem um nem outro — só `aboutme.json`. Mesma decisão resolve o problema de crescimento: tipos internos ficam só nos fontes, `types.json` contém apenas interface pública.



**`tags` em `skills[]` — por agente, por skill, ou fora da spec?**
Fora da spec. Para runtimes que conhecem seus agentes, tags são micro-gestão sem benefício real. Tags geradas por LLM são inconsistentes entre autores diferentes. Se um registry surgir, ele gera tags a partir de `purpose` + `skills[].description` — não o autor, não o envelope.

**O que o `proof` VNext assina — o `aboutme.json`, arquivos individuais, ou o ZIP inteiro?**
O ZIP inteiro, via o hash já existente em `integrity.sha256`. Assinar arquivo por arquivo permite que um atacante substitua um arquivo sem invalidar os outros. O `proof` VNext é a assinatura Ed25519 do `integrity.sha256` — consistente com o que já existe na V1.

**`dot-agent://` implica que há um servidor respondendo — cria expectativa de HTTP que nem sempre existe.**
O `://` é o scheme URI, não implica HTTP. A runtime registra `dot-agent://` como handler no SO — ela que decide como resolver (busca local, download, cache). O agente em si é um pacote estático; o scheme é só o protocolo de endereçamento.

**O `id` com `:` em série é opaco para sistemas externos — qualquer um precisa de parser específico.**
Resolvido adotando separadores com papel único: `/` namespace, `:` versão, `~` digest (consistente com semver build metadata), `@` exclusivo para email como namespace. `entelekheia.ai/doctor:v1.0~a1b2c3d` é legível sem parser específico. Email: `contato@gmail.com/doctor:v1.0~a1b2c3d` — o `@` antes do `/` identifica inequivocamente o namespace como email.

**Como a runtime diferencia dois agentes anônimos com o mesmo nome?**
Pelo hash do ZIP — é o único identificador disponível sem namespace. Dois anônimos com `doctor:v1.0` e hashes diferentes são pacotes distintos. Não há garantia de unicidade entre runtimes: um anônimo é válido localmente, não interoperável. Runtimes em ambientes seguros podem bloquear agentes sem namespace verificável por política. A spec não tenta resolver identidade anônima — é um tier de confiança zero por natureza.

**Por que email não entra como namespace verificável?**
Diferente de plataformas de código, provedores de email são impossíveis de enumerar e não expõem mecanismo padrão de autorização de arquivos por usuário. A verificação recairia sobre o domínio do provedor (`gmail.com`), não sobre o usuário — o spec ficaria dependendo de cada provedor configurar seus servidores. Email é útil como campo de contato no `aboutme.json`, não como namespace de identidade verificável.

**`knowledge/` — como a runtime decide se carrega via RAG ou injeta direto no contexto?**
Não é responsabilidade do `aboutme.json` na V1. O state no `.behavior` requisita o arquivo; a runtime decide a estratégia de carregamento baseada em tamanho, tipo e capacidade disponível. Metadata de `knowledge/` (tamanho, idioma, domínio) é candidata a VNext para guiar essa decisão.

**Agent Pack — runtime instala automaticamente ou pede confirmação?**
Decisão pendente para VNext. Opções: instalação automática silenciosa (melhor UX, menor controle), confirmação por agente (mais seguro, mais fricção), ou confirmação da coleção inteira de uma vez (meio-termo). Relacionado à política de confiança do `domain` do publisher.