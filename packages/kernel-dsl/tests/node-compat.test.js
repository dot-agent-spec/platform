// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { init, AgentDSLKernel } from '../dist/index.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Initialize WASM once for all tests
await init();

test('init() carrega WASM sem erros em Node.js', async () => {
  // init() foi chamado acima, só verificar que não há erro
  assert(true, 'WASM foi carregado com sucesso');
});

test('AgentDSLKernel instancia sem erro', () => {
  const kernel = new AgentDSLKernel();
  assert(kernel !== null, 'kernel deve ser instância válida');
  kernel.free();
});

test('load_behavior processa behavior e retorna efeitos', () => {
  const kernel = new AgentDSLKernel();

  const behavior = `
state init
  goal "Welcome"
  interact
  on intent "hello" transition to next
`;

  const result = JSON.parse(kernel.load_behavior(behavior));
  assert(Array.isArray(result), 'load_behavior deve retornar array de efeitos');
  assert(result.length >= 2, 'deve ter pelo menos goal + request_interact');
  assert.equal(result[0].type, 'goal', 'primeiro efeito deve ser goal');
  kernel.free();
});

test('get_graph retorna SCXML válido com estado ativo anotado', () => {
  const kernel = new AgentDSLKernel();

  const behavior = `
state init
  goal "Greeting"
  interact
  on intent "hi" transition to next
  on offtopic transition to init

state next
  goal "Done"
  interact
  on intent "bye" transition to init
  on offtopic transition to next
`;

  kernel.load_behavior(behavior);
  const scxml = kernel.get_graph();
  assert(typeof scxml === 'string', 'get_graph deve retornar string');
  assert(scxml.includes('<?xml'), 'deve ser SCXML');
  assert(scxml.includes('_active="true"'), 'deve anotar o estado ativo');
  assert(scxml.includes('id="init"'), 'deve conter estado init');
  assert(scxml.includes('id="next"'), 'deve conter estado next');
  assert(scxml.includes('_active="true"') && scxml.includes('id="init"'), 'init deve ser o estado ativo inicial');
  // init deve ser o estado ativo (primeiro estado declarado)
  const activeStateMatch = scxml.match(/<(?:state|final)[^>]*_active="true"[^>]*id="([^"]+)"/);
  const activeStateMatch2 = scxml.match(/<(?:state|final)[^>]*id="([^"]+)"[^>]*_active="true"/);
  const activeId = (activeStateMatch || activeStateMatch2)?.[1];
  assert.equal(activeId, 'init', 'estado ativo deve ser init');
  kernel.free();
});
