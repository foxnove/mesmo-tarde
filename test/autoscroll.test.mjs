import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const code = await readFile('assets/js/autoscroll.js', 'utf8');
function browser({ round = Math.floor, max = 3400 } = {}) {
  const frames = new Map();
  const events = new Map();
  const button = { innerText: '▶', style: {}, setAttribute() {} };
  const status = { innerText: 'Auto-Rolagem' };
  let y = 0, id = 0;
  const document = {
    hidden: false, body: { scrollHeight: max + 600 }, documentElement: { scrollHeight: max + 600, clientHeight: 600 },
    getElementById: name => name === 'btnAutoScroll' ? button : name === 'scrollStatus' ? status : null,
    addEventListener: (name, handler) => events.set(name, handler)
  };
  const context = vm.createContext({ document, innerHeight: 600,
    get scrollY() { return y; },
    scrollTo: (x, top) => { y = Math.max(0, Math.min(max, round(typeof x === 'object' ? x.top : top))); },
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: frame => frames.delete(frame)
  });
  context.window = context;
  vm.runInContext(code, context);
  return { api: context, document, button, status, frames,
    y: () => y,
    emit: (name, event) => events.get(name)?.(event),
    frame: timestamp => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(timestamp)); }
  };
}

for (const fps of [60, 120, 240]) {
  test(`Slow autoscroll advances on an integer-pixel browser at ${fps} Hz`, () => {
    const page = browser();
    page.api.toggleAutoScroll();
    for (let i = 0; i <= fps * 2; i++) page.frame(i * 1000 / fps);
    assert.ok(page.y() >= 30 && page.y() <= 45, `Expected a gentle two-second scroll, got ${page.y()}px`);
    assert.equal(page.status.innerText, 'Rolando...');
  });
}

test('Speed 2x advances at twice the gentle default without depending on rounding', () => {
  const page = browser({ round: Math.round });
  page.api.changeScrollSpeed({ innerText: '' });
  // A cycle may now include a finer 1.5x step; advance to 2x explicitly.
  const speed = { innerText: '' };
  for (let i = 0; i < 6 && speed.innerText !== '2x'; i++) page.api.changeScrollSpeed(speed);
  page.api.toggleAutoScroll();
  for (let i = 0; i <= 120; i++) page.frame(i * 1000 / 60);
  assert.ok(page.y() >= 65 && page.y() <= 80, `Expected gentle 2x, got ${page.y()}px`);
});

test('Half speed is available for long mobile reading and still advances', () => {
  const page = browser();
  const speed = { innerText: '1x' };
  for (let i = 0; i < 6 && speed.innerText !== '0.5x'; i++) page.api.changeScrollSpeed(speed);
  assert.equal(speed.innerText, '0.5x');
  page.api.toggleAutoScroll();
  for (let i = 0; i <= 120; i++) page.frame(i * 1000 / 60);
  assert.ok(page.y() >= 15 && page.y() <= 22);
});

test('Returning after a suspended frame does not jump down the song', () => {
  const page = browser();
  page.api.toggleAutoScroll();
  page.frame(0);
  page.frame(60000);
  assert.ok(page.y() <= 2, `Suspended frame jumped ${page.y()}px`);
});

test('Touching the song pauses; touching speed controls keeps scrolling', () => {
  const page = browser();
  page.api.toggleAutoScroll();
  page.emit('touchstart', { target: { closest: () => ({}) } });
  assert.equal(page.status.innerText, 'Rolando...');
  page.emit('touchstart', { target: { closest: () => null } });
  assert.equal(page.status.innerText, 'Auto-Rolagem');
  assert.equal(page.frames.size, 0);
});

test('Bottom, track changes and hiding the page all stop the loop', () => {
  const page = browser({ max: 12 });
  page.api.toggleAutoScroll();
  for (let i = 0; i <= 120; i++) page.frame(i * 1000 / 60);
  assert.equal(page.y(), 12);
  assert.equal(page.status.innerText, 'Auto-Rolagem');
  assert.equal(page.frames.size, 0);
  page.api.toggleAutoScroll();
  page.api.resetAutoScroll();
  assert.equal(page.frames.size, 0);
  page.api.toggleAutoScroll();
  page.document.hidden = true;
  page.emit('visibilitychange');
  assert.equal(page.status.innerText, 'Auto-Rolagem');
  assert.equal(page.frames.size, 0);
});
