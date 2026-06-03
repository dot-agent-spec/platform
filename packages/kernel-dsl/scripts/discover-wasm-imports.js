#!/usr/bin/env node
/**
 * WASM Import Discovery Tool
 * 
 * Discovers all functions required by the kernel-dsl WASM binary
 * by attempting instantiation with a Proxy that tracks all accesses.
 * 
 * Usage: node scripts/discover-wasm-imports.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const accessedFunctions = new Set();
const functionCallCounts = new Map();

// Create proxy to track all accessed functions
const handler = {
  get: (target, prop) => {
    if (typeof prop === 'string') {
      accessedFunctions.add(prop);
      functionCallCounts.set(prop, (functionCallCounts.get(prop) || 0) + 1);
    }
    return (...args) => 0;
  }
};

const wasiShimProxy = new Proxy({}, handler);

async function discoverImports() {
  try {
    const wasmPath = path.join(__dirname, '../pkg/dot_agent_kernel_dsl_bg.wasm');
    
    if (!fs.existsSync(wasmPath)) {
      console.error(`❌ WASM file not found: ${wasmPath}`);
      console.error('Run: npm run build');
      process.exit(1);
    }

    const wasmBuffer = fs.readFileSync(wasmPath);
    
    // Try to instantiate with proxy that captures all accesses
    const importObject = {
      env: wasiShimProxy,
      wasi_snapshot_preview1: wasiShimProxy,
      './dot_agent_kernel_dsl_bg.js': wasiShimProxy
    };
    
    try {
      await WebAssembly.instantiate(wasmBuffer, importObject);
    } catch (e) {
      // Expected to fail, but we've captured the function accesses
      console.log('ℹ️  WASM instantiation attempt complete (may have failed, but functions were captured)');
    }
    
  } catch (err) {
    console.error('Error during discovery:', err.message);
    process.exit(1);
  }
  
  // Report findings
  console.log('\n📊 DISCOVERED FUNCTIONS:\n');
  
  const sorted = Array.from(accessedFunctions).sort();
  
  console.log(`Total unique functions accessed: ${sorted.length}\n`);
  
  // Group by category
  const groups = {
    'WASI (fd_*)': [],
    'WASI (environ_*)': [],
    'WASI (args_*)': [],
    'WASI (clock/sched)': [],
    'UBSAN (__ubsan_*)': [],
    'wasm-bindgen (__wbg_*)': [],
    'wasm-bindgen internal (__wbindgen_*)': [],
    'Other': []
  };
  
  sorted.forEach(fn => {
    if (fn.startsWith('fd_')) groups['WASI (fd_*)'].push(fn);
    else if (fn.startsWith('environ_')) groups['WASI (environ_*)'].push(fn);
    else if (fn.startsWith('args_')) groups['WASI (args_*)'].push(fn);
    else if (fn.match(/^(clock|sched)/)) groups['WASI (clock/sched)'].push(fn);
    else if (fn.startsWith('__ubsan_')) groups['UBSAN (__ubsan_*)'].push(fn);
    else if (fn.startsWith('__wbg_') && !fn.startsWith('__wbindgen_')) groups['wasm-bindgen (__wbg_*)'].push(fn);
    else if (fn.startsWith('__wbindgen_')) groups['wasm-bindgen internal (__wbindgen_*)'].push(fn);
    else groups['Other'].push(fn);
  });
  
  Object.entries(groups).forEach(([category, fns]) => {
    if (fns.length > 0) {
      console.log(`\n${category}:`);
      fns.forEach(fn => {
        const count = functionCallCounts.get(fn);
        console.log(`  ${fn}: ${count} ${count === 1 ? 'call' : 'calls'}`);
      });
    }
  });
  
  // Generate JavaScript code
  console.log('\n\n📝 GENERATED CODE FOR SHIM:\n');
  console.log('const wasiShim = {');
  sorted.forEach(fn => {
    console.log(`  ${fn}: () => 0,`);
  });
  console.log('};');
}

discoverImports();
