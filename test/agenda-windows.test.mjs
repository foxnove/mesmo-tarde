import test from 'node:test';
import assert from 'node:assert/strict';
import Engine from '../agenda/agenda-engine.js';
const date = '2026-10-14';
function calculate(slots) {
  const members = slots.map((_, i) => ({ github: `m${i}`, name: `M${i}` }));
  const availability = slots.map((list, i) => ({ github: `m${i}`, slots: list.map(s => ({ date, status: 'available', ...s })) }));
  return Engine.calculateIntersectionsForDate(date, members, availability, 5);
}

test('Band example keeps full common windows instead of 30, 60 and 59-minute fragments', () => {
  const windows = calculate([
    [{ startTime: '18:00', endTime: '23:59' }],
    [{ startTime: '19:30', endTime: '22:00' }],
    [{ startTime: '20:00', endTime: '23:00' }]
  ]);
  assert.deepEqual(windows.map(w => [w.startTime, w.endTime, w.durationMinutes, w.availableCount]), [
    ['20:00', '22:00', 120, 3],
    ['20:00', '23:00', 180, 2],
    ['19:30', '22:00', 150, 2],
    ['18:00', '23:59', 359, 1]
  ]);
});

test('Full attendance for only 90 minutes is never suggested, even with longer individual slots', () => {
  const windows = calculate([
    [{ startTime: '18:00', endTime: '21:00' }],
    [{ startTime: '19:30', endTime: '23:00' }]
  ]);
  assert.ok(windows.every(w => w.durationMinutes >= 120));
  assert.ok(windows.every(w => w.availableCount === 1));
  assert.deepEqual(windows.map(w => [w.startTime, w.endTime]), [['19:30','23:00'], ['18:00','21:00']]);
});

test('A brief third-member answer cannot split a valid two-member rehearsal', () => {
  const windows = calculate([
    [{ startTime: '18:00', endTime: '22:00' }],
    [{ startTime: '18:00', endTime: '22:00' }],
    [{ startTime: '19:30', endTime: '20:00' }]
  ]);
  assert.equal(windows.length, 1);
  assert.equal(windows[0].durationMinutes, 240);
  assert.equal(windows[0].availableCount, 2);
});

test('Availability does not bridge an explicit absence or a gap', () => {
  const windows = calculate([
    [{ startTime: '18:00', endTime: '23:00' }, { startTime: '20:00', endTime: '21:00', status: 'unavailable' }],
    [{ startTime: '18:00', endTime: '19:00' }, { startTime: '21:00', endTime: '23:00' }]
  ]);
  assert.ok(windows.every(w => w.durationMinutes >= 120));
  assert.ok(!windows.some(w => w.startMinutes < 1200 && w.endMinutes > 1260 && w.availableMembers.some(m => m.github === 'm0')));
  const shared = windows.find(w => w.availableCount === 2);
  assert.equal(shared.startTime, '21:00'); assert.equal(shared.endTime, '23:00');
});

test('Adjacent slots combine and maybe remains distinct from definite availability', () => {
  const windows = calculate([
    [{ startTime: '18:00', endTime: '20:00' }, { startTime: '20:00', endTime: '22:00' }],
    [{ startTime: '18:00', endTime: '19:00' }, { startTime: '19:00', endTime: '22:00', status: 'maybe' }]
  ]);
  const whole = windows.find(w => w.startTime === '18:00' && w.endTime === '22:00');
  assert.ok(whole); assert.equal(whole.availableCount, 1); assert.equal(whole.maybeCount, 1);
  assert.equal(whole.isIdeal, false);
});
