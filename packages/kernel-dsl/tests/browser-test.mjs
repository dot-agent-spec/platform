import { chromium } from '/Users/danilo/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.wasm': 'application/wasm',
  '.ts':   'application/javascript',
};

const server = createServer(async (req, res) => {
  try {
    const filePath = join(ROOT, req.url === '/' ? '/tests/browser-test.html' : req.url);
    const buf = await readFile(filePath);
    const mime = MIME[extname(filePath)] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime, 'Cross-Origin-Opener-Policy': 'same-origin' });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end('not found: ' + req.url);
  }
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const { port } = server.address();

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage();

page.on('console', msg => console.log('[browser]', msg.text()));
page.on('pageerror', err => console.error('[browser error]', err.message));

await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForSelector('[data-done]', { timeout: 10000 });

const result = await page.$eval('body', el => el.getAttribute('data-done'));
const output = await page.$eval('#output', el => el.textContent);

console.log(output);

await browser.close();
server.close();

process.exit(result === 'ok' ? 0 : 1);