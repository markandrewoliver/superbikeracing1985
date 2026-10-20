// Drive the original page and the split build with the same seed, clock and key presses; compare canvas pixels.
import { chromium } from '@playwright/test';
import crypto from 'node:crypto';
const BASE = process.argv[2] || 'http://localhost:5199';
const W = +(process.env.VW || 390), H = +(process.env.VH || 844);
const init = () => {
  let s = 12345;
  Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__rafQ = []; window.requestAnimationFrame = (cb) => { window.__rafQ.push(cb); return 1; };
  window.__step = (ts) => { const q = window.__rafQ; window.__rafQ = []; q.forEach((cb) => cb(ts)); };
};
// scenario: [frame, action] — action is 'down:Key', 'up:Key' or 'tap:Key'
const SCEN = {
  race: [[200, 'tap:Enter'], [230, 'tap:Enter'], [260, 'tap:ArrowDown'], [270, 'tap:ArrowDown'], [280, 'tap:Enter'],
    [700, 'down:ArrowRight'], [900, 'up:ArrowRight'], [950, 'tap:ArrowUp'], [1000, 'down:ArrowRight'], [1300, 'up:ArrowRight'], [1320, 'tap:ArrowDown'], [1400, 'down:ArrowLeft'], [1500, 'up:ArrowLeft'], [1600, 'down:ArrowUp'], [1700, 'up:ArrowUp']],
  attract: [],
  stunt: [[200, 'tap:Enter'], [230, 'tap:Enter'], [250, 'tap:ArrowLeft'], [260, 'tap:ArrowDown'], [270, 'tap:ArrowDown'], [280, 'tap:Enter'],
    [500, 'down:ArrowUp'], [560, 'up:ArrowUp'], [700, 'down:ArrowDown'], [760, 'up:ArrowDown'], [900, 'down:ArrowRight'], [1000, 'up:ArrowRight']],
  finish: [[200, 'tap:Enter'], [230, 'tap:Enter'], [260, 'tap:ArrowDown'], [270, 'tap:ArrowDown'], [280, 'tap:Enter'],
    [600, 'eval:window.__scramble.bike.x = window.__scramble.finishX() - 400'], [610, 'down:ArrowRight'], [900, 'up:ArrowRight'],
    [1100, 'tap:ArrowDown'], [1120, 'tap:Enter'], [1400, 'down:ArrowRight'], [1600, 'up:ArrowRight']],
  tutorial: [[200, 'tap:Enter'], [220, 'tap:ArrowUp'], [240, 'tap:Enter'], [600, 'tap:Enter'], [700, 'tap:ArrowUp'], [800, 'down:ArrowRight'], [1000, 'up:ArrowRight'], [1100, 'tap:Enter']],
  builder: [[200, 'tap:Enter'], [220, 'tap:ArrowDown'], [240, 'tap:Enter'], [300, 'tap:Enter'], [360, 'tap:ArrowDown'], [380, 'tap:ArrowDown'], [400, 'tap:ArrowDown'], [420, 'tap:ArrowDown'], [440, 'tap:Enter'], [600, 'tap:ArrowRight'], [700, 'tap:Enter']],
  player: [[200, 'tap:Enter'], [220, 'tap:ArrowDown'], [230, 'tap:ArrowDown'], [240, 'tap:Enter'], [300, 'tap:ArrowRight'], [320, 'tap:ArrowDown'], [340, 'tap:ArrowRight']],
};
const which = process.argv[3] || 'race', N = +(process.argv[4] || 1800);
async function run(browser, url) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(init);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  const acts = new Map(); for (const [f, a] of SCEN[which]) (acts.get(f) || acts.set(f, []).get(f)).push(a);
  const out = [];
  for (let f = 0; f < N; f++) {
    for (const a of acts.get(f) || []) { const [k, ...rest] = a.split(':'); const key = rest.join(':'); if (k === 'eval') await page.evaluate(key); else if (k === 'down') await page.keyboard.down(key); else if (k === 'up') await page.keyboard.up(key); else await page.keyboard.press(key); }
    await page.evaluate((ts) => window.__step(ts), 1000 + f * (1000 / 60));
    if (f % 20 === 19) {
      const d = await page.evaluate(() => { const c = document.getElementById('game'); const s = window.__scramble; return { url: c.toDataURL(), st: s.getState(), x: Math.round(s.bike.x * 100), h: c.height }; });
      out.push({ f, hash: crypto.createHash('sha1').update(d.url).digest('hex').slice(0, 10), st: d.st, x: d.x, h: d.h, url: d.url });
    }
  }
  await page.close();
  return { out, errors };
}
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const a = await run(browser, BASE + '/original.html');
const b = await run(browser, BASE + '/index.html');
await browser.close();
let diff = 0, firstDiff = null;
for (let i = 0; i < a.out.length; i++) { const p = a.out[i], q = b.out[i]; if (p.hash !== q.hash || p.st !== q.st || p.x !== q.x) { diff++; if (!firstDiff) firstDiff = [p, q]; } }
console.log(`${which}: ${a.out.length} samples, ${diff} differ; states seen: ${[...new Set(a.out.map((o) => o.st))].join(',')}`);
if (a.errors.length || b.errors.length) console.log('errors original:', a.errors.slice(0, 5), '\nerrors split:', b.errors.slice(0, 5));
if (firstDiff) {
  const [p, q] = firstDiff; console.log('first diff at frame', p.f, { st: [p.st, q.st], x: [p.x, q.x], h: [p.h, q.h] });
  const fs = await import('node:fs'); fs.writeFileSync((process.env.OUTDIR || '.') + '/a.png', Buffer.from(p.url.split(',')[1], 'base64')); fs.writeFileSync((process.env.OUTDIR || '.') + '/b.png', Buffer.from(q.url.split(',')[1], 'base64'));
}
process.exit(diff || a.errors.length || b.errors.length ? 1 : 0);
