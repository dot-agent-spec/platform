import { init, AgentDSLKernel } from '../index.js';
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
state welcome
  goal "Welcome"
  interact
  on intent "hello" transition to next
`;

  const result = kernel.load_behavior(behavior);
  assert(Array.isArray(result), 'load_behavior deve retornar array de efeitos');
  assert(result.length >= 2, 'deve ter pelo menos goal + request_interact');
  assert.equal(result[0].type, 'goal', 'primeiro efeito deve ser goal');
  kernel.free();
});

test('get_graph retorna topologia válida', () => {
  const kernel = new AgentDSLKernel();

  const behavior = `
state greet
  goal "Greeting"
  interact
  on intent "hi" transition to next
`;

  kernel.load_behavior(behavior);
  const graph = kernel.get_graph();
  assert(graph.states, 'graph deve ter states');
  assert(graph.transitions, 'graph deve ter transitions');
  assert.equal(graph.current, 'greet', 'estado atual deve ser greet');
  kernel.free();
});
