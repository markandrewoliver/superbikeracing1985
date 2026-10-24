// The podium after the finish.

import { FRONT_HEADS } from '../art/podium.js';
import { KTHEMES } from '../art/riders.js';
import { EXTRA, ctx } from '../core/canvas.js';
import { H, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, race, view } from '../core/state.js';
import { hash } from '../core/util.js';
import { rect, rotSprite, text } from '../gfx/pixel.js';
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
// Each racer wears that race's wipeouts (Super Bike Workshop, section 3): podLevel() of them, 0 fine, 1 an arm in a
// cast and sling, 2 a leg in a cast on one crutch, 3 both, 4 an arm and both legs, in a wheelchair.
// POD_PAL: the podium's own fixed colours (champagne bottle, casts W/w, sling L, crutch K/k, wheelchair V, tyre Y/y).
export const POD_PAL = { q: '#00a800', Q: '#006800', W: '#f4f2ea', w: '#c4c2b8', L: '#d8c8a0', K: '#b4bcc8', k: '#3c3c48', V: '#7c8490', Y: '#24242c', y: '#a4acb8' };
export const podLevel = (wipeouts) => Math.min(4, wipeouts || 0);
function podLine(x0, y0, x1, y1) {
  const pts = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { pts.push([x0, y0]); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  return pts;
}
const TROPHY = ['ooooooo', 'o.ooo.o', '.ooooo.', '..ooo..', '...o...', '..mmm..', '.mmmmm.'];
// What each celebration does: where the body is, the legs, and each arm's elbow and hand (given for the arm on our
// left; the other mirrors it). hh: the head's height, which the raised hands clear.
function podSpec(anim, t, hh) {
  if (anim === 'hands') { const up = t % 2; return { dy: up ? -1 : 0, legs: 'stand', arms: { L: [[-1, -1], [-2, -hh - 1 + (up ? 0 : 1)]], R: [[-1, -1], [-2, -hh - 1 + (up ? 0 : 1)]] } }; }
  if (anim === 'trophy') { const ph = [0, 1, 1, 0][t % 4]; return { dy: 0, legs: 'stand', arms: { L: [[-1, -1], [2, -4 - ph]], R: [[-1, -1], [2, -4 - ph]] }, trophy: true, bob: ph }; }   // held up by its base, just over his head
  if (anim === 'champagne') { const k = t % 8, sh = [0, 1, 0, 1, 0, 0, 0, 0][k]; return { dy: 0, legs: 'wide', arms: { L: [[0, 3], [6, 2 - sh]], R: [[0, 3], [1, 1 - sh]] }, bottle: { k, sh, t } }; }
  if (anim === 'dance') { const ph = t % 4, a = ph < 2 ? -1 : 1, up = [[-1, 0], [-3, -hh]], down = [[-1, 2], [0, 4]];
    return { dx: [0, 1, 0, -1][ph], dy: [0, -1, 0, -1][ph], legs: ['stand', 'kneeR', 'stand', 'kneeL'][ph], arms: { L: a < 0 ? up : down, R: a > 0 ? up : down }, rock: [0, 1, 0, -1][ph] }; }
  if (anim === 'jump') { const dy = [0, -2, -4, -4, -2, 0][t % 6]; return { dy, legs: dy < 0 ? 'wide' : 'stand', arms: { L: [[-1, -2], [-2, -5]], R: [[-1, -2], [-2, -5]] }, air: dy }; }   // both arms straight up the whole time
  if (anim === 'stand') return { dy: 0, legs: 'stand', arms: { L: [[0, 3], [0, 5]], R: [[0, 3], [0, 5]] } };   // (EDIT PLAYER)
  if (anim === 'crossed') return { dy: 0, legs: t % 4 === 1 || t % 4 === 3 ? 'tapR' : 'stand', crossed: true };
  const hand = t % 4 < 2 ? [3, 3] : [2, 4]; return { dy: 0, legs: 'stand', arms: { L: [[0, 3], hand], R: [[0, 3], hand] }, clap: t % 4 < 2 };   // the slow clap
}
// One frame of a figure: a map of 'x,y' -> palette letter; origin = top left of the body (9 wide), the head above it.
export function podFigure(anim, t, head, lvl = 0) {
  const g = new Map(), put = (x, y, c) => g.set(x + ',' + y, c), hd = FRONT_HEADS[head] || FRONT_HEADS.helmet, hh = hd.length, S = podSpec(anim, t, hh);
  const sling = lvl === 1 || lvl === 3 || lvl === 4, crutch = lvl === 2 || lvl === 3, chair = lvl >= 4;
  let ox = S.dx || 0, oy = S.dy || 0;
  const lift = chair ? (Math.max(0, -(S.air || 0)) >> 1) + (S.dy && !S.air && anim === 'hands' ? 1 : 0) : 0;   // a wheelie: the whole chair bounces up
  if (chair) { oy = -lift; ox = S.rock || 0; }
  if (crutch) { ox = 0; oy = S.air ? Math.max(-2, Math.round(S.air / 2)) : (S.dy || 0); }   // hops, small ones
  if (chair) {                                                      // the wheelchair, behind him: big wheels side on to us, tyre outside, rim inside
    const cx = S.rock || 0;
    for (const wx of [-2, 9]) for (let y = 1; y <= 9; y++) for (const dx of [0, 1]) put(cx + wx + dx, y - lift, (y === 1 || y === 9) ? 'Y' : dx === (wx < 0 ? 1 : 0) ? 'y' : 'Y');
    for (const hx of [-1, 9]) { put(cx + hx, -2 - lift, 'V'); put(cx + hx, -1 - lift, 'V'); }
  }
  ['.ssSSSss.', '.sssssss.', '.SsssssS.', '.sssssss.', '.sSSSSSs.', '.PpPpPpP.'].forEach((r, y) => { for (let x = 0; x < 9; x++) if (r[x] !== '.') put(ox + x, oy + y, r[x]); });
  if (chair) {                                                      // seat edge, both legs in casts down to the footrest
    for (let x = 0; x <= 8; x++) put(ox + x, oy + 6, 'V');
    for (const lx of [2, 5]) { put(ox + lx, oy + 6, 'W'); put(ox + lx + 1, oy + 6, 'w'); put(ox + lx, oy + 7, 'W'); put(ox + lx + 1, oy + 7, 'w'); }
    for (const lx of [1, 5]) { put(ox + lx, oy + 8, 'W'); put(ox + lx + 1, oy + 8, 'W'); put(ox + lx + 2, oy + 8, 'w'); }
    for (let x = 0; x <= 8; x++) put(ox + x, oy + 9, 'V');
  } else if (crutch) {                                              // on one leg; the cast leg held up off the ground
    for (let y = 6; y <= 8; y++) { put(ox + 2, oy + y, 'p'); put(ox + 3, oy + y, 'p'); }
    put(ox + 2, oy + 9, 'd'); put(ox + 3, oy + 9, 'd');
    for (let y = 6; y <= 7; y++) { put(ox + 6, oy + y, 'W'); put(ox + 7, oy + y, 'w'); }
    put(ox + 6, oy + 8, 'W'); put(ox + 7, oy + 8, 'W'); put(ox + 8, oy + 8, 'w'); put(ox + 8, oy + 7, 'i');
  } else {
    const L = { stand: [[[2, 6], [2, 7], [2, 8]], [[6, 6], [6, 7], [6, 8]]], kneeL: [[[2, 6], [1, 7]], [[6, 6], [6, 7], [6, 8]]], kneeR: [[[2, 6], [2, 7], [2, 8]], [[6, 6], [7, 7]]],
      tapR: [[[2, 6], [2, 7], [2, 8]], [[6, 6], [6, 7], [6, 7]]], wide: [[[2, 6], [1, 7], [1, 8]], [[6, 6], [7, 7], [7, 8]]] }[S.legs];
    for (const leg of L) { for (const [x, y] of leg) { put(ox + x, oy + y, 'p'); put(ox + x + 1, oy + y, 'p'); } const [x, y] = leg[leg.length - 1]; put(ox + x, oy + y + 1, 'd'); put(ox + x + 1, oy + y + 1, 'd'); }
  }
  hd.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') put(ox + x, oy - hh + y, r[x]); });
  // Arms have a real length (upper arm 3, forearm 3.5) however far a pose reaches, and are 2 pixels thick.
  const reach = (a, b, L) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy); return d <= L ? b : [Math.round(a[0] + dx * L / d), Math.round(a[1] + dy * L / d)]; };
  let handsTop = 99;
  const armPts = (side, el, hand) => { const m = side < 0 ? (p) => p : (p) => [8 - p[0], p[1]], s0 = side < 0 ? [0, 1] : [8, 1], e = reach(s0, m(el), 3), h = reach(e, m(hand), 3.5);
    const seg = (a, b) => podLine(ox + a[0], oy + a[1], ox + b[0], oy + b[1]).map(p => [p[0], p[1], Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0])]);
    handsTop = Math.min(handsTop, oy + h[1]);
    return { pts: seg(s0, e).concat(seg(e, h).slice(1)), hand: [ox + h[0], oy + h[1]], side }; };
  const drawArm = (a) => {
    a.pts.forEach(([x, y, vert], k) => put(vert ? x + a.side : x, vert ? y : y + 1, k <= 1 ? 'S' : 'j'));   // the second pixel: outside a hanging arm, under a level one
    a.pts.forEach(([x, y], k) => put(x, y, k <= 1 ? 's' : 'i'));
  };
  const plantCrutch = (side) => { const up = S.clap && side > 0 ? 2 : 0, x = (side < 0 ? ox - 2 : ox + 10) + (up ? 1 : 0);   // second place on a crutch taps it on the ground instead of clapping
    put(x - 1, oy + 1, 'k'); put(x, oy + 1, 'k'); put(x + 1, oy + 1, 'k'); for (let y = oy + 2; y <= 9 - up; y++) put(x, y, y >= 9 - up ? 'k' : 'K');
    drawArm(armPts(side, [-1, 2], [-1, 4])); put(x, oy + 4, 'i'); };
  const waveCrutch = (hand) => { for (let k = 1; k <= 8; k++) put(hand[0], hand[1] - k, k === 8 ? 'k' : 'K'); put(hand[0] - 1, hand[1] - 8, 'k'); put(hand[0] + 1, hand[1] - 8, 'k'); };
  const drawSling = () => {                                         // the arm on our left in a cast, folded across in a sling
    put(ox + 0, oy + 1, 's'); put(ox + 0, oy + 2, 'S'); put(ox + 0, oy + 3, 's');
    for (let x = 0; x <= 4; x++) { put(ox + x, oy + 4, x === 4 ? 'i' : 'W'); put(ox + x, oy + 5, 'w'); }
    for (const [x, y] of [[5, 3], [6, 2], [7, 1], [6, 0], [5, -1]]) put(ox + x, oy + y, 'L');
  };
  const props = [];
  if (S.crossed) {
    if (sling) { drawSling(); for (const [x, y, c] of [[8, 1, 's'], [8, 2, 'S'], [7, 3, 'i'], [6, 3, 'i'], [5, 3, 'i'], [4, 3, 'i'], [3, 3, 'i']]) put(ox + x, oy + y, c); }
    else for (const [x, y, c] of [[0, 1, 's'], [0, 2, 's'], [0, 3, 'S'], [1, 3, 'j'], [2, 3, 'j'], [3, 3, 'j'], [4, 3, 'j'], [5, 3, 'j'], [6, 3, 'j'], [7, 3, 'j'], [8, 1, 's'], [8, 2, 'S'], [7, 2, 'i'], [6, 2, 'i'], [5, 2, 'i'], [4, 2, 'i'], [3, 2, 'i'], [2, 2, 'i'], [1, 2, 'i']]) put(ox + x, oy + y, c);
    if (crutch) { const x = ox + 10; put(x - 1, oy + 1, 'k'); put(x, oy + 1, 'k'); for (let y = oy + 2; y <= 9; y++) put(x, y, 'K'); }   // the crutch tucked under his arm
  } else {
    const free = [['L', -1], ['R', 1]].filter(([k]) => !(k === 'L' && sling));
    if (sling) drawSling();
    for (const [k, side] of free) {
      let [el, hand] = S.arms[k];
      if (S.clap && sling && k === 'R') { el = [0, 3]; hand = t % 4 < 2 ? [4, 3] : [4, 4]; }   // slapping the cast
      if (S.trophy && free.length === 1) { el = [-1, -1]; hand = [1, -5 - S.bob]; }   // one-handed, held up by its base
      const a = armPts(side, el, hand), raised = a.hand[1] < oy, onCrutch = k === 'R' && crutch, busy = (S.bottle && k === 'R') || S.trophy;
      if (onCrutch && !raised && !busy) { plantCrutch(side); continue; }
      drawArm(a);
      if (onCrutch && raised && !S.trophy) waveCrutch(a.hand);      // waves the crutch in the air
    }
    if (S.trophy) { const hx = free.length === 1 ? (free[0][1] < 0 ? ox + 1 : ox + 7) : ox + 4; props.push(['trophy', hx - 3, handsTop - TROPHY.length + 1]); }   // its base sits in his hands
    if (S.bottle) props.push(['bottle', ox + 7, oy + 2 - S.bottle.sh, S.bottle]);
  }
  for (const p of props) {
    if (p[0] === 'trophy') TROPHY.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') put(p[1] + x, p[2] + y, r[x]); });
    else { const [, bx, by, B] = p, k = B.k;
      for (const [x, y, c] of [[0, 0, 'Q'], [1, -1, 'q'], [1, 0, 'Q'], [2, -2, 'q'], [2, -1, 'q'], [3, -3, 'q'], [3, -2, 'Q'], [4, -4, k < 4 ? 'c' : 'q']]) put(bx + x, by + y, c);
      if (k === 4) put(bx + 6, by - 7, 'm');
      if (k >= 4) { const n = k - 4; for (let j = 0; j < 4 + 3 * n; j++) for (const w of [-1, 0, 1]) { if ((j + w) % 2 && j < 3) continue; put(bx + 4 + j, by - 4 - j + Math.floor(j * j * 0.09) + w * Math.floor(j / 2), (j + w + B.t) % 3 ? 'c' : 'a'); } } }
  }
  return g;
}
// A figure as a sprite: its grid (1 unit = 2 screen px) painted at 2x through RotSprite, upright, so its edges match every
// other sprite. Drawn with its body's top left at (x, y). Frames repeat, so they are cached per look.
const podCache = new Map();
export function drawPodFigure(anim, t, head, lvl, th, x, y) {
  const T = KTHEMES[th] || {}, key = anim + '|' + t + '|' + head + '|' + lvl + '|' + th + '|' + Object.values(T).join(',');
  let c = podCache.get(key);
  if (!c) {
    const fig = podFigure(anim, t, head, lvl); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const k of fig.keys()) { const [fx, fy] = k.split(',').map(Number); x0 = Math.min(x0, fx); y0 = Math.min(y0, fy); x1 = Math.max(x1, fx); y1 = Math.max(y1, fy); }
    const base = document.createElement('canvas'); base.width = (x1 - x0 + 3) * 2; base.height = (y1 - y0 + 3) * 2; base.ax = 0; base.ay = 0;
    const g = base.getContext('2d');
    for (const [k, cc] of fig) { const [fx, fy] = k.split(',').map(Number); g.fillStyle = POD_PAL[cc] || kCol(cc, th); g.fillRect((fx - x0 + 1) * 2, (fy - y0 + 1) * 2, 2, 2); }
    c = rotSprite(base, 0, base.width, base.height, 0, 0); c.dx = (x0 - 1) * 2; c.dy = (y0 - 1) * 2;
    if (podCache.size > 400) podCache.clear();
    podCache.set(key, c);
  }
  ctx.drawImage(c, x + c.dx, y + c.dy);
}
const POD_WIN = [['hands', 3], ['trophy', 4], ['champagne', 6], ['dance', 5], ['jump', 8]];
export function startPodium() {                                           // everyone's final time (an estimate for anyone not home yet), best first
  for (const o of bots) if (!o.done) { const avg = Math.max(20, (o.x - race.startX) / Math.max(0.1, race.raceT)); o.done = race.raceT + Math.max(0, finishX() - o.x) / avg; }
  const myHead = LOOK_HEADS[look.head];
  const all = [{ name: 'YOU', th: 0, head: myHead, t: race.finishT, col: P.white, lvl: podLevel(race.crashes) }].concat(bots.map(o => ({ name: o.name, th: o.theme, head: o.theme === 0 ? myHead : (KTHEMES[o.theme].head || 'helmet'), t: o.done, col: THEME_SUIT[o.theme], lvl: podLevel(o.wipeouts) })));
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
    const tt = Math.floor(sec * fps), ox = s.cx - 9, oy = G - s.h - 20;
    drawPodFigure(anim, tt, r.head, r.lvl, r.th, ox, oy);
    if (r.head === 'skull' && lit()) {
      const fig = podFigure(anim, tt, r.head, r.lvl);                             // the flaming skull glows on the podium too, after dark
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
