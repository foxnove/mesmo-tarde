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

async function withSite(check, bootstrap = '') {
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
          `<script>const originalFetch = window.fetch; window.fetch = (url, options) => String(url).startsWith('https://api.github.com/') ? Promise.resolve(new Response('', {status:503})) : originalFetch(url, options);</script><script src="agenda-engine.js">`)
          .replace('</body>', bootstrap + '</body>'));
      }
      if (pathname === '/agenda/data.json') {
        // Keep this two-response fallback fixture stable as other members join.
        const data = JSON.parse(content);
        data.members = data.members.filter(m => ['foxnove', 'danrdfig-tech'].includes(m.github));
        data.availability = data.availability.filter(m => ['foxnove', 'danrdfig-tech'].includes(m.github));
        data.confirmedRehearsals = [];
        content = Buffer.from(JSON.stringify(data));
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

test('Agenda renders a two-response snapshot, three pending musicians and no fake rehearsal', async () => {
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

test('Real mobile browser signs in, edits its own slot, shows a star and blocks a short slot', async () => {
  const bootstrap = `<script>
    const members = Array.from({length:5}, (_, i) => ({github:i ? 'm'+i : 'foxnove', name:'M'+i, active:true}));
    const slot = {date:'2026-10-16',startTime:'19:00',endTime:'21:00',status:'available'};
    const issues = members.map((m,i) => ({number:i+1,state:'open',user:{login:m.github},title:'Disponibilidade - outubro',labels:[],updated_at:'2026-10-13',body:AgendaGithub.body([slot])}));
    const alerts = []; window.alert = message => alerts.push(message);
    window.fetch = async (url, options={}) => {
      let data;
      if (String(url).includes('members.json')) data = members;
      else if (String(url).includes('config.json')) data = {expectedMembers:5};
      else if (String(url).includes('data.json')) data = AgendaEngine.buildAgendaData(members, issues, 5);
      else if (String(url).endsWith('/user')) data = {login:'foxnove'};
      else if (String(url).includes('issues?')) data = issues;
      else { data = issues.find(i => i.number === Number(String(url).split('/').at(-1))); if(options.method==='PATCH') Object.assign(data,JSON.parse(options.body)); }
      return new Response(JSON.stringify(data),{status:200});
    };
    window.addEventListener('load', () => setTimeout(async () => {
      try {
        await refreshAgenda();
        if (!document.querySelector('.perfect-star')) throw Error('missing star');
        document.getElementById('loginModal').showModal();
        document.getElementById('githubTokenInput').value = 'test-token';
        await signInAgenda();
        const edit = Array.from(document.querySelectorAll('#mySlotsContainer button')).find(b=>b.textContent==='Editar');
        edit.click();
        if (!document.getElementById('recordModal').open || !document.getElementById('draftBuilder').hidden) throw Error('incorrect edit modal');
        document.getElementById('slotEndInput').value='20:59'; await saveSlotEdit();
        if (!alerts.at(-1).includes('2 horas')) throw Error('missing duration alert');
        document.getElementById('slotEndInput').value='21:00'; document.getElementById('slotStartInput').value='18:00';
        await saveSlotEdit();
        if (!document.getElementById('mySlotsContainer').textContent.includes('18:00')) throw Error('edit missing');
        if (document.getElementById('recordModal').open) throw Error('modal did not close');
        if (document.documentElement.scrollWidth > innerWidth) throw Error('mobile overflow');
        document.body.setAttribute('data-agenda-check','passed');
      } catch(e) { document.body.setAttribute('data-agenda-check',e.message); }
    },100));
  </script>`;
  await withSite(async port => {
    const { stdout } = await run(getChromePath(), [...CHROME_FLAGS, '--window-size=390,844', `http://127.0.0.1:${port}/agenda/`]);
    assert.match(stdout, /data-agenda-check="passed"/);
  }, bootstrap);
});
