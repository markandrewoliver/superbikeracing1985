// The podium after the finish.

import { FRONT_HEADS } from '../art/podium.js';
import { KTHEMES } from '../art/riders.js';
import { EXTRA, ctx } from '../core/canvas.js';
import { H, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, race, view } from '../core/state.js';
import { hash } from '../core/util.js';
import { rect, text } from '../gfx/pixel.js';
import { kCol } from '../gfx/riderSprites.js';
import { SURF_PAL } from '../gfx/road.js';
import { CROWD, lit } from '../gfx/scenery.js';
import { playerPlace } from '../race/finish.js';
import { fmtTime, ordinal } from '../race/play.js';
import { LOOK_HEADS, look } from '../race/playerLook.js';
import { THEME_SUIT, bots } from '../race/rivals.js';
import { finishX, kph } from '../race/session.js';
import { drawResMenu } from './overlay.js';

// THE PODIUM: two seconds after the line, the top three on a podium, facing us, with their final times (anyone
// still racing gets an estimate from their average speed so far). The winner does a random celebration, second place
// a slow clap, third (and fourth, beside the podium) stands with arms crossed. Front-facing heads, in people letters.
export const POD_PAL = { q: '#00a800', Q: '#006800' };
function podLine(x0, y0, x1, y1) {
  const pts = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { pts.push([x0, y0]); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  return pts;
}
// one frame of a figure: a map of 'x,y' -> palette letter; origin = top left of the body (9 wide), the head above it
export function podFigure(anim, t, head) {
  const g = new Map(), put = (x, y, c) => g.set(x + ',' + y, c), hd = FRONT_HEADS[head] || FRONT_HEADS.helmet, hh = hd.length;
  const body = (ox, oy, legs) => {
    ['.ssSSSss.', '.sssssss.', '.SsssssS.', '.sssssss.', '.sSSSSSs.', '.PpPpPpP.'].forEach((r, y) => { for (let x = 0; x < 9; x++) if (r[x] !== '.') put(ox + x, oy + y, r[x]); });
    const L = { stand: [[[2, 6], [2, 7], [2, 8]], [[6, 6], [6, 7], [6, 8]]], kneeL: [[[2, 6], [1, 7]], [[6, 6], [6, 7], [6, 8]]], kneeR: [[[2, 6], [2, 7], [2, 8]], [[6, 6], [7, 7]]],
      tapR: [[[2, 6], [2, 7], [2, 8]], [[6, 6], [6, 7], [6, 7]]], wide: [[[2, 6], [1, 7], [1, 8]], [[6, 6], [7, 7], [7, 8]]] }[legs];
    for (const leg of L) { for (const [x, y] of leg) { put(ox + x, oy + y, 'p'); put(ox + x + 1, oy + y, 'p'); } const [x, y] = leg[leg.length - 1]; put(ox + x, oy + y + 1, 'd'); put(ox + x + 1, oy + y + 1, 'd'); }
  };
  const drawHead = (ox, oy, dx, dy) => hd.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') put(ox + x + (dx || 0), oy - hh + y + (dy || 0), r[x]); });
  const arm = (ox, oy, side, el, hand) => {                       // (elbow and hand given for the arm on the left; the right one mirrors it)
    const m = side < 0 ? (p) => p : (p) => [8 - p[0], p[1]], s0 = side < 0 ? [0, 1] : [8, 1], e = m(el), h = m(hand);
    const pts = podLine(s0[0], s0[1], e[0], e[1]).concat(podLine(e[0], e[1], h[0], h[1]).slice(1));
    pts.forEach(([x, y], k) => put(ox + x, oy + y, k === 0 ? 's' : k === 1 ? 'S' : 'i'));
  };
  const sprite = (ox, oy, rows) => rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') put(ox + x, oy + y, r[x]); });
  if (anim === 'hands') { const up = t % 2, d = up ? -1 : 0; body(0, d, 'stand'); drawHead(0, d); for (const s of [-1, 1]) arm(0, d, s, [-1, -1], [-2, -hh - 1 + (up ? 0 : 1)]); }
  else if (anim === 'trophy') { const ph = [0, 1, 2, 1][t % 4], hy = -hh - 1 - ph; body(0, 0, 'stand'); drawHead(0, 0); for (const s of [-1, 1]) arm(0, 0, s, [-2, -2], [0, hy - 3]);
    sprite(1, hy - 6, ['ooooooo', 'o.ooo.o', '.ooooo.', '..ooo..', '...o...', '..mmm..', '.mmmmm.']); }
  else if (anim === 'champagne') { const k = t % 8, sh = [0, 1, 0, 1, 0, 0, 0, 0][k]; body(0, 0, 'wide'); drawHead(0, 0);
    arm(0, 0, -1, [0, 3], [6, 2 - sh]); arm(0, 0, 1, [0, 3], [1, 1 - sh]);
    const bx = 7, by = 2 - sh;
    for (const [x, y, c] of [[0, 0, 'Q'], [1, -1, 'q'], [1, 0, 'Q'], [2, -2, 'q'], [2, -1, 'q'], [3, -3, 'q'], [3, -2, 'Q'], [4, -4, k < 4 ? 'c' : 'q']]) put(bx + x, by + y, c);
    if (k === 4) put(bx + 6, by - 7, 'm');
    if (k >= 4) { const n = k - 4; for (let j = 0; j < 4 + 3 * n; j++) for (const w of [-1, 0, 1]) { if ((j + w) % 2 && j < 3) continue; put(bx + 4 + j, by - 4 - j + Math.floor(j * j * 0.09) + w * Math.floor(j / 2), (j + w + t) % 3 ? 'c' : 'a'); } } }
  else if (anim === 'dance') { const ph = t % 4, sx = [0, 1, 0, -1][ph], dy = [0, -1, 0, -1][ph]; body(sx, dy, ['stand', 'kneeR', 'stand', 'kneeL'][ph]); drawHead(sx, dy);
    const a = ph < 2 ? -1 : 1; arm(sx, dy, a, [-1, 0], [-3, -hh]); arm(sx, dy, -a, [-1, 2], [0, 4]); }
  else if (anim === 'jump') { const dy = [0, -2, -4, -4, -2, 0][t % 6]; body(0, dy, dy < 0 ? 'wide' : 'stand'); drawHead(0, dy);
    arm(0, dy, -1, [-1, 0], dy < -2 ? [-1, -2] : [-1, -1]); arm(0, dy, 1, [-1, -1], dy < 0 ? [-2, -hh - 1] : [-1, -2]); }
  else if (anim === 'crossed') { body(0, 0, t % 4 === 1 || t % 4 === 3 ? 'tapR' : 'stand'); drawHead(0, 0);
    for (const [x, y, c] of [[0, 1, 's'], [0, 2, 's'], [0, 3, 'S'], [1, 3, 'j'], [2, 3, 'j'], [3, 3, 'j'], [4, 3, 'j'], [5, 3, 'j'], [6, 3, 'j'], [7, 3, 'j'], [8, 1, 's'], [8, 2, 'S'], [7, 2, 'i'], [6, 2, 'i'], [5, 2, 'i'], [4, 2, 'i'], [3, 2, 'i'], [2, 2, 'i'], [1, 2, 'i']]) put(x, y, c); }
  else if (anim === 'stand') { body(0, 0, 'stand'); drawHead(0, 0); for (const s of [-1, 1]) arm(0, 0, s, [0, 3], [0, 5]); }
  else { body(0, 0, 'stand'); drawHead(0, 0); const hand = t % 4 < 2 ? [3, 3] : [2, 4]; arm(0, 0, -1, [0, 3], hand); arm(0, 0, 1, [0, 3], hand); }   // the slow clap
  return g;
}
const POD_WIN = [['hands', 3], ['trophy', 4], ['champagne', 6], ['dance', 5], ['jump', 8]];
export function startPodium() {                                           // everyone's final time (an estimate for anyone not home yet), best first
  for (const o of bots) if (!o.done) { const avg = Math.max(20, (o.x - race.startX) / Math.max(0.1, race.raceT)); o.done = race.raceT + Math.max(0, finishX() - o.x) / avg; }
  const myHead = LOOK_HEADS[look.head];
  const all = [{ name: 'YOU', th: 0, head: myHead, t: race.finishT, col: P.white }].concat(bots.map(o => ({ name: o.name, th: o.theme, head: o.theme === 0 ? myHead : (KTHEMES[o.theme].head || 'helmet'), t: o.done, col: THEME_SUIT[o.theme] })));
  all.sort((a, b) => a.t - b.t);
  race.podium = { all, win: POD_WIN[Math.floor(Math.random() * POD_WIN.length)], cx: view.camX };
}
export function drawPodium() {
  const tall = EXTRA >= 100, sec = game.stateT - 2, place = playerPlace(), pal = SURF_PAL[race.trk.base] || SURF_PAL.asphalt;
  const hz = tall ? -50 : 49;                                      // where the barrier sits (the ground runs from just below it)
  if (race.trk.crowd) {                                                 // the stands, on their feet
    const y0 = tall ? -74 : 22;
    for (let r = 0; r < 3; r++) for (let k = -1; k < W / 6 + 1; k++) {
      const h1 = hash(k * 13 + r * 97), x = k * 6 + (r & 1) * 3, y = y0 + r * 7, col = CROWD[Math.floor(h1 * CROWD.length)];
      const up = Math.sin(game.tNow * (4 + h1 * 5) + k * 1.7 + r) > 0, hop = up && h1 > 0.6 ? 1 : 0;
      rect(x + 1, y - hop, 2, 2, h1 > 0.3 ? P.cream : '#a86030'); rect(x, y + 2 - hop, 4, 3, col);
      if (up) { rect(x - 1, y - 2 - hop, 1, 3, P.cream); rect(x + 4, y - 2 - hop, 1, 3, P.cream); }
    }
  }
  const G = tall ? 10 : 84;
  { const tt = place === 1 ? 'YOU WIN!' : ordinal(place) + ' PLACE', ty = tall ? -EXTRA + 8 : 3;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [2, 2]]) text(tt, W / 2 + dx, ty + dy, P.black, 2, 'center');
    text(tt, W / 2, ty, place === 1 ? P.turbo : P.white, 2, 'center'); }
  const spots = [{ cx: 120, h: 20, top: '#ffd83d', face: '#dc9c24' }, { cx: 68, h: 14, top: '#d8d8e0', face: '#9898a8' }, { cx: 172, h: 10, top: '#e09060', face: '#a86030' }];
  rect(30, G, 180, 2, 'rgba(0,0,0,0.35)');
  race.podium.all.forEach((r, i) => {
    const s = spots[i]; if (!s) return;
    rect(s.cx - 26, G - s.h, 52, s.h, s.face); rect(s.cx - 26, G - s.h, 52, 2, s.top);
    const [anim, fps] = i === 0 ? race.podium.win : i === 1 ? ['clap', 2] : ['crossed', 3];
    const fig = podFigure(anim, Math.floor(sec * fps), r.head), ox = s.cx - 9, oy = G - s.h - 20;
    for (const [key, c] of fig) { const [x, y] = key.split(',').map(Number); rect(ox + x * 2, oy + y * 2, 2, 2, POD_PAL[c] || kCol(c, r.th)); }
    if (r.head === 'skull' && lit()) {                             // the flaming skull glows on the podium too, after dark
      let n = 0, mx = 0, my = 0; for (const [key, c] of fig) { const [x, y] = key.split(',').map(Number); if (y < 0 && (c === 'f' || c === 'h')) { mx += x; my += y; n++; } }
      if (n) {
        const fx = ox + mx / n * 2 + 1, fy = oy + my / n * 2 + 1, fc = kCol('f', r.th), R = 16 + Math.sin(game.tNow * 19) * 2;
        const q = [parseInt(fc.slice(1, 3), 16), parseInt(fc.slice(3, 5), 16), parseInt(fc.slice(5, 7), 16)].join(',');
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, R); gr.addColorStop(0, 'rgba(' + q + ',0.55)'); gr.addColorStop(1, 'rgba(' + q + ',0)');
        ctx.fillStyle = gr; ctx.fillRect(fx - R, fy - R, R * 2, R * 2); ctx.globalCompositeOperation = 'source-over';
      }
    }
  });
  // the times, by place
  const L0 = G + 3;
  ctx.globalAlpha = 0.8; rect(0, L0, W, H - L0 + 10, P.black); ctx.globalAlpha = 1; rect(0, L0, W, 1, P.turbo);
  race.podium.all.forEach((r, i) => {
    const col2 = !tall, x0 = col2 ? (i & 1 ? 128 : 8) : 56, y = col2 ? L0 + 4 + (i >> 1) * 9 : L0 + 5 + i * 10;
    if (r.name === 'YOU') rect(x0 - 3, y - 2, col2 ? 108 : 132, 10, '#2c2c2c');
    text(ordinal(i + 1), x0, y, i === 0 ? P.turbo : P.muted); text(r.name, x0 + 26, y, r.col); text(fmtTime(r.t), x0 + (col2 ? 104 : 128), y, P.white, 1, 'right');
  });
  if (tall) { text('TOP SPEED ' + kph(race.topSpeed) + ' KPH   WIPEOUTS ' + race.crashes, W / 2, L0 + 48, P.muted, 1, 'center'); text('BEST TIME ' + fmtTime(race.best), W / 2, L0 + 58, P.turbo, 1, 'center'); }
  drawResMenu();
}
