// THE NEW RIDES (Super Bike Workshop, sections 4 and 5): a superbike, the American flag bike (a long, low chopper in
// stars and stripes: generic, not anybody's branding), a bicycle, a horse, a unicycle and a skateboard. Each is drawn
// from code rather than a fixed grid, in Kenney pixels (1 = 2 screen px), origin on the ground under its middle, y up
// negative, and returns the rider's joints for the game's rider painter. From the Workshop's rides.html, unchanged but
// for where it lives; see the bottom of this file for how they become K_BIKES entries.
//
// Their letters are the Workshop's. Fixed colours that would collide with the game's own letters ('h' is the helmet
// shade, 'u' the flag blue on the America helmet) are translated on the way out (RIDE_LETTER) to palette entries of
// their own (RIDE_PAL), so no LOOK colour ever recolours a spoke or a horse.

import { kLine } from '../core/util.js';

function knee(H, F, L1, L2, fwd) {                               // two-bone leg: where the knee goes (bending forward or back), and where the foot ends up
  let dx = F[0] - H[0], dy = F[1] - H[1], d = Math.hypot(dx, dy) || 0.01;
  if (d > L1 + L2 - 0.05) { const k = (L1 + L2 - 0.05) / d; dx *= k; dy *= k; d = L1 + L2 - 0.05; F = [H[0] + dx, H[1] + dy]; }
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a)), mx = H[0] + dx * a / d, my = H[1] + dy * a / d, px = -dy / d, py = dx / d;
  const K1 = [mx + px * h, my + py * h], K2 = [mx - px * h, my - py * h];
  return { K: (K1[0] > K2[0]) === fwd ? K1 : K2, F };
}
function wheel(put, cx, cy, r, ang, thin) {                     // a tyre, its rim, and a spoke that turns so you can see it roll
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d <= r && d > r - (thin ? 1.05 : 1.6)) put(x, y, 'e');
    else if (!thin && d <= r - 1.6 && d > r - 2.4) put(x, y, 'g');
    else if (!thin && d <= r - 2.4) put(x, y, 'd');
  }
  const spokes = thin ? 3 : 1;
  for (let k = 0; k < spokes; k++) { const a = ang + k * Math.PI * 2 / spokes;
    for (let s = 0.5; s < r - (thin ? 1 : 1.6); s += 0.5) put(Math.floor(cx + Math.cos(a) * s), Math.floor(cy + Math.sin(a) * s), thin ? 'h' : 'c'); }
  put(Math.floor(cx), Math.floor(cy), thin ? 'g' : 'h');
}
const rows = (put, x0, y0, art) => art.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') put(x0 + x, y0 + y, r[x]); });
const seg = (put, a, b, c) => { for (const p of kLine(a, b)) put(p[0], p[1], c); };

const SUPER = [
  '...............aaa....',
  '..............aaabb...',
  'bbbc.........aabbbbbb.',
  '.cbbbbc....bbbbbccBBbb',
  '..BBbbbbbbbbbBccBBBbbo',
  '...BBBcccbbbBBBBBBBbB.',
  '....BddBBcccccBBBBdd..',
  '...gg..dddBBBBddd.....'
];

// st: { t, dist (how far it's rolled, Kenney px), sp, mode: 'ride' | 'wheelie' | 'brake' | 'air', k (0..1, how far into the move), air }
function superbike(put, st) {
  const ang = -st.dist / 3.5;
  wheel(put, -7, -3.5, 3.5, ang); wheel(put, 7.5, -3.5, 3.5, ang);
  rows(put, -11, -11, SUPER);
  if (st.mode === 'air') return { hip: [-5, -12], K: [-2, -9], F: [-4, -5], S: [0, -16], G: [5, -10], hd: [0, 0] };   // up off the seat, knees soaking it up
  if (st.mode === 'wheelie') return { hip: [-6, -10], K: [-2, -8], F: [-4, -5], S: [-4, -14], G: [5, -10], hd: [-1, 0] };
  if (st.mode === 'brake') return { hip: [-4, -10], K: [-1, -8], F: [-4, -5], S: [3, -12], G: [5, -10], hd: [1, 1] };
  return { hip: [-5, -10], K: [-2, -8], F: [-4, -5], S: [1, -13], G: [5, -10], hd: [1, 1] };
}
// a long, low chopper in stars and stripes: raked-out forks, tall handlebars, a teardrop tank, a sissy bar
const FLAG_TANK = ['....XXQcQQ', '..ccccQQcQ', '.XXXXXXXXX', '.cccccccc.', '..XXXXXX..'];
function chopper(put, st) {
  const ang = -st.dist / 3.5, R = [-8, -3.5], F = [10, -3.5];
  for (let k = 0; k <= 12; k++) { const a = Math.PI * (1.05 + 0.8 * k / 12), x = R[0] + Math.cos(a) * 4.6, y = R[1] + Math.sin(a) * 4.6; put(Math.round(x), Math.round(y), (k >> 1) % 2 ? 'c' : 'X'); }   // striped rear fender
  wheel(put, R[0], R[1], 3.5, ang, true); wheel(put, F[0], F[1], 3.5, ang, true);
  seg(put, [-9, -3], [1, -4], 'a'); seg(put, [-9, -4], [1, -5], 'h');                 // pipes
  seg(put, R, [-3, -4], 'g'); seg(put, [-3, -4], [3, -4], 'g'); seg(put, [3, -4], [5, -11], 'g'); seg(put, R, [-5, -9], 'g'); seg(put, [-5, -9], [5, -12], 'g');   // frame
  rows(put, -2, -8, ['.hgh.', 'hgdgh', 'ghhhg', '.gdg.']);                            // the engine
  seg(put, [5, -12], F, 'h'); seg(put, [6, -12], [F[0] + 1, F[1]], 'a');               // long forks
  seg(put, [-7, -9], [-7.5, -15], 'h'); put(-8, -15, 'h');                             // sissy bar
  rows(put, -6, -10, ['zzzz.', '.zzzz']);                                               // the seat, low
  rows(put, -3, -14, FLAG_TANK);
  seg(put, [5, -12], [5.5, -19], 'h'); seg(put, [5.5, -19], [3.5, -19], 'h');           // ape hangers
  put(6, -12, 'o'); put(7, -12, 'o'); rows(put, 4, -6, ['dd']);                         // headlight, forward pegs
  let hip = [-4, -10.5], S = [-4, -16], G = [4, -19], Fp = [4.5, -6.5], hd = [0, 0];
  if (st.mode === 'air') { hip = [-3, -12]; S = [-1.5, -17.5]; }                       // up off the seat
  if (st.mode === 'wheelie') { S = [-5.5, -15.5]; hd = [-1, 0]; }                        // leaning right back
  if (st.mode === 'brake') { S = [-1.5, -16]; hd = [1, 0]; }
  const L1 = knee(hip, Fp, 4.8, 4.8, false), L2 = knee([hip[0] - 0.5, hip[1]], [Fp[0] - 1, Fp[1]], 4.8, 4.8, false);   // legs nearly straight out, under the tank
  return { hip, K: L1.K, F: L1.F, K2: L2.K, F2: L2.F, S, G, G2: [G[0] - 1, G[1] + 0.5], hd };   // feet forward, arms up to the bars
}
function bicycle(put, st) {
  const ang = -st.dist / 4.5, BB = [0, -4], cr = 1.6;
  const th = st.mode === 'brake' ? Math.PI * 0.05 : st.mode === 'air' ? 0 : st.dist / 6;   // braking or flying: the pedals level, not turning
  wheel(put, -5.5, -4.5, 4.5, ang, true); wheel(put, 5.5, -4.5, 4.5, ang, true);
  const seat = [-2.5, -10], head = [4, -10], headLo = [4.5, -8];
  seg(put, [-5.5, -4.5], BB, 'B'); seg(put, [-5.5, -4.5], [-2.5, -9.5], 'B');
  seg(put, BB, seat, 'b'); seg(put, seat, head, 'b'); seg(put, BB, headLo, 'b');
  seg(put, head, [5.5, -4.5], 'B'); seg(put, head, [4, -12], 'd'); seg(put, [4, -12], [6, -12], 'd');
  rows(put, -4, -11, ['ddd.']);
  const ped = (a) => [BB[0] + Math.cos(a) * cr, BB[1] + Math.sin(a) * cr];
  const P1 = ped(th), P2 = ped(th + Math.PI);
  let hip = [-2.5, -11.5], S = [0.5, -16];
  if (st.mode === 'air') { hip = [-1.5, -13.5]; S = [1.5, -18]; }       // standing on the pedals
  if (st.mode === 'wheelie') { hip = [-3, -11.5]; S = [-1.5, -16]; }
  if (st.mode === 'brake') { hip = [-1.5, -12.5]; S = [2.5, -15.5]; }
  seg(put, BB, P2, 'g');
  const L1 = knee(hip, P1, 4.2, 4.2, true), L2 = knee(hip, P2, 4.2, 4.2, true);
  seg(put, BB, P1, 'g'); put(Math.round(P1[0]) - 1, Math.round(P1[1]), 'd'); put(Math.round(P1[0]), Math.round(P1[1]), 'd');
  return { hip, K: L1.K, F: L1.F, K2: L2.K, F2: L2.F, S, G: [5, -12.5], hd: [0, 0] };
}
function horse(put0, st) {
  const ph = st.dist * 0.035, moving = st.sp > 2, m = st.mode;
  const bq = (ph * 1.3) % 1, L = m === 'wheelie' ? 1.4 * Math.max(0, Math.sin(Math.PI * 2 * (bq - 0.35))) : 0;   // tilted back it bounds: a short float between pushes
  const put = (x, y, c) => put0(x, y - L, c);
  const bob = moving && m !== 'air' && m !== 'wheelie' ? Math.sin(ph * Math.PI * 4) * 0.6 : 0, by = -12 + bob;
  for (let k = 0, n = m === 'wheelie' ? 5 : 8; k < n; k++) { const sw = Math.sin(st.t * 6 + k * 0.4) * 1.2 * (moving ? 1 : 0.4); put(Math.round(-9 - k * 0.6), Math.round(by - 1 + k * 0.9 + sw * (k / 8)), 'z'); put(Math.round(-10 - k * 0.6), Math.round(by - 1 + k * 0.9 + sw * (k / 8)), 'z'); }
  const legs = [[-5.5, 0.15, false, true], [4.5, 0.6, true, true], [-4.5, 0.0, false, false], [5.5, 0.45, true, false]];
  const footAt = (hx, off, front, far) => {
    if (m === 'wheelie') {                                           // bounding: both hind legs push off together, then both front legs reach and land together
      const q = (ph * 1.3 + (front ? 0.5 : 0) + (far ? 0.04 : 0)) % 1;
      if (q < 0.4) { const u = q / 0.4; return [hx + 2.5 - 6 * u + (front ? 1 : 0), 0]; }
      const u = (q - 0.4) / 0.6; return [hx - 3.5 + 6 * u + (front ? 1 : 0), -(front ? 4 : 3) * Math.sin(Math.PI * u)]; }
    if (m === 'stand') return [hx + 0.5, 0];                                                                    // stood still
    if (m === 'brake' && front) return [hx + 2.5, 0];                                                            // pitching forward onto its front legs...
    if (m === 'brake') { const k = Math.sin(st.t * 10 + off * 9); return [hx - 4 - 1.5 * k, by + 5 + 1.5 * k]; }   // ...hind legs kicking up behind
    if (m === 'air' && front) return [hx + 1, by + 6];                                                           // jumping: front legs folded up
    if (m === 'air') return [hx - 5, by + 7];                                                                    // ...hind legs trailing
    const p = (ph + off) % 1; if (p < 0.45) { const u = p / 0.45; return [hx + 3 - 6 * u, 0]; }
    const u = (p - 0.45) / 0.55; return [hx - 3 + 6 * u, -2.8 * Math.sin(Math.PI * u) - (front ? 1.5 * Math.sin(Math.PI * u) : 0)];
  };
  const drawLeg = ([hx, off, front, far]) => {
    const H = [hx, by + 2], [fx, fy] = footAt(hx, off, front, far);
    const K = knee(H, [fx, fy - 0.5], 4.6, 4.8, !front).K, F = knee(H, [fx, fy - 0.5], 4.6, 4.8, !front).F;
    const c = far ? 'y' : 'H'; seg(put, H, K, c); seg(put, [H[0] + 1, H[1]], [K[0] + 1, K[1]], c); seg(put, K, F, c);
    put(Math.round(F[0]), Math.round(F[1]) - 0, 'z'); put(Math.round(F[0]) + 1, Math.round(F[1]), 'z');
  };
  const hindOut = false;                                             // (all four legs move with the body now)
  legs.filter(l => l[3] && !(hindOut && !l[2])).forEach(drawLeg);
  for (let y = -4; y <= 4; y++) for (let x = -9; x <= 8; x++) { const e = (x / 8.5) ** 2 + (y / 3.6) ** 2; if (e <= 1) put(x, Math.round(by + y), y > 1.5 ? 'y' : 'H'); }
  const up = 0;                                                                            // (tilted back it's the same gallop, so the head stays as it is)
  const nb = [5, by - 2], nt = [8 - up, by - 8 - up];
  for (let k = 0; k <= 10; k++) { const u = k / 10, x = nb[0] + (nt[0] - nb[0]) * u, y = nb[1] + (nt[1] - nb[1]) * u; for (let w = -2; w <= 1; w++) put(Math.round(x + w), Math.round(y), w === -2 ? 'z' : 'H'); }
  rows(put, 6 - up, Math.round(by - 11 - up), ['.zz......', 'zHHH.....', 'zHHHHHH..', '.HHeHHHHc', '..HHHHHHH', '...HHHyyy']);
  rows(put, -3, Math.round(by - 4), ['B....bb', 'bbbbbbB', '.BBBBB.']);
  legs.filter(l => !l[3] && !(hindOut && !l[2])).forEach(drawLeg);
  seg(put, [13 - up, Math.round(by - 7 - up)], [4, Math.round(by - 6)], 'd');
  if (m === 'air') return { hip: [-1, by - 6], K: [2, by - 3], F: [0.5, by + 0.5], S: [2.5, by - 10.5], G: [4.5, by - 7], hd: [1, 0] };   // up in the stirrups, leaning in
  if (m === 'brake') return { hip: [-1.5, by - 4.5], K: [1.5, by - 2], F: [1.5, by + 1.5], S: [-2, by - 9], G: [2, by - 7], hd: [-1, 0] };   // leaning back on the reins
  if (m === 'wheelie') return { hip: [-1, by - 4.5 - L], K: [1.5, by - 2 - L], F: [0, by + 1.5 - L], S: [0.5, by - 9.5 - L], G: [3.5, by - 6 - L], hd: [0, 0] };   // tilted back: the same seat, riding the bound
  return { hip: [-1, by - 4.5], K: [1.5, by - 2], F: [0, by + 1.5], S: [0.5, by - 9.5], G: [3.5, by - 6], hd: [0, 0] };
}
function unicycle(put, st) {
  const ang = -st.dist / 5, hub = [0, -5], cr = 1.8, wob = Math.sin(st.t * 2.6) * 1.2 + Math.sin(st.t * 7.1) * 0.4, m = st.mode;
  const th = m === 'air' || m === 'brake' ? Math.PI * 0.05 : st.dist / 5;
  const ped = (a) => [hub[0] + Math.cos(a) * cr, hub[1] + Math.sin(a) * cr], P1 = ped(th), P2 = ped(th + Math.PI);
  seg(put, hub, P2, 'g');
  wheel(put, 0, -5, 5, ang, true);
  const top = [wob * 0.2, -12];
  seg(put, hub, top, 'b'); seg(put, [0.5, -5], [top[0] + 0.5, -12], 'B'); rows(put, Math.round(top[0]) - 2, -13, ['ddddd']);
  let hip = [top[0], -13.5]; if (m === 'air') hip = [top[0], -14.5];
  const L1 = knee(hip, P1, 4.2, 4.2, true), L2 = knee(hip, P2, 4.2, 4.2, true);
  seg(put, hub, P1, 'g');
  if (m === 'wheelie') { const w = Math.sin(st.t * 11); return { hip, K: L1.K, F: L1.F, K2: L2.K, F2: L2.F, S: [hip[0] - 1.5, -18], G: [hip[0] + 2 + 3 * w, -23 + 2 * w], G2: [hip[0] - 5 - 2 * w, -21 - 3 * w], hd: [-1, 0] }; }   // leaning back, arms windmilling
  if (m === 'air' && st.flip) return { hip, K: L1.K, F: L1.F, K2: L2.K, F2: L2.F, S: [hip[0] + 1, -18.5], G: [hip[0] + 2, -13], G2: [hip[0] - 1, -13], hd: [0, 0] };   // a flip: hands on the seat, so it goes over his head
  if (m === 'air') return { hip, K: L1.K, F: L1.F, K2: L2.K, F2: L2.F, S: [hip[0], -19.5], G: [hip[0] + 4, -24], G2: [hip[0] - 4, -24], hd: [0, 0] };   // arms up
  if (m === 'brake') return { hip, K: L1.K, F: L1.F, K2: L2.K, F2: L2.F, S: [hip[0] + 2, -18], G: [hip[0] + 7, -16], G2: [hip[0] + 6, -14], hd: [1, 0] };   // pitched forward, arms out in front
  const S = [hip[0] + wob * 0.5, -18.5];
  return { hip, K: L1.K, F: L1.F, K2: L2.K, F2: L2.F, S, G: [S[0] + 5, S[1] + 1 - wob], G2: [S[0] - 5, S[1] + 1 + wob], hd: [0, 0] };
}
function skateboard(put, st) {
  const m = st.mode;
  rows(put, -6, -3, ['buuuuuuuuuub', '.BBBBBBBBBB.']); rows(put, -5, -1, ['.g......g.']);
  for (const wx of [-4, 4]) { put(wx - 1, -1, 'e'); put(wx, -1, 'e'); put(wx - 1, 0, 'e'); put(wx, 0, 'e'); put(wx + (Math.floor(-st.dist) & 1 ? -1 : 0), -1, 'g'); }
  let hip = [0, -10.5], S = [1, -15.5], back = [-3.5, -4], front = [2.5, -4], pushing = false, G = null, G2 = null;
  if (m === 'ride' && st.pushK !== undefined) {                       // a push: plant the back foot on the road, sweep it back, bring it forward again
    const p = st.pushK; pushing = true;
    if (p < 0.15) { const e = p / 0.15; back = [-3.5 + 2.5 * e, -4 + 4 * e]; }
    else if (p < 0.7) { const e = (p - 0.15) / 0.55; back = [-1 - 8 * e, 0]; }
    else { const e = (p - 0.7) / 0.3; back = [-9 + 5.5 * e, -2.5 * Math.sin(Math.PI * e) - 4 * e]; }
    const dip = p < 0.7 ? Math.sin(Math.PI * Math.min(1, p / 0.7)) : 0;
    hip = [0.5, -10 + 1.5 * dip]; S = [2.5, -14.8 + 1.2 * dip]; front = [2, -4];
  }
  if (m === 'wheelie') { hip = [-1, -10.5]; S = [-1.5, -15.5]; back = [-4.5, -4]; front = [1.5, -4]; G = [S[0] + 5, S[1] - 1]; G2 = [S[0] - 5, S[1] + 1]; }   // a manual: weight on the tail, arms out
  if (m === 'brake') { hip = [1, -10]; S = [3.5, -14.5]; front = [3, -4]; back = [-2.5, -4]; G = [S[0] + 5, S[1] + 2]; G2 = [S[0] + 3, S[1] + 4]; }   // weight over the nose
  if (m === 'air') { hip = [0, -11]; S = [1, -15.5]; back = [-3.5, -4]; front = [2.5, -4]; G = [S[0] + 4, S[1] - 2]; G2 = [S[0] - 4, S[1] - 1]; }   // knees tucked, the board stuck to his feet
  const Lf = knee(hip, front, 4.2, 4.2, true), Lb = knee(hip, back, 4.2, 4.2, pushing);
  return { hip, K: Lb.K, F: Lb.F, K2: Lf.K, F2: Lf.F, S, G: G || [S[0] + 3, S[1] + 4], G2: G2 || [S[0] - 3, S[1] + 4.5], hd: [0, 0] };
}

function planOf(parts) { const out = []; for (const p of parts) { if (p[0] === 'line') { const [, x0, x1, z0, z1, c] = p; for (let x = Math.round(x0); x <= Math.round(x1); x++) for (let z = z0; z <= z1; z++) out.push([x, z, typeof c === 'function' ? c(x, z) : c]); } else out.push(p); } return out; }
const PLANS = {
  super: planOf([['line', -10.5, -3.5, 0, 0, 'e'], ['line', 4, 11, 0, 0, 'e'], ['line', -11, -7, -1, 1, 'b'], ['line', -6, -3, -1, 1, 'd'],
    ['line', -2, 3, -2, 2, (x, z) => Math.abs(z) === 2 ? 'B' : 'b'], ['line', 4, 9, -2, 2, (x, z) => Math.abs(z) === 2 ? 'B' : 'b'], ['line', 6, 8, -1, 1, 'a'], ['line', 5, 5, -3, 3, 'd'], [10, 0, 'o']]),
  bicycle: planOf([['line', -10, -1, 0, 0, 'e'], ['line', 1, 10, 0, 0, 'e'], ['line', -5, 4, 0, 0, 'b'], ['line', -3.5, -1.5, 0, 0, 'd'], ['line', -3, -2, -1, 1, 'd'], ['line', 4, 4, -3, 3, 'd'], ['line', 0, 0, -2, 2, 'g']]),
  horse: planOf([['line', -9, 8, -3, 3, (x, z) => Math.abs(z) === 3 || (x / 9) ** 2 + (z / 3.4) ** 2 > 0.85 ? 'y' : 'H'], ['line', 6, 11, -1, 1, 'H'], ['line', 5, 10, 0, 0, 'z'], ['line', -12, -9, 0, 0, 'z'],
    ['line', -3, 2, -2, 2, (x, z) => Math.abs(z) === 2 ? 'B' : 'b']]),
  unicycle: planOf([['line', -5, 5, 0, 0, 'e'], ['line', -2, 2, 0, 0, 'd'], ['line', -1, 1, -1, 1, 'd'], ['line', 0, 0, -2, 2, 'g']]),
  skate: planOf([['line', -6, 5, -2, 2, (x, z) => Math.abs(z) === 2 || x === -6 || x === 5 ? 'B' : 'u']]),
  chopper: planOf([['line', -11.5, -4.5, 0, 0, 'e'], ['line', 6.5, 13.5, 0, 0, 'e'], ['line', -12, -5, 0, 0, (x) => x & 1 ? 'c' : 'X'], ['line', -6, -2, -1, 1, 'z'],
    ['line', -3, 3, -2, 2, (x, z) => (z + 2) & 1 ? 'c' : 'X'], ['line', 4, 6, -2, 2, (x, z) => (x + z) & 1 ? 'Q' : 'c'], ['line', 6, 10, -1, -1, 'h'], ['line', 6, 10, 1, 1, 'h'],
    ['line', 5, 5, -4, 4, 'h'], [5, -4, 'd'], [5, 4, 'd'], [7, 0, 'o'], ['line', -9, 1, 2, 2, 'h']])
};

// ---- in the game ----
// Each ride's fixed colours (the Workshop's EXTRA), under letters of their own, and the translation from its letters.
export const RIDE_PAL = { 1: '#c4ccd8', 2: '#a0602c', 3: '#6c3a18', 4: '#2c1c10', 5: '#fcd8a8', 6: '#e8e4dc' };   // grey, horse brown, its shade, mane and hooves, grip tape, stitching
const RIDE_LETTER = { h: '1', H: '2', y: '3', z: '4', u: '5', w: '6', Q: 'u' };   // (Q: the flag blue, which is the K_PAL u the America helmet uses)
// How each ride does each move: wheelie and stoppie pivots, how far it tips, what it shows over a jump and in a flip
// ('hang': he hangs from the bars, or the unicycle's seat, while it rolls over him; 'spin': the board turns under his
// feet). The look of a ride moves on in FRAMES steps over one loop of its motion (cycle: Kenney px of road, which
// differs by mode where the motion does; tCycle: seconds, for what moves with time rather than road); lamp: a headlight.
const RIDES = [
  { id: 'super', draw: superbike, rear: [-7, 0], front: [7.5, 0], box: [-11, -12, 11, 0], flip: 'hang', frames: 6, cycle: () => 2 * Math.PI * 3.5, tCycle: 1, lamp: [10, -7] },
  { id: 'chopper', draw: chopper, rear: [-8, 0], front: [10, 0], box: [-13, -19, 14, 0], flip: 'hang', frames: 2, cycle: () => 2 * Math.PI * 3.5 / 3, tCycle: 1, lamp: [7, -12] },
  { id: 'bicycle', draw: bicycle, rear: [-5.5, 0], front: [5.5, 0], box: [-10, -13, 10, 0], flip: 'hang', frames: 10, cycle: () => 2 * Math.PI * 6, tCycle: 1, lamp: null },
  { id: 'horse', draw: horse, rear: [-4, 0], front: [6, 0], box: [-12, -24, 15, 0], flip: 'hang', frames: 8, cycle: (m) => m === 'wheelie' ? 1 / (0.035 * 1.3) : 1 / 0.035, tCycle: 2 * Math.PI / 6, lamp: null },
  { id: 'unicycle', draw: unicycle, rear: [0, 0], front: [0, 0], box: [-5, -13, 5, 0], flip: 'hang', frames: 8, cycle: () => 2 * Math.PI * 5, tCycle: 2 * Math.PI / 2.6, lamp: null },
  { id: 'skate', draw: skateboard, rear: [-4, 0], front: [4, 0], box: [-6, -3, 6, 0], flip: 'spin', spinY: -2, frames: 8, cycle: () => 8, tCycle: 1, lamp: null, push: true }
];
for (const R of RIDES) R.plan = PLANS[R.id] || [];

// One frame of a ride: phase (0 .. frames-1) along its loop, in mode 'ride' | 'wheelie' | 'brake' | 'air' | 'stand' |
// 'crash'. Paints through put(x, y, letter) in the game's letters; returns the rider's joints (unrounded).
export function rideFrame(R, put, mode, phase, flip) {
  const u = phase / R.frames, st = { t: u * R.tCycle, dist: u * R.cycle(mode), sp: mode === 'stand' || mode === 'crash' ? 0 : 20, mode, flip: !!flip };
  if (R.push && mode === 'ride') st.pushK = u;                      // (the board: a push with the back foot, every loop)
  return R.draw((x, y, c) => put(x, y, RIDE_LETTER[c] || c), st);
}
const roundJ = (j) => { const o = {}; for (const k in j) o[k] = Array.isArray(j[k]) ? j[k].map(Math.round) : j[k]; return o; };
const paintMap = (R, mode, flip) => { const m = new Map(); const j = rideFrame(R, (x, y, c) => m.set(Math.round(x) + ',' + Math.round(y), c), mode, 0, flip); return { m, j }; };
// The bike flip, baked: the side picture (its near face) and the ride seen from above (its top, or underneath once it is
// past halfway) turned together about its long axis, nearest last; nine steps from upright to upside down (the
// Workshop's roll3d, on letters). axisK: the height it turns about (the bars, for 'hang').
function rollFrames(R, axisK) {
  const { m } = paintMap(R, 'air', R.flip === 'hang'), top = {}, bot = {}, side = [];
  for (const [k, c] of m) { const [x, y] = k.split(',').map(Number); top[x] = Math.min(top[x] ?? 99, y); bot[x] = Math.max(bot[x] ?? -99, y); side.push([x, y, c]); }
  const frames = [];
  for (let i = 0; i <= 8; i++) {
    const phi = Math.PI * i / 8, cp = Math.cos(phi), sp = Math.sin(phi), pts = side.map(([x, y, c]) => [x, y, cp >= 0 ? 1 : -1, c]);
    for (const [x, z, c] of R.plan) { const y = sp >= 0 ? top[x] : bot[x]; if (y !== undefined) pts.push([x, y, z, RIDE_LETTER[c] || c]); }
    const out = new Map();
    pts.map(([x, y, z, c]) => { const yr = y - axisK; return [x, Math.round(axisK + yr * cp + z * sp), -yr * sp + z * cp, c]; })
      .sort((a, b) => a[2] - b[2]).forEach(([x, y, , c]) => out.set(x + ',' + y, c));
    frames.push(out);
  }
  return frames;
}
// A letter map as K_BIKES rows: [first row's y, rows], each row starting at x0.
function toRows(m, x0) {
  let y0 = 1e9, y1 = -1e9, x1 = -1e9;
  for (const k of m.keys()) { const [x, y] = k.split(',').map(Number); y0 = Math.min(y0, y); y1 = Math.max(y1, y); x1 = Math.max(x1, x); }
  const rows = [];
  for (let y = y0; y <= y1; y++) { let r = ''; for (let x = x0; x <= x1; x++) r += m.get(x + ',' + y) || '.'; rows.push(r); }
  return [y0, rows];
}
// The rides as K_BIKES entries: what every other bike has (a still picture for EDIT PLAYER, the rider's joints at rest
// for the tricks, wheel spans for the wheelie pivot, nine flip frames) plus drawn: the ride itself, which the painter
// draws frame by frame (gfx/riderSprites.js).
export function rideBikes() {
  return RIDES.map((R) => {
    const still = paintMap(R, 'ride'), air = paintMap(R, 'air', R.flip === 'hang');
    const axisK = R.flip === 'hang' ? Math.round(air.j.G[1]) : R.spinY, flips = rollFrames(R, axisK);
    let x0 = 1e9; for (const m of [still.m, ...flips]) for (const k of m.keys()) x0 = Math.min(x0, Number(k.split(',')[0]));
    const [oy, grid] = toRows(still.m, x0);
    return {
      name: R.id.toUpperCase(), drawn: R, grid, ox: x0, oy, N: roundJ(still.j),
      wheels: [[R.rear[0] - 3 - x0, R.rear[0] + 3 - x0], [R.front[0] - 3 - x0, R.front[0] + 3 - x0]],
      flip: flips.map((m) => toRows(m, x0)),
      flipG: R.flip === 'hang' ? roundJ(air.j).G : null,             // where his hands are while it rolls over (the bars; the unicycle's seat)
      airJ: roundJ(air.j)                                            // ('spin': he stays on his feet while the board turns)
    };
  });
}
