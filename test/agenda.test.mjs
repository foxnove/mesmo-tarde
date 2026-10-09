import assert from 'node:assert/strict';
import test from 'node:test';
import AgendaEngine from '../agenda/agenda-engine.js';

const diego = { github: 'foxnove', name: 'Diego Fox', instrument: 'Voz / Violão', active: true };
function responseIssue(number, date, author = 'foxnove') {
  return { number, title: `Disponibilidade - ${date}`, state: 'open', labels: [],
    user: { login: author }, updated_at: `2026-10-09T18:0${number}:00Z`,
    html_url: `https://github.com/foxnove/mesmo-tarde/issues/${number}`,
    body: '```json\n' + JSON.stringify([{ date, startTime: '19:00', endTime: '22:00', status: 'available', note: '' }]) + '\n```' };
}

test('Both real unlabelled responses survive consolidation; strangers and PRs are ignored', () => {
  assert.equal(typeof AgendaEngine.buildAgendaData, 'function');
  const data = AgendaEngine.buildAgendaData([diego], [responseIssue(1, '2026-10-16'),
    responseIssue(2, '2026-10-30'), responseIssue(3, '2026-10-31', 'stranger'),
    { ...responseIssue(4, '2026-11-01'), pull_request: {} }], 5);
  assert.equal(data.availability.length, 1);
  assert.deepEqual(data.availability[0].slots.map(s => s.date), ['2026-10-16', '2026-10-30']);
  assert.deepEqual(data.confirmedRehearsals, []);
});

test('An empty real issue collection clears the agenda rather than preserving example data', () => {
  assert.equal(typeof AgendaEngine.buildAgendaData, 'function');
  const data = AgendaEngine.buildAgendaData([diego], [], 5);
  assert.deepEqual(data.availability, []);
  assert.deepEqual(data.members, []);
});

test('One response cannot become ideal while the other four have not answered', () => {
  const windows = AgendaEngine.calculateIntersectionsForDate('2026-10-16', [diego],
    [{ github: 'foxnove', slots: [{ date: '2026-10-16', startTime: '19:00', endTime: '22:00', status: 'available' }] }], 5);
  assert.equal(windows[0].isIdeal, false);
  assert.equal(windows[0].totalActiveMembers, 5);
  assert.equal(windows[0].percent, 20);
});

test('Missing responses are distinct from explicit unavailability', () => {
  const windows = AgendaEngine.calculateIntersectionsForDate('2026-10-16', [diego, { github: 'm2', name: 'M2' }],
    [{ github: 'foxnove', slots: [{ date: '2026-10-16', startTime: '19:00', endTime: '22:00', status: 'available' }] }]);
  assert.deepEqual(windows[0].unavailableMembers, []);
  assert.equal(windows[0].missingMembers[0].github, 'm2');
});

test('Invalid dates, times and statuses cannot create availability', () => {
  const body = '```json\n' + JSON.stringify([
    { date: '2026-02-30', startTime: '19:00', endTime: '22:00', status: 'available' },
    { date: '2026-10-16', startTime: '25:00', endTime: '26:00', status: 'available' },
    { date: '2026-10-16', startTime: '19:00', endTime: '22:00', status: 'bogus' }
  ]) + '\n```';
  assert.deepEqual(AgendaEngine.parseAvailabilityIssueBody(body), []);
});

test('Five actual available musicians get a two-hour ideal window', () => {
  const members = Array.from({ length: 5 }, (_, i) => ({ github: `m${i}`, name: `M${i}` }));
  const availability = members.map(m => ({ github: m.github, slots: [
    { date: '2026-10-16', startTime: '20:00', endTime: '22:00', status: 'available' },
    { date: '2026-10-30', startTime: '19:00', endTime: '23:00', status: 'available' }
  ] }));
  const best = AgendaEngine.calculateIntersectionsForDate('2026-10-16', members, availability, 5)[0];
  assert.equal(best.isIdeal, true);
  assert.equal(best.durationMinutes, 120);
  assert.equal(best.availableCount, 5);
});

test('Interval intersection algorithm matches prompt specification', () => {
  const members = [
    { github: 'foxnove', name: 'Diego', instrument: 'Voz / Violão', active: true },
    { github: 'baixo-fox', name: 'Baixo', instrument: 'Baixo', active: true },
    { github: 'batera-fox', name: 'Bateria', instrument: 'Bateria', active: true }
  ];

  const availability = [
    {
      github: 'foxnove',
      slots: [{ date: '2026-10-16', startTime: '18:00', endTime: '23:00', status: 'available' }]
    },
    {
      github: 'baixo-fox',
      slots: [{ date: '2026-10-16', startTime: '19:30', endTime: '22:00', status: 'available' }]
    },
    {
      github: 'batera-fox',
      slots: [{ date: '2026-10-16', startTime: '20:00', endTime: '21:30', status: 'available' }]
    }
  ];

  const intersections = AgendaEngine.calculateIntersectionsForDate('2026-10-16', members, availability);
  assert.ok(intersections.length > 0);

  // The top / ideal window should be 20:00 to 21:30 with all 3 musicians
  const best = intersections[0];
  assert.equal(best.startTime, '20:00');
  assert.equal(best.endTime, '21:30');
  assert.equal(best.availableCount, 3);
  assert.equal(best.totalActiveMembers, 3);
  assert.equal(best.percent, 100);
  assert.equal(best.isIdeal, true);
});

test('Interval calculation handles partial overlaps and maybe status', () => {
  const members = [
    { github: 'm1', name: 'Músico 1', active: true },
    { github: 'm2', name: 'Músico 2', active: true }
  ];

  const availability = [
    {
      github: 'm1',
      slots: [{ date: '2026-10-17', startTime: '14:00', endTime: '18:00', status: 'available' }]
    },
    {
      github: 'm2',
      slots: [{ date: '2026-10-17', startTime: '16:00', endTime: '20:00', status: 'maybe' }]
    }
  ];

  const intersections = AgendaEngine.calculateIntersectionsForDate('2026-10-17', members, availability);
  const overlap = intersections.find(i => i.startTime === '16:00' && i.endTime === '18:00');
  assert.ok(overlap);
  assert.equal(overlap.availableCount, 1);
  assert.equal(overlap.maybeCount, 1);
  assert.equal(overlap.isIdeal, false);
});

test('Issue body parser extracts slots accurately from JSON block or markdown lines', () => {
  const markdownBody = `
### Minha disponibilidade:
\`\`\`json
[
  { "date": "2026-10-20", "startTime": "19:00", "endTime": "22:00", "status": "available", "note": "Ok" }
]
\`\`\`
  `;
  const slots = AgendaEngine.parseAvailabilityIssueBody(markdownBody);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].date, '2026-10-20');
  assert.equal(slots[0].startTime, '19:00');
  assert.equal(slots[0].endTime, '22:00');
  assert.equal(slots[0].status, 'available');
});

test('Confirmed rehearsal parser extracts rehearsal details', () => {
  const body = `
### Ensaio Confirmado
- Data: 2026-10-25
- Horário: 20:00 - 22:30
- Local: Estúdio Central
- Observações: Passagem das faixas 1 a 6
  `;
  const result = AgendaEngine.parseConfirmedRehearsalBody(body, 'foxnove', 10, 'https://github.com/foxnove/mesmo-tarde/issues/10');
  assert.ok(result);
  assert.equal(result.date, '2026-10-25');
  assert.equal(result.startTime, '20:00');
  assert.equal(result.endTime, '22:30');
  assert.equal(result.location, 'Estúdio Central');
  assert.equal(result.author, 'foxnove');
});
