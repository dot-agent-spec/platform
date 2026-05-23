# `.agent` Grammar

Especificação formal da DSL `.agent`. Este arquivo é o contrato do parser — gerado a partir de `DSL/tree-sitter-agent/grammar.js`, que é a **única fonte da verdade**. Qualquer discrepância entre este documento e o `grammar.js` deve ser resolvida favorecendo o `grammar.js`.

---

## 1. Notação

- `[...]` — elemento opcional
- `{...}` — zero ou mais repetições
- `A | B` — alternativa
- `"keyword"` — terminal literal
- `_indent` / `_dedent` — abertura e fechamento de bloco por indentação (gerenciado pelo scanner externo em `src/scanner.c`)
- `_newline` — nova linha no mesmo nível de indentação

---

## 2. Estrutura Lexical

```ebnf
comment       = "//" , { any_char } ;
identifier    = letter , { letter | digit | "_" | "-" } ;
url           = "http" , [ "s" ] , "://" , { any_char_except_whitespace_and_paren } ;
filename      = identifier , "." , identifier , { "." , identifier } ;
quoted_string = '"' , { any_char_except_quote_or_backslash | escape_seq } , '"' ;
bare_string   = quoted_string | filename | identifier ;
```

Espaços e tabulações horizontais são ignorados entre tokens. Comentários também são ignorados onde quer que apareçam.

---

## 3. Estrutura Top-Level

Um manifesto `.agent` é uma sequência flat de declarações. Os blocos semânticos (`description`, `behavior`, `requires`, etc.) são **top-level** — pertencem implicitamente ao `agent` que os precede no arquivo, mas não são indentados sob ele.

```ebnf
manifest  = statement , { statement } ;

statement = agent_decl
          | type_decl
          | description_block
          | behavior_block
          | requires_block
          | input_block
          | capabilities_block
          | output_block ;
```

---

## 4. Declaração de Agente

```ebnf
agent_decl  = "agent" , agent_name , ( _newline | agent_meta_block ) ;

agent_name  = identifier , { identifier } ;

agent_meta_block = _indent ,
                   agent_meta , { _newline , agent_meta } ,
                   _dedent ;

agent_meta  = ( "domain" | "license" | "terms" | "privacy" ) , ( url | bare_string ) ;
```

**Exemplo:**
```
agent Doctor
  domain health.example.com
  license MIT
  terms  https://health.example.com/terms
  privacy https://health.example.com/privacy
```

**Nomes multi-palavra** são suportados — o parser lê identificadores consecutivos após `agent`:
```
agent Mickey Mouse
  domain disney.com
```

Agentes sem metadados também são válidos:
```
agent Draft
```

---

## 5. Blocos Semânticos (Top-Level)

### 5.1 `description`

Bloco de texto livre. Cada linha vira um `text_content`.

```ebnf
description_block = "description" ,
                    _indent ,
                    text_content , { _newline , text_content } ,
                    _dedent ;

text_content = /[^\n\r]+/ ;   (* qualquer texto na linha; baixa precedência *)
```

```
description
  Um especialista em análise clínica e emissão de diagnósticos
```

### 5.2 `behavior`

Sempre inline — referência ao arquivo `.flow`.

```ebnf
behavior_block = "behavior" , bare_string , _newline ;
```

```
behavior doctor.flow
```

### 5.3 `requires`

Lista de tipos que a Runtime deve garantir no contexto antes de acionar o `.flow`.

```ebnf
requires_block = "requires" ,
                 ( type_list , _newline
                 | _indent , type_reference , { _newline , type_reference } , _dedent ) ;
```

```
requires Prontuario, UserProfile          (* inline *)

requires                                  (* bloco *)
  Prontuario ("Electronic health record")
  UserProfile
```

### 5.4 `input`

```ebnf
input_block = "input" ,
              ( type_list , _newline
              | _indent , typed_item , { _newline , typed_item } , _dedent ) ;
```

```
input Patient, MedicalCondition           (* inline *)

input                                     (* bloco *)
  Patient "O paciente a ser atendido"
  MedicalCondition
```

### 5.5 `capabilities`

```ebnf
capabilities_block = "capabilities" ,
                     ( type_list , _newline
                     | _indent , cap_item , { _newline , cap_item } , _dedent ) ;
```

```
capabilities DiagnoseAction               (* inline *)

capabilities                              (* bloco *)
  DiagnoseAction "Emite diagnósticos clínicos"
  CreateAction "Gera relatórios"
  custom.SpeechSynthesis
```

### 5.6 `output`

```ebnf
output_block = "output" ,
               ( type_list , _newline
               | _indent , typed_item , { _newline , typed_item } , _dedent ) ;
```

```
output Prescription                       (* inline *)

output                                    (* bloco *)
  Prescription "Receita médica gerada"
```

---

## 6. Referências de Tipo

```ebnf
type_list      = type_reference , { "," , type_reference } ;

type_reference = type_ref , [ "(" , quoted_string , ")" ] ;

typed_item     = type_reference , [ quoted_string ] ;

cap_item       = type_reference , [ quoted_string ] ;

type_ref       = identifier , [ "." , identifier ] ;
```

### Formas suportadas

| Forma | Exemplo | Contexto |
|---|---|---|
| Bare | `Person` | qualquer |
| Namespace | `std.Prompt` | qualquer |
| Com anotação (parens) | `Prontuario ("EHR")` | `type_reference` |
| Com descrição (string) | `DiagnoseAction "Emite diagnósticos"` | `typed_item`, `cap_item` |
| Inline separada por vírgula | `Patient, MedicalCondition` | `type_list` |

---

## 7. Declaração de Tipo

Usado para ancorar tipagem customizada a Wikidata ou Schema.org, evitando alucinação de estrutura em runtime.

```ebnf
type_decl = "type" , identifier , _indent ,
            type_property , { _newline , type_property } ,
            _dedent ;

type_property = concept_prop
              | schema_prop
              | property_decl ;

concept_prop  = "concept" , url , [ "(" , bare_string , ")" ] ;

schema_prop   = "schema" , filename ;

property_decl = identifier , ":" , type_value , [ "?" ] , [ quoted_string ] ;

type_value    = type_ref
              | "[" , type_ref , "]"
              | "Enum" , "(" , identifier , { "," , identifier } , ")" ;
```

**Exemplo completo:**
```
type Prontuario
  concept https://www.wikidata.org/wiki/Q251648 (EHR)
  schema prontuario.json
  patient: Person
  exames: [Exam]
  status: Enum(active, archived)
  imagem?: Avatar "Foto do paciente (opcional)"
```

### Explicação das formas de `type_value`

| Forma | Exemplo | Semântica |
|---|---|---|
| Referência simples | `Person` | Tipo único |
| Array | `[Transaction]` | Lista de Transaction |
| Enum | `Enum(low, medium, high)` | Conjunto fechado de valores |

O marcador `?` após o tipo indica campo opcional. A `quoted_string` ao final é uma descrição da propriedade.

---

## 8. Convenções de Nomenclatura

| Elemento | Convenção | Exemplos |
|---|---|---|
| Agent name | Palavras separadas por espaço | `agent Doctor`, `agent Mickey Mouse` |
| Tipo customizado | PascalCase contínuo | `UserProfile`, `MedicalCondition` |
| Namespace stdlib | `std.` + PascalCase | `std.Prompt`, `std.ImageObject` |
| Namespace custom | `custom.` + PascalCase | `custom.SpeechSynthesis` |
| Propriedade | camelCase | `patient`, `exames`, `createdAt` |

O parser distingue agent names de tipos pelo contexto estrutural: após `agent` sempre vem um `agent_name`; após `input`, `output`, etc. sempre vem `type_reference`.

---

## 9. Resolução de Namespace em Runtime

Tipos sem namespace são resolvidos pela Runtime na seguinte ordem de precedência:

1. **Customizado** — declarações `type` no próprio pacote
2. **Standard Library** — `std.*` (tipos pré-definidos pela Spec)
3. **Global** — Schema.org / Wikidata

O escopo local tem precedência absoluta (*shadowing*): se existir um `type Prompt` local, ele tem prioridade sobre `std.Prompt`.

---

## 10. Referência de Keywords

| Keyword | Contexto | Função |
|---|---|---|
| `agent` | top-level | Declara um agente |
| `domain` | metadata do agent | Domínio canônico (identidade e anti-spoofing) |
| `license` | metadata do agent | Tipo de licença |
| `terms` | metadata do agent | URL dos termos de uso |
| `privacy` | metadata do agent | URL da política de privacidade |
| `description` | top-level block | Descrição em texto livre |
| `behavior` | top-level block | Arquivo `.flow` de implementação |
| `requires` | top-level block | Pré-condições de contexto |
| `input` | top-level block | Tipos de entrada |
| `capabilities` | top-level block | Ações e permissões |
| `output` | top-level block | Tipo de saída |
| `type` | top-level | Declara tipo customizado |
| `concept` | dentro de `type` | URI Wikidata/Schema.org de âncora semântica |
| `schema` | dentro de `type` | Arquivo JSON Schema de validação |
| `Enum` | valor de propriedade | Conjunto fechado de valores literais |
