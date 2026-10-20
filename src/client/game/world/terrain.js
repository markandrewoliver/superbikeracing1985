// Ground height: hill and ramp profiles, the stacked elevation curve, lane shelves, and the loop-the-loop.

import { G } from '../core/config.js';
import { game, race } from '../core/state.js';
import { clamp, wrapPi } from '../core/util.js';
import { crash } from '../race/crash.js';
import { bike } from '../race/session.js';
import { landPayout } from '../rider/air.js';
import { world } from './track.js';

export function profile(o, x) {
  const t = (x - o.x) / o.w;
  if (t < 0 || t > 1) return 0;
  if (o.type === 'base' || o.type === 'loop') return 0;
  if (o.type === 'shelf') return shelfH(o, x);   // the mountain is drawn from baseAt(); a loop has no ground of its own
  if (o.type === 'crate') return o.h;                      // a stack of wooden crates: flat top, sheer sides
  if (o.type === 'hill') {                       // eased sides with an optional flat top (mesa) in between
    const d = x - o.x, up = o.up || o.w / 2, dn = o.dn || o.w / 2, r = o.w - d;
    if (d < up) return o.h * (0.5 - 0.5 * Math.cos(Math.PI * d / up));
    if (r < dn) return o.h * (0.5 - 0.5 * Math.cos(Math.PI * r / dn));
    return o.h;
  }
  return o.h * Math.pow(t, 1.35);               // ramp: climbs, then drops off a cliff at t > 1
}
// Base elevation: climbs and drops (track-wide, all lanes) stack up into mountains; everything else sits on top.
// Stacked climbs/drops are joined into one smooth curve (monotone cubic through the segment ends), so a run of
// climbs is a single steady slope instead of a staircase of humps that kept bouncing the bike into the air.
let elevKnots = []; race.elevN = -1;
export function knotsOf(segs) {                                             // segment list -> height knots, with eased tangents
  const K = []; let h = 0;
  for (const e of segs) {
    if (!K.length || Math.abs(K[K.length - 1].x - e.x) > 0.5) K.push({ x: e.x, h });
    h += e.dh; K.push({ x: e.x + e.w, h });
  }
  return tangents(K);
}
function tangents(K) {
  const d = []; for (let i = 0; i + 1 < K.length; i++) d.push((K[i + 1].h - K[i].h) / (K[i + 1].x - K[i].x));
  for (let i = 0; i < K.length; i++) {
    const a = i > 0 ? d[i - 1] : 0, b = i < d.length ? d[i] : 0;
    K[i].m = (a * b <= 0) ? 0 : Math.sign(a) * Math.min(Math.abs(a + b) / 2, 3 * Math.abs(a), 3 * Math.abs(b));
  }
  return K;
}
function curveAt(K, x) {
  if (!K.length || x <= K[0].x) return K.length ? K[0].h : 0;
  if (x >= K[K.length - 1].x) return K[K.length - 1].h;
  let lo = 0, hi = K.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (K[mid].x <= x) lo = mid; else hi = mid; }
  const A = K[lo], B = K[hi], w = B.x - A.x, t = (x - A.x) / w, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * A.h + (t3 - 2 * t2 + t) * w * A.m + (-2 * t3 + 3 * t2) * B.h + (t3 - t2) * w * B.m;
}
function elevCurve() {
  if (race.elevN === world.elev.length) return elevKnots;
  elevKnots = knotsOf(world.elev); race.elevN = world.elev.length; return elevKnots;
}
export function baseAt(x) {
  if (!world.elev.length) return 0;
  return curveAt(elevCurve(), x);
}
// A climb or drop on only some lanes: that lane's own ground level, as a raised shelf over the shared base (the
// base being whichever lane is lowest), so the lanes can part ways and meet again.
function shelfH(o, x) { const d = curveAt(o.K, x) + o.off - baseAt(x); return d > 0.5 ? d : 0; }
export function laneBase(l, x) {                                            // ground level in lane l before any obstacles
  let h = baseAt(x); const o = world.shelf && world.shelf[l];
  if (o && x >= o.x) h += shelfH(o, x);
  return h;
}
export const hasElev = () => world.elev.length > 0 || !!world.shelf;
export const laneSlope = (l, x) => Math.atan2(laneBase(l, x) - laneBase(l, x - 6), 6);
const baseSlope = (x) => Math.atan2(baseAt(x) - baseAt(x - 6), 6);
// Pieces in a lane stack: anything placed on top of another piece sits on it, so their heights add.
export function terrain(l, x) {
  const a = world.lanes[l]; let m = world.elev.length ? baseAt(x) : 0;
  for (let i = 0; i < a.length; i++) {
    const o = a[i];
    if (x < o.x || x > o.x + o.w) continue;
    m += profile(o, x);
  }
  return m;
}
// how much stacked under piece o (from earlier pieces in this lane) at x: what it sits on
const sameShape = (q, o) => q.type === o.type && q.x === o.x && q.w === o.w && q.h === o.h;
export function stackUnder(l, o, x) {
  const a = world.lanes[l];
  let stop = a.indexOf(o);
  if (stop < 0) {                                                  // a block spanning lanes: find this lane's matching copy (the same one in the stack)
    const home = world.lanes[o.a === undefined ? l : o.a] || a, k = home.filter(q => sameShape(q, o)).indexOf(o);
    let seen = -1; stop = a.findIndex(q => sameShape(q, o) && ++seen === Math.max(0, k));
    if (stop < 0) stop = a.length;
  }
  let u = 0;
  for (let i = 0; i < stop; i++) { const q = a[i]; if (x >= q.x && x <= q.x + q.w) u += profile(q, x); }
  return u;
}
export function slopeAt(l, x) {
  return clamp(Math.atan2(terrain(l, x) - terrain(l, x - 6), 6), -0.95, 0.95);
}
// LOOP-THE-LOOP: a ring of track you ride round on the inside. It has no ground profile; a rider who reaches its
// entry on the ground follows the ring (gravity bleeds speed on the way up) and comes out the far side, or falls
// off at the top if they came in too slow. o.x = entry, o.w = how far along the exit is, o.R = radius.
export const LOOP_R = 104, LOOP_D = 208;
export const loopDrift = (th) => (1 - Math.cos(th / 2)) / 2;            // 0 at the entry, 1 at the exit: how far across the deck has slid
export const loopPt = (o, th) => ({ x: o.x + o.w * th / (2 * Math.PI) + o.R * Math.sin(th), h: o.R * (1 - Math.cos(th)) });
export const loopAng = (o, th) => Math.atan2(o.R * Math.sin(th), o.w / (2 * Math.PI) + o.R * Math.cos(th));
export function loopAhead(l, x0, x1) {
  for (const o of world.lanes[l]) if (o.type === 'loop' && x0 < o.x && x1 >= o.x) return o;
  return null;
}
export const loopBase = (o) => laneBase(o.a, o.x);
export function loopEnter(r, o) { r.loop = { o, th: 0, base: loopBase(o), l0: r.lane }; r.x = o.x; r.loopDX = 0; r.rel = 0; r.relVel = 0; r.vy = 0; r.h = r.hv = r.loop.base; }
export function loopStep(r, dt) {                                    // returns 'fall', 'done' or null
  const L = r.loop, o = L.o, R = o.R, th = L.th;
  const dx = o.w / (2 * Math.PI) + R * Math.cos(th), dy = R * Math.sin(th), ddx = -R * Math.sin(th), ddy = R * Math.cos(th);
  const sp = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  r.v -= G * Math.sin(ang) * dt;                              // climbing the ring costs speed, coming down gives it back
  const kap = (dx * ddy - dy * ddx) / (sp * sp * sp);
  if (r.v < 25 || r.v * r.v * kap + G * Math.cos(ang) < 0) {   // too slow to stay pressed against the track
    r.lane = r.laneT = Math.round(r.laneF); r.laneF = r.lane;
    r.x += r.loopDX; r.loopDX = 0; r.vy = r.v * Math.sin(ang); r.v = r.v * Math.cos(ang); r.angle = ang; r.loop = null; r.grounded = false;
    return 'fall';
  }
  L.th += r.v * dt / sp;
  if (L.th >= 2 * Math.PI) { r.x = o.x + o.w; r.loopDX = 0; r.loop = null; r.lane = r.laneT = r.laneF = L.l0 - o.shift; return 'done'; }   // out the far side, lanes over
  r.laneT = L.l0 - o.shift; r.laneF = L.l0 - o.shift * loopDrift(L.th);
  const p = loopPt(o, L.th), t = L.th;
  r.x = o.x + o.w * t / (2 * Math.PI); r.loopDX = p.x - r.x; r.h = r.hv = L.base + p.h;
  r.angle = loopAng(o, t);
  return null;
}
export function addLoop(x, a, b, shift, join) {                         // a ring on lanes a..b that comes out `shift` lanes further back (negative: nearer)
  for (let l = a; l <= b; l++) world.lanes[l].push({ type: 'loop', x, w: LOOP_D, R: LOOP_R, a, b, shift, join, full: true });
}
// Airborne near a loop: has the bike just met the inside of its rising curve? A low arrival meets it at the entry
// (an ordinary landing); a higher one meets it further round, where the bike has to match the curve's angle.
// Coming down onto it from above the top is a crash; flying clean over it is fine.
export function loopContact(lane, x0, h0, x1, h1) {
  for (const o of world.lanes[lane]) {
    if (o.type !== 'loop' || x1 < o.x - 4 || x0 > o.x + o.w) continue;
    const base = loopBase(o), a0 = h0 - base, a1 = h1 - base, top = 2 * o.R;
    if (a1 > top) continue;                                          // still above the ring
    if (a0 > top && x1 > o.x + 0.75 * o.w - o.R && x1 < o.x + 0.25 * o.w + o.R) return { o, top: true };   // came down onto the top of the ring
    const thAt = (a) => Math.acos(clamp(1 - Math.max(0, Math.min(a, top)) / o.R, -1, 1));
    const th = thAt(a1), xr = loopPt(o, th).x, xr0 = loopPt(o, thAt(a0)).x;
    if (x0 < xr0 && x1 >= xr) return { o, th };
  }
  return null;
}
export function loopCatch(o, th, lane) {
  const b = bike, wallAng = loopAng(o, th), diff = wrapPi(b.angle - wallAng);
  const vt = Math.hypot(b.v, b.vy) * 0.9;                            // matching the curve carries your speed round with you (a little lost on contact)
  if (b.trick === 'invert') { crash('LANDED UPSIDE DOWN'); return; }
  if (b.trick === 'superman' && b.trickP >= 0.98) { crash('OFF THE BIKE'); return; }
  if (diff < -0.85 || diff > 1.15) { crash('HIT THE LOOP'); return; }
  b.v = Math.max(0, vt); b.slopeS = wallAng; b.grounded = true;
  landPayout(diff);
  if (game.state !== 'play') return;
  const base = loopBase(o), p = loopPt(o, th);
  b.loop = { o, th, base, l0: lane }; b.laneF = b.laneT = lane; b.hst = null; b.mario = null; b.noCtl = false;   // (no HEADSTAND or SUPER MARIO round a loop)
  b.x = o.x + o.w * th / (2 * Math.PI); b.loopDX = p.x - b.x; b.h = b.hv = base + p.h;
  b.angle = wallAng; b.rel = 0; b.relVel = 0; b.vy = 0; b.angVel = 0;
}
export function loopExit(r, lane) {
  r.h = r.hv = terrain(lane, r.x); r.angle = slopeAt(lane, r.x); r.slopeS = r.angle; r.rel = 0; r.relVel = 0; r.vy = 0; r.grounded = true;
}
export function inDecal(l, x, type) {
  const a = world.decals[l];
  for (let i = 0; i < a.length; i++) { const o = a[i]; if (o.type === type && x >= o.x && x <= o.x + o.w) return true; }
  return false;
}
