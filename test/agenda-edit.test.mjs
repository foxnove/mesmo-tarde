import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Engine from '../agenda/agenda-engine.js';
const require = createRequire(import.meta.url);
const Session = (() => { try { return require('../agenda/agenda-github.js'); } catch { return null; } })();
const slot = { date: '2026-10-16', startTime: '19:00', endTime: '21:00', status: 'available' };
const members = [{ github: 'foxnove' }, { github: 'danrdfig-tech' }];
function fixture(login = 'danrdfig-tech', author = login, labels = ['disponibilidade']) {
  const issue = { number: 10, title: 'Disponibilidade - outubro', state: 'open', user: { login: author }, labels,
    body: '```json\n' + JSON.stringify([slot, { ...slot, date: '2026-10-30' }]) + '\n```', updated_at: '2026-10-13T12:00:00Z' };
  const writes = [];
  const fetcher = async (url, options = {}) => {
    if (options.method === 'PATCH') { writes.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ ...issue, ...writes.at(-1) }) }; }
    return { ok: true, json: async () => url.endsWith('/user') ? { login } : issue };
  };
  return { issue, writes, fetcher };
}
test('Available and maybe slots require two hours; absence may be shorter', () => {
  assert.equal(Engine.isRehearsalSlot({ ...slot, endTime: '20:59' }), false);
  assert.equal(Engine.isRehearsalSlot(slot), true);
  assert.equal(Engine.isRehearsalSlot({ ...slot, status: 'maybe', endTime: '20:00' }), false);
  assert.equal(Engine.isRehearsalSlot({ ...slot, status: 'unavailable', endTime: '20:00' }), true);
});
test('A five-member overlap shorter than two hours never gets the perfect marker', () => {
  const band = Array.from({ length: 5 }, (_, i) => ({ github: `m${i}` }));
  const result = Engine.calculateIntersectionsForDate(slot.date, band, band.map(m => ({ github: m.github, slots: [{ ...slot, endTime: '20:59' }] })), 5);
  assert.equal(result[0].isIdeal, false);
  assert.equal(result[0].tooShort, true);
});
test('Editing one slot preserves the other dates in the issue', async () => {
  assert.ok(Session, 'GitHub agenda session must exist');
  const f = fixture(); const session = new Session(f.fetcher);
  await session.login('test-token', members);
  await session.updateSlot(f.issue, 0, { ...slot, startTime: '18:00' });
  const saved = Engine.parseAvailabilityIssueBody(f.writes[0].body);
  assert.equal(saved[0].startTime, '18:00'); assert.equal(saved[1].date, '2026-10-30');
});
test('Removing one slot preserves the other; removing the last closes the issue', async () => {
  assert.ok(Session); const f = fixture(); const session = new Session(f.fetcher);
  await session.login('test-token', members);
  await session.updateSlot(f.issue, 0, null);
  assert.equal(Engine.parseAvailabilityIssueBody(f.writes[0].body).length, 1);
  f.issue.body = f.writes[0].body;
  await session.updateSlot(f.issue, 0, null);
  assert.equal(f.writes[1].state, 'closed');
});
test('Admin can edit another member availability while preserving other dates', async () => {
  assert.ok(Session); const f = fixture('foxnove', 'danrdfig-tech'); const session = new Session(f.fetcher);
  await session.login('test-token', members);
  await session.updateSlot(f.issue, 0, { ...slot, startTime: '18:00' });
  const slots = Engine.parseAvailabilityIssueBody(f.writes[0].body);
  assert.equal(slots[0].startTime, '18:00');
  assert.equal(slots[1].date, '2026-10-30');
});

test('A regular member cannot edit another member availability', async () => {
  const f = fixture('danrdfig-tech', 'foxnove'); const session = new Session(f.fetcher);
  await session.login('test-token', members);
  await assert.rejects(session.updateSlot(f.issue, 0, slot), /próprios/);
  assert.equal(f.writes.length, 0);
});

test('Admin editing permission does not allow deleting other member slots or editing strangers', async () => {
  const f = fixture('foxnove', 'danrdfig-tech'); const session = new Session(f.fetcher);
  await session.login('test-token', members);
  await assert.rejects(session.updateSlot(f.issue, 0, null), /próprios/);
  f.issue.user.login = 'stranger';
  await assert.rejects(session.updateSlot(f.issue, 0, slot), /próprios/);
  assert.equal(f.writes.length, 0);
});
test('Only foxnove may remove an admin-authored confirmed rehearsal', async () => {
  assert.ok(Session); const f = fixture('danrdfig-tech', 'foxnove', ['ensaio-confirmado']); const session = new Session(f.fetcher);
  await session.login('test-token', members);
  await assert.rejects(session.deleteRehearsal(f.issue), /administrador/);
  assert.equal(f.writes.length, 0);
  const admin = fixture('foxnove', 'foxnove', ['ensaio-confirmado']); const adminSession = new Session(admin.fetcher);
  await adminSession.login('test-token', members); await adminSession.deleteRehearsal(admin.issue);
  assert.equal(admin.writes[0].state, 'closed');
});
test('Stale edits and too-short edits do not write to GitHub', async () => {
  assert.ok(Session); const f = fixture(); const session = new Session(f.fetcher);
  await session.login('test-token', members);
  await assert.rejects(session.updateSlot(f.issue, 0, { ...slot, endTime: '20:00' }), /2 horas/);
  await assert.rejects(session.updateSlot({ ...f.issue, body: 'outdated' }, 0, slot), /alterado/);
  assert.equal(f.writes.length, 0);
});
test('Unknown users cannot sign in; signing out revokes writes', async () => {
  assert.ok(Session); const f = fixture('stranger'); const session = new Session(f.fetcher);
  await assert.rejects(session.login('test-token', members), /integrante/);
  const own = fixture(); const ownSession = new Session(own.fetcher);
  await ownSession.login('test-token', members); ownSession.logout();
  await assert.rejects(ownSession.updateSlot(own.issue, 0, slot), /Entre/);
  assert.equal(own.writes.length, 0);
});
