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
