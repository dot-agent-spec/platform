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

// Regression guard for the 0.10.2 break (tsup→tsdown): a `node:`-scheme import
// leaking into the browser entry makes webpack (Murici's fsm.worker) throw
// UnhandledSchemeError. esbuild platform:'browser' fails the same way on a
// static `node:` import, but leaves a runtime-computed `import()` alone — so
// this passes iff the fix (opaque specifier, guarded by isNodeRuntime) holds.
//
// This is deliberately a *bundler-level* test: a plain `node --test` import of
// dist runs in Node and never exercises the browser bundling path — which is
// exactly why `dot-agent run` never caught this class of bug.
test("dist/index.mjs bundles for a browser target (no node: scheme leak)", async () => {
  await build({
    entryPoints: [join(pkgRoot, 'dist/index.mjs')],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
});
