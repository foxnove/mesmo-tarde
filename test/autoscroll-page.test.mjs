import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getChromePath, CHROME_FLAGS } from './get-chrome.mjs';

const run = promisify(execFile);
const root = process.cwd();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const harness = `<script>
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  const frames = new Map(); let id = 0;
  window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  window.cancelAnimationFrame = frame => frames.delete(frame);
  resetAutoScroll(); window.scrollTo(0, 0); toggleAutoScroll();
  for (let i = 0; i <= 120; i++) {
    const pending = [...frames.values()]; frames.clear();
    pending.forEach(callback => callback(i * 1000 / 60));
  }
  document.body.dataset.testScroll = window.scrollY;
  const play = document.getElementById('btnAutoScroll').getBoundingClientRect();
  const speed = document.querySelector('.speed-btn').getBoundingClientRect();
  document.body.dataset.testTouch = Math.min(play.width, play.height, speed.width, speed.height);
  resetAutoScroll();
}, 50));
</script>`;

test('The real page advances at 1x and exposes touch targets in a phone-sized browser viewport', async () => {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    try {
      let content = await readFile(file);
      if (pathname === '/') content = Buffer.from(content.toString().replace('</body>', harness + '</body>'));
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { stdout } = await run(getChromePath(), [...CHROME_FLAGS, '--window-size=390,844', '--force-device-scale-factor=3', `http://127.0.0.1:${server.address().port}/`]);
    const position = Number(stdout.match(/data-test-scroll="([\d.]+)"/)?.[1]);
    const target = Number(stdout.match(/data-test-touch="([\d.]+)"/)?.[1]);
    assert.ok(position >= 30 && position <= 45, `Phone-sized browser scrolled ${position}px`);
    assert.ok(target >= 44, `Touch targets are only ${target}px`);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
