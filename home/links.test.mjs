import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const run = promisify(execFile);
const root = process.cwd();
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mjs': 'text/javascript', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg' };

async function withSite(check) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const relativePath = pathname.endsWith('/') ? `${pathname.replace(/^\//, '')}index.html` : pathname.replace(/^\//, '');
    const file = normalize(join(root, relativePath));
    if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
    try {
      const content = await readFile(file);
      response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream' });
      response.end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await check(server.address().port);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('links that leave /home open safely in a new tab', async () => {
  await withSite(async port => {
    const { stdout } = await run(chrome, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required', '--virtual-time-budget=4000', '--dump-dom',
      `http://127.0.0.1:${port}/home/`
    ]);
    for (const className of ['lyrics-link', 'track-cifra']) {
      assert.match(stdout, new RegExp(`class="${className}"[^>]*target="_blank"[^>]*rel="noopener noreferrer"`));
    }
    assert.match(stdout, /class="tracklist-footer"[\s\S]*?<a href="\.\.\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  });
});
