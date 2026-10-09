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
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

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

test('Cifra Fox loads 13 songs and renders properly', async () => {
  await withSite(async port => {
    const { stdout } = await run(chrome, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--virtual-time-budget=4000', '--dump-dom',
      `http://127.0.0.1:${port}/`
    ]);

    // Check header and core elements
    assert.match(stdout, /CIFRA FOX/);
    assert.match(stdout, /Diego Fox — Mesmo Tarde/);

    // Check that songs are rendered in tracklist
    assert.match(stdout, /Do Azul/);
    assert.match(stdout, /Mesmo Tarde/);
    assert.match(stdout, /Sweet Mystery/);

    // Check player elements
    assert.match(stdout, /id="mainAudioPlayer"/);
    assert.match(stdout, /id="btnMainPlay"/);
    assert.match(stdout, /id="btnAutoScroll"/);
    assert.match(stdout, /id="btnThemeToggle"/);
    assert.match(stdout, /id="transposeOffset">0</);

    // Check links to other sections
    assert.match(stdout, /href="agenda\/"/);
    assert.match(stdout, /href="home\/"/);
  });
});

test('Cifra Fox deep linking via hash works', async () => {
  await withSite(async port => {
    const { stdout } = await run(chrome, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--virtual-time-budget=4000', '--dump-dom',
      `http://127.0.0.1:${port}/#08_mesmo_tarde`
    ]);

    // Track 8 title should be shown in player
    assert.match(stdout, /08\.\s+Mesmo Tarde/i);
  });
});
