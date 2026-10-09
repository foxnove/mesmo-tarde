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
      let content = await readFile(file);
      // Keep browser checks deterministic: exercise the real snapshot fallback,
      // without depending on GitHub availability or API rate limits.
      if (pathname === '/agenda/') {
        content = Buffer.from(content.toString().replace('<script src="agenda-engine.js">',
          `<script>const originalFetch = window.fetch; window.fetch = (url, options) => String(url).startsWith('https://api.github.com/') ? Promise.resolve(new Response('', {status:503})) : originalFetch(url, options);</script><script src="agenda-engine.js">`));
      }
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

test('Agenda renders Diego and Danilo answers, three pending musicians and no fake rehearsal', async () => {
  await withSite(async port => {
    const { stdout } = await run(getChromePath(), [
      ...CHROME_FLAGS,
      `http://127.0.0.1:${port}/agenda/`
    ]);

    // Check header
    assert.match(stdout, /AGENDA FOX/);
    assert.match(stdout, /Ensaios • Mesmo Tarde/);

    // Check modal and registration button
    assert.match(stdout, /id="recordModal"/);
    assert.match(stdout, /Registrar no GitHub/);
    assert.match(stdout, /2 de 5 integrantes responderam/);
    assert.match(stdout, /3 aguardando resposta/);
    assert.match(stdout, /Danilo/);
    assert.match(stdout, /26 de Outubro/);
    assert.match(stdout, /16 de Outubro/);
    assert.match(stdout, /30 de Outubro/);
    assert.match(stdout, /19:00 – 22:00/);
    assert.doesNotMatch(stdout, /class="badge-ideal"/);
    assert.doesNotMatch(stdout, /Passagem de Repertório Completo|Estúdio Fox|baixo-fox|batera-fox/);
    assert.match(stdout, /id="slotStartInput"[^>]*>/);
    assert.doesNotMatch(stdout, /id="slot(?:Date|Start|End)Input"[^>]*value="[^\"]+"/);
    assert.match(stdout, /Não foi possível atualizar/);
  });
});
