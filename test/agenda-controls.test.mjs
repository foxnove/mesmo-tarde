import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import Engine from '../agenda/agenda-engine.js';
import Github from '../agenda/agenda-github.js';

class Element {
  children = []; value = ''; style = {}; dataset = {}; className = ''; textContent = ''; open = false;
  classList = { toggle() {} };
  appendChild(node) { this.children.push(node); return node; }
  set innerHTML(value) { this.children = []; this.html = value; }
  get innerHTML() { return this.html || ''; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  setAttribute() {}
}
function setup(login = 'foxnove') {
  const elements = new Map(); const alerts = []; const writes = [];
  let releasePatch;
  let delayedPatch;
  let issueReads = 0;
  const members = Array.from({ length: 5 }, (_, i) => ({ github: i ? `m${i}` : 'foxnove', name: `M${i}`, active: true }));
  const slot = { date: '2026-10-16', startTime: '19:00', endTime: '21:00', status: 'available', note: '' };
  const issues = members.map((m, i) => ({ number: i + 1, state: 'open', title: 'Disponibilidade - outubro', user: { login: m.github }, labels: [], updated_at: '2026-10-13', body: Github.body([slot]) }));
  issues.push({ number: 20, state: 'open', user: { login: 'foxnove' }, labels: ['ensaio-confirmado'], updated_at: '2026-10-13', body: '```json\n' + JSON.stringify(slot) + '\n```' });
  const fetch = async (url, options = {}) => {
    let data;
    if (url.includes('members.json')) data = members;
    else if (url.includes('config.json')) data = { expectedMembers: 5 };
    else if (url.includes('data.json')) data = Engine.buildAgendaData(members, issues, 5);
    else if (url.endsWith('/user')) data = { login };
    else if (/issues\?/.test(url)) { issueReads++; data = issues.filter(i => i.state === 'open'); }
    else {
      data = issues.find(i => i.number === Number(url.split('/').at(-1)));
      if (options.method === 'PATCH') { if (delayedPatch) await delayedPatch; const payload = JSON.parse(options.body); writes.push(payload); Object.assign(data, payload); }
    }
    return { ok: true, json: async () => structuredClone(data) };
  };
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    createElement() { return new Element(); }, querySelectorAll() { return []; }, addEventListener() {} };
  const context = vm.createContext({ document, fetch, AgendaEngine: Engine, AgendaGithub: Github, alert: m => alerts.push(m), confirm: () => true, console });
  context.window = context;
  vm.runInContext(readFileSync(new URL('../agenda/app.js', import.meta.url), 'utf8'), context);
  const get = id => document.getElementById(id);
  const all = node => [node, ...node.children.flatMap(all)];
  return { context, get, all, alerts, writes, delayPatch() { delayedPatch = new Promise(resolve => { releasePatch = resolve; }); }, releasePatch() { releasePatch(); }, get issueReads() { return issueReads; } };
}
test('Five members render a corner star and admin-only delete; login reveals own editing controls', async () => {
  const { context, get, all } = setup();
  await context.AgendaApp.loadData();
  assert.ok(all(get('tabContentContainer')).some(n => n.className === 'perfect-star'));
  assert.ok(!all(get('confirmedContainer')).some(n => n.textContent === 'Excluir ensaio'));
  get('githubTokenInput').value = 'test-token';
  await context.signInAgenda();
  assert.ok(all(get('confirmedContainer')).some(n => n.textContent === 'Excluir ensaio'));
  assert.equal(all(get('mySlotsContainer')).filter(n => n.textContent === 'Editar').length, 5);
  assert.equal(all(get('mySlotsContainer')).filter(n => n.textContent === 'Apagar').length, 1);
  assert.equal(get('manageSlotsTitle').textContent, 'Horários da banda');
  assert.equal(get('githubTokenInput').value, '');
  context.signOutAgenda();
  assert.ok(!all(get('confirmedContainer')).some(n => n.textContent === 'Excluir ensaio'));
});

test('Admin can open another member slot and save its new time', async () => {
  const { context, get, all, writes } = setup();
  await context.AgendaApp.loadData(); get('githubTokenInput').value = 'test-token'; await context.signInAgenda();
  const row = get('mySlotsContainer').children.find(n => all(n).some(c => c.textContent.includes('M1 (@m1)')));
  assert.ok(row, 'Admin list must identify the member');
  all(row).find(n => n.textContent === 'Editar').onclick();
  get('slotStartInput').value = '18:00'; await context.saveSlotEdit();
  assert.equal(writes.length, 1);
  const updatedRow = get('mySlotsContainer').children.find(n => all(n).some(c => c.textContent.includes('M1 (@m1)')));
  assert.ok(all(updatedRow).some(c => c.textContent.includes('18:00')));
});
test('Short registration alerts without adding a draft; editing saves and updates the displayed time', async () => {
  const { context, get, all, alerts, writes } = setup();
  await context.AgendaApp.loadData();
  context.openRecordModal();
  get('slotDateInput').value = '2026-10-16'; get('slotStartInput').value = '19:00'; get('slotEndInput').value = '20:59'; get('slotStatusInput').value = 'available';
  context.addDraftSlot();
  assert.match(alerts.at(-1), /2 horas/);
  assert.equal(get('draftSlotsList').children.length, 0);
  get('githubTokenInput').value = 'test-token'; await context.signInAgenda();
  const edit = all(get('mySlotsContainer')).find(n => n.textContent === 'Editar');
  edit.onclick();
  assert.equal(get('slotStartInput').value, '19:00');
  get('slotStartInput').value = '18:00';
  await context.saveSlotEdit();
  assert.equal(writes.length, 1);
  assert.ok(all(get('mySlotsContainer')).some(n => /18:00/.test(n.textContent)));
});
test('A regular member sees only their own slots and no rehearsal-delete control', async () => {
  const { context, get, all, writes } = setup('m1');
  await context.AgendaApp.loadData(); get('githubTokenInput').value = 'test-token'; await context.signInAgenda();
  assert.equal(all(get('mySlotsContainer')).filter(n => n.textContent === 'Editar').length, 1);
  assert.ok(!all(get('confirmedContainer')).some(n => n.textContent === 'Excluir ensaio'));
  const remove = all(get('mySlotsContainer')).find(n => n.textContent === 'Apagar');
  await remove.onclick();
  assert.equal(writes[0].state, 'closed');
  assert.equal(all(get('mySlotsContainer')).filter(n => n.textContent === 'Editar').length, 0);
});

test('Refreshing during a pending save cannot overwrite or erase the saved result', async () => {
  const f = setup(); const { context, get, all } = f;
  await context.AgendaApp.loadData(); get('githubTokenInput').value = 'test-token'; await context.signInAgenda();
  all(get('mySlotsContainer')).find(n => n.textContent === 'Editar').onclick();
  get('slotStartInput').value = '18:00';
  f.delayPatch();
  const saving = context.saveSlotEdit();
  const before = f.issueReads;
  await context.refreshAgenda();
  assert.equal(f.issueReads, before);
  f.releasePatch(); await saving;
  assert.ok(all(get('mySlotsContainer')).some(n => /18:00/.test(n.textContent)));
  assert.deepEqual(f.alerts, []);
});
