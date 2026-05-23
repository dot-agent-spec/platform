# tree-sitter-agent

Parser Tree-sitter para a Agent DSL (arquivos `.agent` e `.type`).

---

## O que é o Tree-sitter

Tree-sitter é um gerador de parsers usado por editores de texto (GitHub, Neovim, Zed, Helix) para entender a estrutura do código. Ele lê seus arquivos e produz uma **árvore sintática** — uma representação estruturada do que está escrito.

Você escreve a gramática em `grammar.js`, o Tree-sitter gera o parser em C, e a partir daí você pode:
- Ver a árvore de qualquer arquivo da DSL no terminal
- Rodar testes de sintaxe automatizados
- Ativar highlight de sintaxe no editor

---

## Estrutura do projeto

```
tree-sitter-agent/
├── grammar.js          ← A gramática da linguagem (você edita aqui)
├── package.json        ← Dependências npm (só tree-sitter-cli)
├── README.md           ← Este arquivo
│
├── src/                ← Gerado automaticamente por `tree-sitter generate`
│   ├── parser.c        ← O parser em C (não edite)
│   ├── scanner.c       ← Scanner manual de INDENT/DEDENT (você pode editar)
│   └── tree_sitter/
│       └── parser.h    ← Header do Tree-sitter (não edite)
│
└── test/
    └── corpus/
        └── types.txt   ← Casos de teste da gramática
```

**Regra prática:** você só toca em `grammar.js`, `src/scanner.c` e `test/corpus/`.  
Tudo dentro de `src/` (exceto `scanner.c`) é gerado — não commite e não edite.

---

## Setup inicial

Só precisa fazer uma vez:

```bash
cd DSL/tree-sitter-agent
npm install
npx tree-sitter generate
```

Toda vez que editar `grammar.js`, rode `npx tree-sitter generate` novamente para recompilar o parser.

---

## Comandos do dia a dia

### Ver a árvore de um arquivo

```bash
npx tree-sitter parse ../../examples/doctor.agent
```

Saída: a árvore sintática completa. Linhas com `(ERROR ...)` indicam que aquele trecho não bateu com nenhuma regra da gramática — é o equivalente de "syntax error".

### Modo silencioso — só mostra erros

```bash
npx tree-sitter parse --quiet ../../examples/doctor.agent
```

Se não aparecer nada, o arquivo está 100% válido. Útil para checar vários arquivos.

### Rodar os testes do corpus

```bash
npx tree-sitter test
```

Roda todos os casos em `test/corpus/`. Mostra ✓ ou ✗ por caso.

### Testar um caso específico

```bash
npx tree-sitter test --filter "type simples"
```

---

## Como ler a árvore

Dado o arquivo:
```
agent Doctor
  domain health.example.com
  license MIT

requires Prontuario
```

A saída do parser é:
```
(manifest
  (statement
    (agent_decl
      name: (agent_name
        (identifier))         ← "Doctor"
      (agent_meta             ← linha "domain health.example.com"
        value: (bare_string
          (filename)))
      (agent_meta             ← linha "license MIT"
        value: (bare_string
          (identifier)))))
  (statement
    (requires_block
      (type_list
        (type_reference
          (type_ref
            (identifier)))))))  ← "Prontuario"
```

**O que cada peça significa:**

| Notação | Significado |
|---|---|
| `(nome_do_nó ...)` | Um nó na árvore — corresponde a uma regra da gramática |
| `name: (...)` | Campo nomeado — definido com `field('name', ...)` no grammar.js |
| `(identifier)` | Nó folha — corresponde a um token (texto real do arquivo) |
| `(ERROR ...)` | Trecho que não casou com nenhuma regra — erro de sintaxe |

---

## Como escrever testes (corpus)

Os testes ficam em `test/corpus/*.txt`. O formato é:

```
================================================================================
nome do teste
================================================================================

input que será parseado

--------------------------------------------------------------------------------

(árvore esperada)

```

Separadores:
- `====` (80 `=`) → início de cada caso de teste
- `----` (80 `-`) → separa input da árvore esperada

Você não precisa escrever a árvore na mão. Fluxo recomendado:

1. Escreva o input no arquivo de teste com a árvore vazia (só `---` e nada abaixo)
2. Rode `npx tree-sitter parse` com o input para ver a árvore gerada
3. Cole a árvore no arquivo de teste
4. Rode `npx tree-sitter test` para confirmar que bate

---

## Highlight no VS Code (passo a passo)

O highlight exige dois passos: configurar onde o Tree-sitter acha o parser, e criar as queries de highlight.

### Passo 1 — Criar o config global do Tree-sitter

```bash
npx tree-sitter init-config
```

Isso cria um arquivo em `~/.config/tree-sitter/config.json` (macOS/Linux).

Abra esse arquivo e adicione o caminho da **pasta pai** do seu projeto — o Tree-sitter vai procurar parsers dentro dela:

```json
{
  "parser-directories": [
    "/Users/danilo/Development/entelekheia/dot-agent-spec/DSL"
  ]
}
```

O Tree-sitter vai encontrar `tree-sitter-agent` dentro desse diretório porque o `package.json` declara `"name": "tree-sitter-agent"`.

### Passo 2 — Criar as queries de highlight

Crie a pasta e o arquivo:

```bash
mkdir -p queries
touch queries/highlights.scm
```

Conteúdo mínimo para começar:

```scheme
; queries/highlights.scm

; Keywords principais
"agent"        @keyword
"type"         @keyword
"description"  @keyword
"behavior"     @keyword
"requires"     @keyword
"input"        @keyword
"capabilities" @keyword
"output"       @keyword
"concept"      @keyword
"schema"       @keyword
"domain"       @keyword
"license"      @keyword
"terms"        @keyword
"privacy"      @keyword
"Enum"         @keyword.operator

; Nomes de agentes e tipos
(agent_name (identifier) @type.definition)
(type_decl name: (identifier) @type.definition)

; Propriedades de um type
(property_decl name: (identifier) @property)

; URLs e strings
(url) @string.special
(quoted_string) @string
(filename) @string

; Comentários
(comment) @comment

; Marcador opcional (?)
"?" @operator

; Colchetes de array
"[" @punctuation.bracket
"]" @punctuation.bracket

; Dois-pontos de propriedade
":" @punctuation.delimiter
```

### Passo 3 — Testar o highlight no terminal

```bash
npx tree-sitter highlight ../../examples/doctor.agent
```

Isso imprime o arquivo com cores ANSI no terminal. Se aparecer colorido, está funcionando.

### Para usar no VS Code

O highlight nativo no VS Code via Tree-sitter ainda é experimental. O caminho mais direto hoje é usar o Neovim com `nvim-treesitter`, ou o editor Zed (que tem suporte nativo).

Para VS Code, a integração mais estável continua sendo o `.tmLanguage.json` que já existe em `DSL/syntax/`. O Tree-sitter aqui serve principalmente para:
- Validar a gramática com `tree-sitter parse`
- Rodar testes automatizados com `tree-sitter test`
- Preparar o terreno para quando a integração VS Code madurecer

---

## Fluxo de trabalho ao evoluir a gramática

```
1. Edite grammar.js
      ↓
2. npx tree-sitter generate    ← recompila o parser
      ↓
3. npx tree-sitter parse <arquivo>  ← testa manualmente
      ↓
4. Ajuste os casos em test/corpus/ se necessário
      ↓
5. npx tree-sitter test        ← confirma que tudo passa
```

---

## Arquivos de referência

| Arquivo | Para que serve |
|---|---|
| `grammar.js` | Regras da gramática (parser rules + lexer rules) |
| `src/scanner.c` | Scanner manual: detecta INDENT, DEDENT, NEWLINE por indentação |
| `test/corpus/types.txt` | Casos de teste com exemplos reais da DSL |
| `../grammar.md` | Especificação EBNF original da linguagem |
| `../AgentDSL.g4` | Versão ANTLR4 da gramática (referência, não roda sem Java) |
| `../AgentDSL_test.g4` | Versão simplificada para testar no lab.antlr.org |
