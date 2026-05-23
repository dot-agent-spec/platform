// scanner.c — External scanner for indentation-sensitive tokens
//
// Emits three synthetic tokens that Tree-sitter cannot produce natively:
//   NEWLINE  — a \n where the next line has the SAME indentation level
//   INDENT   — a \n where the next line has MORE indentation (block opens)
//   DEDENT   — a \n where the next line has LESS indentation (block closes)
//
// The scanner is called by Tree-sitter when any of these tokens appear in
// the set of valid_symbols for the current parser state.
//
// Algorithm:
//   1. If there are pending DEDENTs from a multi-level jump, emit them one-by-one.
//   2. Otherwise, on \n: consume it, skip blank/comment lines, count the next
//      line's indentation, compare with the stack, emit the right token.

#include "tree_sitter/parser.h"
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

// Must match the order of externals in grammar.js
enum TokenType {
  NEWLINE,
  INDENT,
  DEDENT,
};

#define MAX_DEPTH 64

typedef struct {
  uint16_t stack[MAX_DEPTH]; // indentation level at each open block
  uint8_t  depth;            // index of the current (innermost) level
  uint8_t  pending_dedents;  // queued DEDENTs to emit on subsequent calls
} Scanner;

// ---- Tree-sitter lifecycle -------------------------------------------------

void *tree_sitter_agent_external_scanner_create() {
  Scanner *s = calloc(1, sizeof(Scanner));
  s->stack[0] = 0;
  s->depth = 0;
  s->pending_dedents = 0;
  return s;
}

void tree_sitter_agent_external_scanner_destroy(void *payload) {
  free(payload);
}

// Serialize scanner state into Tree-sitter's incremental-parse cache.
// Format: [depth, pending_dedents, stack[0]_lo, stack[0]_hi, ...]
unsigned tree_sitter_agent_external_scanner_serialize(void *payload, char *buffer) {
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

void tree_sitter_agent_external_scanner_deserialize(void *payload, const char *buffer, unsigned n) {
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

// Count spaces/tabs on the current line (does not consume a \n).
// Advances the lexer over the whitespace (marked as non-token chars).
static uint16_t count_indent(TSLexer *lexer) {
  uint16_t col = 0;
  while (lexer->lookahead == ' ')  { col += 1; lexer->advance(lexer, true); }
  while (lexer->lookahead == '\t') { col += 2; lexer->advance(lexer, true); }
  return col;
}

// ---- Main scan function ----------------------------------------------------

bool tree_sitter_agent_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid) {
  Scanner *s = payload;

  // 1. Drain any queued DEDENTs before looking at new input.
  //    This happens when we jumped back multiple indentation levels at once.
  if (s->pending_dedents > 0 && valid[DEDENT]) {
    s->pending_dedents--;
    pop(s);
    lexer->result_symbol = DEDENT;
    return true;
  }

  // 2. Emit trailing DEDENTs at end-of-file to close any open blocks.
  if (lexer->eof(lexer)) {
    if (valid[DEDENT] && s->depth > 0) {
      pop(s);
      lexer->result_symbol = DEDENT;
      return true;
    }
    return false;
  }

  // 3. We only act when positioned at a newline character.
  if (lexer->lookahead != '\n' && lexer->lookahead != '\r') {
    return false;
  }

  // Consume \r\n or \n
  if (lexer->lookahead == '\r') lexer->advance(lexer, true);
  lexer->advance(lexer, true);

  // 4. Skip blank lines and full-line comments, then measure indentation.
  for (;;) {
    uint16_t col = count_indent(lexer);

    // Blank line — skip and continue counting
    if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
      if (lexer->lookahead == '\r') lexer->advance(lexer, true);
      lexer->advance(lexer, true);
      continue;
    }

    // Comment line (starts with //) — skip to end of line and continue
    if (lexer->lookahead == '/') {
      while (lexer->lookahead != '\n' && lexer->lookahead != '\r' && !lexer->eof(lexer)) {
        lexer->advance(lexer, true);
      }
      if (lexer->lookahead == '\r') lexer->advance(lexer, true);
      if (!lexer->eof(lexer))       lexer->advance(lexer, true);
      continue;
    }

    // EOF after blank/comment lines
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

    // 5. Compare measured indent with the current stack level.
    uint16_t current = s->stack[s->depth];

    if (col > current && valid[INDENT]) {
      push(s, col);
      lexer->result_symbol = INDENT;
      return true;
    }

    if (col < current) {
      // Count how many levels we need to pop (multi-level dedent jump)
      uint8_t pops = 0;
      int tmp = s->depth;
      while (tmp > 0 && s->stack[tmp] > col) { tmp--; pops++; }

      if (valid[DEDENT]) {
        // Emit first DEDENT now; queue the rest for subsequent calls
        s->pending_dedents = pops > 0 ? pops - 1 : 0;
        pop(s);
        lexer->result_symbol = DEDENT;
        return true;
      }
    }

    // Same level (or we couldn't emit INDENT/DEDENT) → NEWLINE
    if (valid[NEWLINE]) {
      lexer->result_symbol = NEWLINE;
      return true;
    }

    return false;
  }
}
