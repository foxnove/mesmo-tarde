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
    const { stdout } = await run(chrome, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--virtual-time-budget=4000', '--dump-dom',
      `http://127.0.0.1:${port}/agenda/`
    ]);

    // Check header
    assert.match(stdout, /AGENDA FOX/);
    assert.match(stdout, /Ensaios • Mesmo Tarde/);

    // Check confirmed rehearsals
    assert.match(stdout, /ENSAIO CONFIRMADO/);
    assert.match(stdout, /Passagem de Repertório Completo/);

    // Check intersection window calculation
    assert.match(stdout, /20:00 – 21:30|20:00 – 22:00/);
    assert.match(stdout, /HORÁRIO IDEAL/);

    // Check modal and registration button
    assert.match(stdout, /id="recordModal"/);
    assert.match(stdout, /Registrar no GitHub/);
  });
});
