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

import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// The SDK is what Murici imports directly in its browser worker
// (worker/fsm.worker.ts). Its own dist is clean, but it re-exports
// @dot-agent/kernel-dsl (+ compiler/core, jszip) as external imports — so a
// `node:` scheme leak in that transitive chain still 500s Murici's webpack
// build. Unlike the per-package tests, this bundles the WHOLE chain
// (bundle: true, no externals) to reproduce Murici's real import path
// sdk → kernel-dsl and catch a leak even if a sibling package's own guard is
// missed. Passes iff the entire browser-facing chain is free of static `node:`
// imports. See the 0.10.2 tsup→tsdown regression.
test("dist/index.mjs + its @dot-agent chain bundle for a browser target (no node: leak)", async () => {
  await build({
    entryPoints: [join(pkgRoot, 'dist/index.mjs')],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
});
