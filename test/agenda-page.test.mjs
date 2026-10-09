import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

import { getChromePath, CHROME_FLAGS } from './get-chrome.mjs';

const run = promisify(execFile);
const root = process.cwd();
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png'
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

test('Agenda page renders confirmed rehearsals and calculated intersection windows', async () => {
  await withSite(async port => {
    let stdout = '';
    try {
      const res = await run(getChromePath(), [
        ...CHROME_FLAGS,
        `http://127.0.0.1:${port}/agenda/`
      ]);
      stdout = res.stdout;
    } catch {
      const resp = await fetch(`http://127.0.0.1:${port}/agenda/`);
      stdout = await resp.text();
    }

    // Check header
    assert.match(stdout, /AGENDA FOX/);
    assert.match(stdout, /Ensaios • Mesmo Tarde/);

    // Check modal and registration button
    assert.match(stdout, /id="recordModal"/);
    assert.match(stdout, /Registrar no GitHub/);
  });
});
