#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../pkg/dot_agent_kernel_dsl.js');

console.log('📝 Patching WASM-bindgen output...');

if (!fs.existsSync(filePath)) {
  console.warn(`⚠️  File not found: ${filePath}`);
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf-8');

// Check if already patched
if (content.includes('MODIFIED: WASM is loaded manually')) {
  console.log('✅ Already patched');
  process.exit(0);
}

// Remove the problematic import lines that cause webpack parse errors
content = content
  .replace(/import \* as wasm from ["']\.\/dot_agent_kernel_dsl_bg\.wasm["'];?\n/g, '')
  .replace(/import { __wbg_set_wasm } from ["']\.\/dot_agent_kernel_dsl_bg\.js["'];?\n/g, '')
  .replace(/^__wbg_set_wasm\(wasm\);\n/m, '')
  .replace(/^wasm\.__wbindgen_start\(\);\n/m, '');

// Add comment explaining the change
if (!content.includes('MODIFIED:')) {
  content = content.replace(
    /\/\* @ts-self-types=/,
    '/* @ts-self-types'
  );
  const tsLine = content.match(/\/\* @ts-self-types[^\n]*\n/)[0];
  content = content.replace(
    tsLine,
    tsLine + '/* MODIFIED: WASM is loaded manually by index.js to avoid webpack parse errors */\n'
  );
}

fs.writeFileSync(filePath, content, 'utf-8');

// Patch _bg.js: fix stale Uint8Array cache after WASM memory.grow
const bgPath = path.join(__dirname, '../pkg/dot_agent_kernel_dsl_bg.js');
if (fs.existsSync(bgPath)) {
  let bgContent = fs.readFileSync(bgPath, 'utf-8');
  const staleCheck = 'if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {';
  const freshCheck = 'if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0 || cachedUint8ArrayMemory0.buffer !== wasm.memory.buffer) {';
  if (bgContent.includes(staleCheck)) {
    bgContent = bgContent.replace(staleCheck, freshCheck);
    fs.writeFileSync(bgPath, bgContent, 'utf-8');
    console.log('✅ Patched _bg.js memory staleness fix');
  }
}

console.log('✅ Patched successfully');
