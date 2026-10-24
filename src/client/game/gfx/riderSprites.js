// Painting riders and bikes from the pixel art in any pose, colour theme and rotation, with caches.

import { KTHEMES, K_BIKES, K_HEADS, K_PAL, K_PEOPLE, K_ROLE } from '../art/riders.js';
import { ctx } from '../core/canvas.js';
import { view } from '../core/state.js';
import { clamp } from '../core/util.js';
import { FC } from './pixel.js';

export const kCol = (ch, th) => KTHEMES[th][ch] || K_PAL[ch];
const kBike = (th) => K_BIKES[KTHEMES[th || 0].bike || 0];
export const KS = 2, BASE_W = 72, BASE_H = 74, AX = 36, AY = 64;   // anchor = ground under the middle of the bike
function kLine(a, b) {
  let x0 = Math.round(a[0]), y0 = Math.round(a[1]); const x1 = Math.round(b[0]), y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; const pts = [];
  for (;;) { pts.push([x0, y0]); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  return pts;
}
// rider joints in Kenney px, origin = ground under the middle of the bike (each bike has its own seat and bars).
// body: -2 wheelie ... +2 tucked; mode: 0 ground, 1 rising, 2 falling, 3 landing squash, 4 superman (body = stage 1-3)
function kPose(body, mode, bob, th) {
  const N = kBike(th).N, j = { hip: N.hip.slice(), K: N.K.slice(), F: N.F.slice(), S: N.S.slice(), G: N.G.slice(), hd: [0, 0] };
  const d = [N.S[0] + 1, N.S[1] + 11];                                 // (superman is placed for the street bike; shift it onto this one)
  const mv = (k, dx, dy) => { j[k][0] += dx; j[k][1] += dy; };
  if (mode === 0) {
    if (body === -1) { mv('S', -1, 0); mv('hd', -1, 0); }
    else if (body <= -2) { mv('S', -3, 1); mv('hd', -1, 0); mv('K', -1, 1); }
    else if (body === 1) { mv('S', 2, 1); mv('hd', 1, 0); }
    else if (body >= 2) { mv('S', 3, 3); mv('hd', 2, 0); mv('hip', -1, 0); }
  } else if (mode === 1) { mv('hip', 1, -2); mv('S', 1, -3); mv('K', 0, -1); }
  else if (mode === 2) { mv('hip', 0, -1); mv('S', 0, -1); mv('K', 1, -2); }
  else if (mode === 3) { mv('S', 1, 2); mv('K', 1, 0); }
  else if (mode === 4) {
    const st = Math.max(1, Math.min(3, body)) - 1;
    j.hip = [[-4, -9], [-5, -10], [-5, -11]][st]; j.K = [[-7, -9], [-8, -11], [-9, -12]][st]; j.F = [[-9, -9], [-11, -11], [-12, -12]][st];
    j.S = [[0, -12], [1, -12], [1, -12]][st];
    for (const k of ['hip', 'K', 'F', 'S']) mv(k, d[0], d[1]);
  }
  else if (mode === 5) {                                              // REDEEMER, in stages (body = 1..4): getting up into it, or back down out of it; 5 = lying after a fall
    const hx = N.hip[0], y0 = N.hip[1], st = Math.max(1, Math.min(7, body));
    if (st === 1) {                                                   // 1: up off the seat, feet coming up off the pegs
      j.hip = [hx, y0 - 2]; j.K = [N.K[0] + 1, N.K[1] - 3]; j.F = [N.F[0] + 1, N.F[1] - 3]; j.S = [N.S[0] + 1, N.S[1] - 1];
    } else if (st === 2) {                                            // 2: crouched on the seat, hands still on the bars
      j.F = [hx + 1, y0 - 1]; j.K = [hx + 4, y0 - 4]; j.hip = [hx - 1, y0 - 5]; j.S = [hx + 2, y0 - 9];
    } else if (st === 3) {                                            // 3: standing up, hands leaving the bars
      j.F = [hx, y0 - 1]; j.K = [hx + 2, y0 - 5]; j.hip = [hx, y0 - 8]; j.S = [hx + 1, y0 - 12]; j.G = [j.S[0] + 4, j.S[1] + 3];
    } else {                                                          // 4: standing tall on the seat, arms straight out; 5: the same, flat on his back, hands down
      j.F = [hx, y0 - 1]; j.K = [hx + 1, y0 - 5]; j.hip = [hx, y0 - 9]; j.S = [hx, y0 - 14];
      if (st === 4) { j.G = [j.S[0] + 6, j.S[1] + 1]; j.G2 = [j.S[0] - 6, j.S[1] + 1]; if (bob) mv('G', 0, 1); }
      else if (st >= 6) {                                             // 6/7: losing it: on one foot, the other knee up, arms see-sawing (6 and 7 alternate)
        const w = st === 6 ? 1 : -1;
        j.K2 = [hx, y0 - 5]; j.F2 = [hx, y0 - 1]; j.K = [hx + 5, y0 - 9]; j.F = [hx + 5, y0 - 5];
        j.S = [hx + w, y0 - 14]; j.G = [j.S[0] + 6, j.S[1] + 1 - 2 * w]; j.G2 = [j.S[0] - 6, j.S[1] + 1 + 2 * w];
      } else { j.G = [j.S[0] - 4, j.S[1] + 3]; j.G2 = [j.S[0] - 3, j.S[1] + 4]; }
    }
    return j;
  }
  else if (mode === 6) {                                              // HEADSTAND: 1 leaning over the bars, 2 head tucked onto the seat, 3 upside down knees tucked, 4/5 legs up kicking, 6 lying after a fall
    const HA = K_HEADS[KTHEMES[th].head || 'helmet'].art, Hh = HA.length, Hw = HA[0].length, hx = N.hip[0], st = Math.max(1, Math.min(6, body));
    if (st === 1) { j.S = [N.G[0] - 1, N.S[1] + 2]; j.hd = [1, 1]; j.hip = [hx + 1, N.hip[1] - 2]; j.K = [N.K[0] + 1, N.K[1] - 1]; }
    else if (st === 2) { const top = N.hip[1] - Hw; j.rot = [hx - 1, top]; j.S = [hx + 1, top - 1]; j.hip = [hx - 1, top - 5]; j.K = [hx + 3, top - 4]; j.F = [hx + 2, top - 1]; }
    else {
      const sy = N.hip[1] - Hh - 1; j.inv = true; j.S = [hx + 1, sy]; j.hip = [hx + 1, sy - 5];
      if (st === 3) { j.K = [hx + 4, sy - 5]; j.F = [hx + 4, sy - 2]; }
      else if (st === 4) { j.K = [hx + 4, sy - 8]; j.F = [hx + 7, sy - 10]; j.K2 = [hx - 2, sy - 8]; j.F2 = [hx - 5, sy - 10]; }   // (scissor kick: legs split...)
      else if (st === 5) { j.K = [hx + 2, sy - 9]; j.F = [hx + 3, sy - 13]; j.K2 = [hx, sy - 9]; j.F2 = [hx - 1, sy - 13]; }      // (...and snapped together)
      else { j.K = [hx + 3, sy - 8]; j.F = [hx + 5, sy - 10]; }
      if (st <= 5) { j.G = [j.S[0] + 8, j.S[1] - 1]; j.G2 = [j.S[0] - 7, j.S[1] - 1]; }   // hands off the bars, straight out to the sides
      else j.G = [j.S[0] - 4, j.S[1] - 1];                                    // flat on his back: hand down on the road
    }
    return j;
  }
  else if (mode === 7) {                                              // SUPER MARIO: jumping clear of the bike, fist punched up, one knee up
    const hx = N.hip[0], y0 = N.hip[1];
    j.F = [hx + 3, y0 - 3]; j.K = [hx + 3, y0 - 6]; j.hip = [hx, y0 - 9]; j.S = [hx, y0 - 14]; j.G = [hx + 1, y0 - 21]; j.G2 = [hx - 3, y0 - 10];
    return j;
  }
  if (mode === 1 || mode === 2) { if (body < 0) { mv('S', -1, 0); mv('hd', -1, 0); } else if (body > 0) { mv('S', 1, 0); mv('hd', 1, 0); } }
  if (bob) { mv('S', 0, 1); mv('hip', 0, 1); }
  return j;
}
// a head on its own (EDIT PLAYER shows them): helmet, short hair, long hair, bald
export function kPaintHead(put, head, x0, y0, th) {
  const T = KTHEMES[th], H = K_HEADS[head], C = { R: T.r, W: kCol('f', th), G: kCol('h', th), V: K_PAL.e, v: K_PAL.g, h: kCol('f', th), s: kCol('i', th), S: kCol('j', th) };
  H.art.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') put(x0 + x, y0 + y, C[row[x]] || K_PAL[row[x]]); });
}
function kPaintRider(put, j, th) {
  const T = KTHEMES[th], s = T.s, sd = T.S, R = K_ROLE;
  const flat = (a, b) => Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
  const thick = (a, b, r, col, back, bt) => {                         // a limb lying flatter than upright keeps its width across the limb
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2), bx = dy / L, by = -dx / L;   // (bx, by): its back
    for (let y = Math.min(a[1], b[1]) - 3; y <= Math.max(a[1], b[1]) + 3; y++) for (let x = Math.min(a[0], b[0]) - 3; x <= Math.max(a[0], b[0]) + 3; x++) {
      const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1), qx = a[0] + t * dx, qy = a[1] + t * dy;
      if ((x - qx) * (x - qx) + (y - qy) * (y - qy) <= r * r) put(x, y, back && (x - a[0]) * bx + (y - a[1]) * by > bt ? back : col);
    }
  };
  if (j.K2) {                                                          // the far leg, behind him (darker)
    for (const [a, b] of [[j.hip, j.K2], [j.K2, j.F2]]) for (const p of kLine(a, b)) { put(p[0] - 1, p[1], T.P); put(p[0], p[1], T.P); put(p[0] + 1, p[1], T.P); }
    const F2 = j.F2, bt2 = K_PAL[R.boot]; put(F2[0], F2[1], bt2); put(F2[0] + 1, F2[1], bt2); put(F2[0] + 2, F2[1], bt2);
  }
  for (const [a, b] of [[j.hip, j.K], [j.K, j.F]]) {
    if (flat(a, b)) { thick(a, b, 1.25, T.p); continue; }
    for (const p of kLine(a, b)) { put(p[0] - 1, p[1], T.p); put(p[0], p[1], T.p); put(p[0] + 1, p[1], T.p); put(p[0], p[1] + 1, T.p); }
  }
  const F = j.F, bt = K_PAL[R.boot];
  put(F[0], F[1], bt); put(F[0] + 1, F[1], bt); put(F[0] + 2, F[1], bt); put(F[0], F[1] + 1, bt); put(F[0] + 1, F[1] + 1, bt);
  if (j.G2) { const pts2 = kLine([j.S[0] - 1, j.S[1] + 1], j.G2); pts2.forEach((p, i) => { put(p[0], p[1], i < pts2.length - 1 ? sd : kCol(R.skinD, th)); put(p[0], p[1] + 1, i < pts2.length - 1 ? sd : kCol(R.skinD, th)); }); }   // the far arm, behind him
  if (flat(j.hip, j.S)) thick(j.hip, j.S, 2.3, s, sd, 1.3);           // superman: stretched out flat, still a full body thick
  else {
    for (const p of kLine(j.hip, j.S)) { put(p[0] - 2, p[1], sd); put(p[0] - 1, p[1], s); put(p[0], p[1], s); put(p[0] + 1, p[1], s); put(p[0] + 2, p[1], s); }
    for (const p of kLine([j.hip[0] - 2, j.hip[1] + 1], [j.hip[0] + 2, j.hip[1] + 1])) put(p[0], p[1], sd);
    for (let x = -2; x <= 2; x++) put(j.S[0] + x, j.S[1], x === -2 ? sd : s);
  }
  const H = K_HEADS[T.head || 'helmet'];
  if (j.inv) { const n = H.art.length; kPaintHead((x, y, c) => put(x, j.S[1] + n - y, c), T.head || 'helmet', j.S[0] + H.ax, 0, th); }   // (upside down, below his shoulders)
  else if (j.rot) { const n = H.art.length; kPaintHead((x, y, c) => put(j.rot[0] + (n - 1 - y), j.rot[1] + x, c), T.head || 'helmet', 0, 0, th); }   // (turned on its side: crown forward, face down)
  else kPaintHead(put, T.head || 'helmet', j.S[0] + H.ax + j.hd[0], j.S[1] + H.ay + j.hd[1], th);
  const pts = kLine([j.S[0] + 1, j.S[1] + 1], j.G);                   // arm to the grip: sleeve, then glove
  pts.forEach((p, i) => {
    put(p[0], p[1], i < 3 ? s : i < pts.length - 1 ? kCol(R.skin, th) : kCol(R.skinD, th));
    put(p[0], p[1] + 1, i < 3 ? sd : kCol(R.skinD, th));
  });
}
export function kBikeGrid(wf, dz, th) {
  const B = kBike(th), g = B.grid.map(r => r.split('')), tA = K_ROLE.tA, tB = K_ROLE.tB, H = g.length;
  if (wf) for (let y = H - 5; y < H; y++) for (const [x0, x1] of B.wheels) for (let x = x0; x <= x1; x++) {   // the tyres' tread moves on a frame
    if (g[y][x] === tA) g[y][x] = tB; else if (g[y][x] === tB) g[y][x] = tA;
  }
  if (dz) {                                                            // tipping over: the front wheel shimmies (and on the street bike the bars jerk)
    const [x0, x1] = B.wheels[1];
    for (let y = H - 5; y < H; y++) { g[y][x0] = '.'; g[y][x1] = '.'; if (dz === 2) { g[y][x0 + 1] = '.'; g[y][x1 - 1] = '.'; } }
    if (B === K_BIKES[0]) for (let x = 8; x < 14; x++) { const t = g[0][x]; g[0][x] = g[1][x]; g[1][x] = t; }
  }
  return g;
}
function paintBike(g, body, mode, bob, wf, rider, dz, th) {   // rider: 0 bike only, 1 both
  th = th || 0; const B = kBike(th);
  const put = (x, y, c) => { g.fillStyle = c; g.fillRect(AX + x * KS, AY + y * KS, KS, KS); };
  if (rider !== 2) kBikeGrid(wf, dz, th).forEach((row, y) => row.forEach((ch, x) => { if (ch !== '.') put(x + B.ox, y + B.oy, kCol(ch, th)); }));
  if (rider) kPaintRider(put, kPose(body, mode, bob, th), th);
}
// where things are on each bike, in screen px from the anchor: the rear wheel (wheelies pivot on it), the headlight, the exhaust
export const kRear = (th) => { const B = kBike(th); return ((B.wheels[0][0] + B.wheels[0][1] + 1) / 2 + B.ox) * KS; };
export const kLamp = (th) => { const B = kBike(th); return [(B.wheels[1][1] + B.ox) * KS - 2, (B.oy + B.grid.length - 7) * KS]; };
export const kExhaust = (th) => { const B = kBike(th); return [B.ox * KS - 1, -10]; };
// the rider lets the bike swing over his hands and drops to hang under the bars: legs trail, then swing through and settle
const K_FLIPKEYS = { 0: { hip: [-3, -9], K: [-1, -8], F: [-3, -5], S: [-1, -13] }, 2: { hip: [-3, -7], K: [-1, -5], F: [-3, -3], S: [-1, -11] },
  4: { hip: [-2, -4], K: [-4, -2], F: [-6, -1], S: [0, -8] }, 6: { hip: [-1, -2], K: [-2, 1], F: [-4, 3], S: [0, -6] }, 8: { hip: [-1, -2], K: [0, 1], F: [-1, 4], S: [0, -6] } };
function kFlipPose(i, th) {
  const G = kBike(th).N.G, d = [G[0] - 2, G[1] + 9];                   // (keyed to the street bike's bars; moved to this bike's)
  const a = i - (i % 2), b = Math.min(8, a + 2), u = (i - a) / 2, A = K_FLIPKEYS[a], B = K_FLIPKEYS[b], j = { G: G.slice(), hd: [0, 0] };
  for (const k of ['hip', 'K', 'F', 'S']) j[k] = [Math.round(A[k][0] + (B[k][0] - A[k][0]) * u) + d[0], Math.round(A[k][1] + (B[k][1] - A[k][1]) * u) + d[1]];
  return j;
}
export const flipBases = new Map();
export function flipBase(i, theme) {
  theme = theme || 0; const key = i + '|' + theme; let c = flipBases.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = BASE_W; c.height = BASE_H; c.ax = AX; c.ay = AY;
  const g = c.getContext('2d'), put = (x, y, col) => { g.fillStyle = col; g.fillRect(AX + x * KS, AY + y * KS, KS, KS); };
  const B = kBike(theme), [y0, rows] = B.flip[i];
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') put(x + B.ox, y0 + y, kCol(row[x], theme)); });   // the bike, behind him
  kPaintRider(put, kFlipPose(i, theme), theme);
  skullTag(c, theme); flipBases.set(key, c); return c;
}
export const footBases = new Map();
export function footBase(name, theme) {                                       // stand, walk0/1, sit, lift, jump, rag (tumbling), down (lying)
  theme = theme || 0;
  const key = name + theme; let c = footBases.get(key); if (c) return c;
  const set = K_PEOPLE[KTHEMES[theme].head || 'helmet'], gr = (set && set[name]) || K_PEOPLE.helmet[name], w = gr[0].length, h = gr.length;   // (a drafted head without this pose wears the helmet's)
  c = document.createElement('canvas'); c.width = w * KS; c.height = h * KS; c.ax = Math.round(w * KS / 2); c.ay = name === 'rag' ? h : h * KS;   // the tumbling body spins about its middle
  const g = c.getContext('2d');
  gr.forEach((row, y) => { for (let x = 0; x < w; x++) if (row[x] !== '.') { g.fillStyle = kCol(row[x], theme); g.fillRect(x * KS, y * KS, KS, KS); } });
  skullTag(c, theme); footBases.set(key, c); return c;
}
export const bikeBases = new Map();
export function bikeBase(body, mode, bob, wf, rider, theme, dz) {
  theme = theme || 0; dz = dz || 0;
  const key = body + '|' + mode + '|' + bob + '|' + wf + '|' + (rider ? +rider : 0) + '|' + theme + '|' + dz; let c = bikeBases.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = BASE_W; c.height = BASE_H; c.ax = AX; c.ay = AY;
  paintBike(c.getContext('2d'), body, mode, bob, wf, rider, dz, theme); bikeBases.set(key, c);
  if (rider) skullTag(c, theme);
  return c;
}
export function ragdollBase() { return footBase('rag'); }
export function drawFrame(f, ax, ay) { ctx.drawImage(f, Math.round(ax) - FC, Math.round(ay) - FC); fireFrom(f, Math.round(ax) - FC, Math.round(ay) - FC, 1); }
// The flaming skull's flames light things up, wherever the rider is: on the bike, mid-flip, tumbling off it, picking
// himself up. Any sprite with the skull on it is tagged with the flames' colours, and where they are in it is found
// (once) by looking for those colours; drawing the sprite then puts a fire there for the lighting.
function skullTag(c, theme) {
  if (KTHEMES[theme].head !== 'skull') return;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  c.skull = { cols: [hex(kCol('f', theme)), hex(kCol('h', theme))], col: kCol('f', theme) };
}
export function fireFrom(c, x, y, sx) {                                    // sx = -1 when the sprite is drawn mirrored
  const S = c.skull; if (!S) return;
  if (S.at === undefined || S.of !== c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, mx = 0, my = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && S.cols.some(q => q[0] === d[i] && q[1] === d[i + 1] && q[2] === d[i + 2])) { const p = i >> 2; mx += p % c.width; my += (p / c.width) | 0; n++; }
    c.skull = { cols: S.cols, col: S.col, of: c, at: n ? [mx / n, my / n] : null };
  }
  const a = c.skull.at; if (a) view.fires.push([sx < 0 ? x - a[0] : x + a[0], y + a[1], c.skull.col]);
}
