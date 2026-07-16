import { isNodeRuntime } from '../dist/index.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Regressão: init() usava `typeof window !== 'undefined'` pra decidir entre
// fetch() e node:fs/promises. Esse check é `false` tanto em Node quanto num
// Web Worker (workers não têm `window`, só `self`) — indistinguível, e é
// exatamente o que causava "readFile is not a function" quando o kernel
// rodava dentro de um worker bundlado pro browser. isNodeRuntime() precisa
// separar os dois corretamente.

test('isNodeRuntime() é true em Node.js real', () => {
  assert.equal(isNodeRuntime(), true);
});

test('isNodeRuntime() é false quando process.versions.node não existe (formato Worker/browser)', () => {
  const original = process.versions.node;
  // simula um global tipo Worker/browser onde `process` pode existir
  // (alguns bundlers fazem polyfill) mas sem informação de versão do Node
  delete process.versions.node;
  try {
    assert.equal(isNodeRuntime(), false);
  } finally {
    process.versions.node = original;
  }
});
