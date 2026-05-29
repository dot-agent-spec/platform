/*
 * Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// flow/src/scanner.c — External scanner for the .flow DSL
//
// Identical algorithm to the agent scanner. Emits:
//   NEWLINE  — \n where the next line has the SAME indentation level
//   INDENT   — \n where the next line has MORE indentation (block opens)
//   DEDENT   — \n where the next line has LESS indentation (block closes)
//
// Function names use the tree_sitter_flow_ prefix (required by tree-sitter
// when grammar name is 'flow').

#include "tree_sitter/parser.h"
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

// Must match the order of externals in flow/grammar.js
enum TokenType {
  NEWLINE,
  INDENT,
  DEDENT,
};

#define MAX_DEPTH 64

typedef struct {
  uint16_t stack[MAX_DEPTH];
  uint8_t  depth;
  uint8_t  pending_dedents;
} Scanner;

// ---- Tree-sitter lifecycle -------------------------------------------------

void *tree_sitter_flow_external_scanner_create() {
  Scanner *s = calloc(1, sizeof(Scanner));
  s->stack[0] = 0;
  s->depth = 0;
  s->pending_dedents = 0;
  return s;
}

void tree_sitter_flow_external_scanner_destroy(void *payload) {
  free(payload);
}

unsigned tree_sitter_flow_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *s = payload;
  buffer[0] = s->depth;
  buffer[1] = s->pending_dedents;
  unsigned offset = 2;
  for (int i = 0; i <= s->depth; i++) {
    buffer[offset++] = (char)(s->stack[i] & 0xFF);
    buffer[offset++] = (char)((s->stack[i] >> 8) & 0xFF);
  }
  return offset;
}

void tree_sitter_flow_external_scanner_deserialize(void *payload, const char *buffer, unsigned n) {
  Scanner *s = payload;
  if (n < 2) return;
  s->depth = (uint8_t)buffer[0];
  s->pending_dedents = (uint8_t)buffer[1];
  unsigned offset = 2;
  for (int i = 0; i <= s->depth && offset + 1 < n; i++) {
    s->stack[i] = (uint8_t)buffer[offset] | ((uint8_t)buffer[offset + 1] << 8);
    offset += 2;
  }
}

// ---- Helpers ---------------------------------------------------------------

static void push(Scanner *s, uint16_t level) {
  if (s->depth < MAX_DEPTH - 1) {
    s->stack[++s->depth] = level;
  }
}

static void pop(Scanner *s) {
  if (s->depth > 0) s->depth--;
}

static uint16_t count_indent(TSLexer *lexer) {
  uint16_t col = 0;
  while (lexer->lookahead == ' ')  { col += 1; lexer->advance(lexer, true); }
  while (lexer->lookahead == '\t') { col += 2; lexer->advance(lexer, true); }
  return col;
}

// ---- Main scan function ----------------------------------------------------

bool tree_sitter_flow_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid) {
  Scanner *s = payload;

  if (s->pending_dedents > 0 && valid[DEDENT]) {
    s->pending_dedents--;
    pop(s);
    lexer->result_symbol = DEDENT;
    return true;
  }

  if (lexer->eof(lexer)) {
    if (valid[DEDENT] && s->depth > 0) {
      pop(s);
      lexer->result_symbol = DEDENT;
      return true;
    }
    return false;
  }

  if (lexer->lookahead != '\n' && lexer->lookahead != '\r') {
    return false;
  }

  if (lexer->lookahead == '\r') lexer->advance(lexer, true);
  lexer->advance(lexer, true);

  for (;;) {
    uint16_t col = count_indent(lexer);

    if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
      if (lexer->lookahead == '\r') lexer->advance(lexer, true);
      lexer->advance(lexer, true);
      continue;
    }

    // Comment line (starts with //) — skip to end of line
    if (lexer->lookahead == '/') {
      while (lexer->lookahead != '\n' && lexer->lookahead != '\r' && !lexer->eof(lexer)) {
        lexer->advance(lexer, true);
      }
      if (lexer->lookahead == '\r') lexer->advance(lexer, true);
      if (!lexer->eof(lexer))       lexer->advance(lexer, true);
      continue;
    }

    if (lexer->eof(lexer)) {
      if (valid[DEDENT] && s->depth > 0) {
        pop(s);
        lexer->result_symbol = DEDENT;
        return true;
      }
      if (valid[NEWLINE]) {
        lexer->result_symbol = NEWLINE;
        return true;
      }
      return false;
    }

    uint16_t current = s->stack[s->depth];

    if (col > current && valid[INDENT]) {
      push(s, col);
      lexer->result_symbol = INDENT;
      return true;
    }

    if (col < current) {
      uint8_t pops = 0;
      int tmp = s->depth;
      while (tmp > 0 && s->stack[tmp] > col) { tmp--; pops++; }

      if (valid[DEDENT]) {
        s->pending_dedents = pops > 0 ? pops - 1 : 0;
        pop(s);
        lexer->result_symbol = DEDENT;
        return true;
      }
    }

    if (valid[NEWLINE]) {
      lexer->result_symbol = NEWLINE;
      return true;
    }

    return false;
  }
}
