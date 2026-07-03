import { build } from 'esbuild'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const monorepoRoot = path.resolve(root, '../..')
const distDir = path.join(root, 'dist')

fs.rmSync(distDir, { recursive: true, force: true })
fs.mkdirSync(distDir, { recursive: true })

// 1. Bundle the extension client. `vscode` is only resolvable inside the
// Extension Host, so it must stay external; everything else (vscode-languageclient)
// is pure JS and safe to inline.
await build({
  entryPoints: [path.join(root, 'extension.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: path.join(distDir, 'extension.js'),
  external: ['vscode'],
  sourcemap: true,
  logLevel: 'info',
})

// 2. Bundle the language server. @dot-agent/parser-dsl and web-tree-sitter locate
// their WASM binary relative to their own file/import.meta.url — flattening them
// into this bundle would break that math (same story as any native/WASM npm
// package: sharp, better-sqlite3, etc.). @dot-agent/tree-sitter only exports two
// path.resolve(__dirname, ...) strings and would survive bundling, but is kept
// external too for consistency with the other two and to avoid re-deriving this
// per package. Everything else (the language-server's own code, @dot-agent/compiler,
// vscode-languageserver*) is pure JS and gets inlined.
//
// Output format is ESM, not CJS: both language-server/parser.js and compiler's
// built output do `createRequire(import.meta.url)` to reach into @dot-agent/tree-sitter
// — `import.meta` is unconditionally empty in esbuild's CJS output (esbuild warns
// about exactly this), which would make that call throw at runtime. ESM keeps
// `import.meta.url` real. The .mjs extension (not .js) is required so Node's
// module loader — invoked here via vscode-languageclient's child_process.fork —
// treats the file as ESM without needing a package.json "type" field in dist/.
await build({
  entryPoints: [path.join(monorepoRoot, 'packages/language-server/server.js')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: path.join(distDir, 'server.mjs'),
  external: ['@dot-agent/parser-dsl', '@dot-agent/tree-sitter', 'web-tree-sitter'],
  sourcemap: true,
  logLevel: 'info',
  // vscode-languageserver (a CJS package) has a require() call esbuild can't
  // statically resolve into an ESM import at bundle time, so it falls back to a
  // "Dynamic require is not supported" stub in plain ESM output. Defining a real
  // `require` in scope via createRequire fixes it for that call and any other
  // builtin require() reachable from bundled CJS deps.
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
})

// 3. Copy the externalized WASM-bearing packages verbatim (not vsce's automatic
// node_modules inclusion, which is what triggers the duplicate-path bug on npm
// workspace monorepos in the first place). Only the files each package's own
// runtime code actually touches — verified against their built dist/ output.
function copyPkg(name, srcDir, entries) {
  const dest = path.join(distDir, 'node_modules', name)
  for (const rel of entries) {
    const src = path.join(srcDir, rel)
    const out = path.join(dest, rel)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.cpSync(src, out, { recursive: true })
  }
}

copyPkg('@dot-agent/parser-dsl', path.join(monorepoRoot, 'packages/parser-dsl'), [
  'package.json',
  'dist',
  'pkg',
])
copyPkg('@dot-agent/tree-sitter', path.join(monorepoRoot, 'packages/tree-sitter'), [
  'package.json',
  'dist',
])
copyPkg('web-tree-sitter', path.join(monorepoRoot, 'node_modules/web-tree-sitter'), [
  'package.json',
  'web-tree-sitter.js',
  'web-tree-sitter.wasm',
])

console.log(
  'Build complete: dist/extension.js, dist/server.mjs, ' +
  'dist/node_modules/{@dot-agent/parser-dsl,@dot-agent/tree-sitter,web-tree-sitter}'
)
