#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(__dirname, '../pkg/package.json');

console.log('📝 Creating pkg/package.json...');

const manifest = {
  name: '@dot-agent/kernel-dsl',
  version: '0.1.1',
  type: 'module',
  main: 'dot_agent_kernel_dsl.js',
  types: 'dot_agent_kernel_dsl.d.ts',
  publishConfig: {
    access: 'public'
  }
};

fs.writeFileSync(pkgPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
console.log('✅ Created pkg/package.json');
