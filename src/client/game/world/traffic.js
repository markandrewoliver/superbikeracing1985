// Street-race traffic: spawning, lane changes and braking, barricades, and keeping wrecks out from under cars.

import { CAR_SPRITES } from '../art/vehicles.js';
import { sfx } from '../audio/sound.js';
import { G, LANES, LANE_SY, PX_M, SC } from '../core/config.js';
import { game, race, view } from '../core/state.js';
import { clamp, pick, rint, rnd, seededRand } from '../core/util.js';
import { bots } from '../race/rivals.js';
import { bike, finishX, fx, genWith } from '../race/session.js';
import { genRow, inLanding } from './course.js';
import { terrain } from './terrain.js';
import { world } from './track.js';

// TRAFFIC: cars, vans and pickups heading the same way, slower than the bikes, so you come up on them from behind.
// Where they all are depends only on the race clock (never on the riders), so a ghost race meets the same traffic.
export const traffic = [];
export function spawnTraffic() {
  traffic.length = 0;
  if (race.trk.feature !== 'street') return;
  const r = seededRand(((race.trk.seed || 7) ^ 0x5bd1e995) >>> 0), R = (a, b) => a + (b - a) * r();
  const n = 6 * Math.round(race.raceM / 2000);                             // the same light traffic at any time of day (more road, more traffic)
  const L = race.raceM * PX_M, x0 = race.startX + 700, x1 = race.startX + 0.42 * L;   // anything starting further up the road would never be caught
  while (world.cursor < x1 + 1200) genWith(genRow);                  // lay the road first, so nothing starts parked in a crate
  for (let i = 0; i < n * 8 && traffic.length < n; i++) {
    const spr = Math.floor(r() * CAR_SPRITES.length), S = CAR_SPRITES[spr], len = S.w / SC, top = S.h / SC;   // size (and so what you can jump) comes from the sprite
    const x = R(x0, x1), lane = Math.floor(r() * LANES);
    if (traffic.some(o => o.lane === lane && Math.abs(o.x - x) < Math.max(o.len, len) + 80)) continue;
    if (vehBlocked({ x, len }, lane, 260)) continue;
    const v = R(60, 80) / 0.4;
    traffic.push({ kind: 'car', spr, x, v, vT: v, lane, laneF: lane, laneT: lane, len, top, roll: r() * 40, bph: r(), bper: R(1.6, 3.4) });   // (roll/bounce: just for looks)
  }
  traffic.sort((a, b) => b.x - a.x);
}
export const vehBlocked = (o, l, ahead) => inLanding(l, o.x - 10, o.x + o.len + ahead) || vehSolid(o, l, ahead);
const vehSolid = (o, l, ahead) => world.lanes[l].some(q => (q.type === 'ramp' || q.type === 'crate') && q.x + q.w > o.x - 10 && q.x < o.x + o.len + ahead) ||
  world.decals[l].some(q => q.type === 'box' && !q.hit && q.x + q.w > o.x - 10 && q.x < o.x + o.len + ahead);   // (a wreck they just drive over)
// room to pull into lane l: nobody alongside, nobody just ahead, and nobody coming up from behind too fast to stop
export const vehAlong = (o, l) => traffic.some(q => q !== o && (Math.abs(q.laneF - l) < 0.9 || q.laneT === l) &&
  q.x < o.x + o.len + 40 && q.x + q.len > o.x - 30 - q.v * 0.3 - (q.v * q.v) / 800);   // (whoever's behind can brake for us)
// Riders as the traffic sees them: where each one (or their wreck, and them walking back to it) is on the road.
function riderZones() {
  const z = [], add = (r, lane) => {
    if (r.crash) {
      let x0 = r.x, x1 = r.x; for (const q of r.crash.bodies) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); }
      if (r.crash.rx0 !== undefined) { x0 = Math.min(x0, r.crash.rx0); x1 = Math.max(x1, r.crash.rx0); }
      z.push({ l: lane, x0: x0 - 30, x1: x1 + 40, down: true, v: 0 });
    } else {
      z.push({ l: r.laneF, x0: r.x - 20, x1: r.x + 30, down: false, v: r.v });
      if (!r.grounded && !r.loop) {                                // in the air: keep clear of where they'll come down
        const g = terrain(Math.round(r.laneF), r.x), tf = (r.vy + Math.sqrt(Math.max(0, r.vy * r.vy + 2 * G * Math.max(0, r.h - g)))) / G, xl = r.x + r.v * tf;
        z.push({ l: Math.round(r.laneF), x0: xl - 50, x1: xl + 70, down: true, v: 0 });
      }
    }
  };
  if (game.state === 'play' || game.state === 'crash') add(bike, bike.crash ? bike.lane : bike.laneF);
  for (const o of bots) if (!o.done) add(o, o.crash ? o.lane : o.laneF);
  return z;
}
export function trafficTick(dt) {
  const riders = riderZones();
  for (const o of traffic) {                                       // front of the queue first, so followers see where leaders went
    const ahead = 160 + o.v * 2.5, front = o.x + o.len;
    const seen = riders.filter(r => r.x0 > front - 8);              // a driver only sees riders in front of the car, not one behind it or underneath
    const downIn = (l, reach) => seen.some(r => r.down && Math.abs(r.l - l) < 0.6 && r.x0 < front + reach);
    const riderIn = (l) => seen.some(r => Math.abs(r.l - l) < 0.9 && r.x0 < front + 40) ||
      riders.some(r => r.down && Math.abs(r.l - l) < 0.9 && r.x1 > o.x && r.x0 < front);   // (a wreck right beside you, you'd see too)
    // 1st: never into an obstacle. 2nd: keep clear of riders, above all one who's come off.
    const stuck = vehBlocked(o, o.lane, ahead), wreck = downIn(o.lane, ahead);
    if (o.laneF === o.laneT && (stuck || wreck)) {                 // something in the way: steer for the nearest clear lane
      let best = null;
      const cross = (k) => 2 + o.v * 0.75 * k;                       // how far it travels while drifting across k lanes (stopped: it just slides over)
      const pathFree = (l) => { const st = Math.sign(l - o.lane); for (let m = o.lane + st; m !== l + st; m += st) if (vehAlong(o, m) || riderIn(m) || (m !== l && vehSolid(o, m, cross(Math.abs(m - o.lane)))))   /* (just driving across a landing zone is fine) */ return false; return true; };
      const tiers = [(l) => !downIn(l, ahead)];
      for (const ok of tiers) for (let d = 1; d < LANES && best === null; d++) for (const l of [o.lane - d, o.lane + d]) if (best === null && l >= 0 && l < LANES && !vehBlocked(o, l, ahead) && ok(l) && pathFree(l)) best = l;
      if (best === null && stuck) for (let d = 1; d < LANES && best === null; d++) for (const l of [o.lane - d, o.lane + d]) if (best === null && l >= 0 && l < LANES && !vehBlocked(o, l, ahead) && pathFree(l)) best = l;
      if (best !== null) o.laneT = best;
    }
    if (o.laneF !== o.laneT) { const d = o.laneT - o.laneF; o.laneF += Math.sign(d) * Math.min(Math.abs(d), 1.4 * dt); o.lane = Math.round(o.laneF); }
    let want = o.vT;
    for (const q of traffic) {                                     // keep a safe gap to anyone ahead whose lane overlaps mine (or who's pulling into it)
      if (q === o || q.x < o.x) continue;
      const lo = Math.min(o.laneF, o.laneT), hi = Math.max(o.laneF, o.laneT), qlo = Math.min(q.laneF, q.laneT), qhi = Math.max(q.laneF, q.laneT);
      if (qlo > hi + 0.95 || qhi < lo - 0.95) continue;                // our paths (where we are to where we're heading) don't touch
      const gap = q.x - (o.x + o.len), safe = 16 + o.v * 0.5;
      if (gap < safe) want = Math.min(want, q.v * clamp((gap - 8) / (safe - 8), 0, 1));
    }
    for (const r of seen) {                                        // riders ahead: stop short of a wreck, and don't run down a slower rider
      const lo = Math.min(o.laneF, o.laneT), hi = Math.max(o.laneF, o.laneT);
      if (r.l < lo - 0.9 || r.l > hi + 0.9) continue;
      const gap = r.x0 - front - 10;
      if (r.down) { if (gap < 400) want = Math.min(want, Math.sqrt(2 * 300 * Math.max(0, gap))); }
      else if (r.v < o.v) { const safe = 16 + o.v * 0.5; if (gap < safe) want = Math.min(want, r.v * clamp((gap - 4) / (safe - 4), 0, 1)); }
    }
    {                                                              // never into an obstacle: brake to stop short of one in any lane we're (partly) in
      let gap = Infinity;
      const waiting = o.laneF === o.laneT && stuck;                 // can't get over yet: hold back short of the whole row, so there's room to pull across it later
      for (const l of waiting ? [0, 1, 2, 3] : new Set([Math.floor(o.laneF), Math.ceil(o.laneF), o.laneT])) for (const q of world.lanes[l].concat(world.decals[l])) if ((q.type === 'ramp' || q.type === 'crate' || (q.type === 'box' && !q.hit)) && q.x + q.w > o.x && (l === o.lane || q.x > front)) gap = Math.min(gap, q.x - front - (waiting && l !== o.lane ? 30 : 12));
      for (const z of world.landZones) if (z.x1 > o.x && z.x0 > front - 2) for (const l of waiting ? [0, 1, 2, 3] : new Set([Math.floor(o.laneF), Math.ceil(o.laneF), o.laneT])) if (l >= z.a && l <= z.b) gap = Math.min(gap, z.x0 - front - (waiting && l !== o.lane ? 30 : 12));
      if (gap < 400) want = Math.min(want, Math.sqrt(2 * 300 * Math.max(0, gap)));
    }
    o.v += clamp(want - o.v, -400 * dt, 60 * dt);
    o.x += o.v * dt; o.roll += o.v * dt;
  }
  traffic.sort((a, b) => b.x - a.x);
  for (let i = traffic.length - 1; i >= 0; i--) if (traffic[i].x > finishX() + 900) traffic.splice(i, 1);
}
// a rider (or wreck) inside a vehicle's outline: under its roof and overlapping its length, in its lane
const BOX_H = 28;                                                  // a barricade's height, in world units (14 px)
const barX = (o, l) => o.x - (4.5 + 9 * (o.b - l)) * 1.6;           // where lane l meets a barricade (it leans back across the lanes)
// the wreck of one, lying in the road: riding over it just jolts you a little
export function wreckAt(laneF, x) {
  const l = Math.round(laneF); if (Math.abs(laneF - l) > 0.4 || l < 0 || l >= LANES) return null;
  for (const o of world.decals[l]) if (o.type === 'box' && o.hit && x > barX(o, l) - 10 && x < o.x + 70) return o;
  return null;
}
export function boxAt(laneF, x, h) {
  const l = Math.round(laneF); if (Math.abs(laneF - l) > 0.4 || l < 0 || l >= LANES) return null;
  for (const o of world.decals[l]) if (o.type === 'box' && !o.hit) { const ox = barX(o, l); if (x + 24 > ox && x - 16 < ox + o.w && h < terrain(l, o.x) + BOX_H * o.n) return o; }
  return null;
}
export function smashBox(o, l) {                                          // bits everywhere; the wreck stays in the road
  o.hit = true; o.ht = race.raceT;
  if (Math.abs(o.x - view.camX) < 320) { sfx('crash'); for (let k = 0; k < 14 && fx.parts.length < 160; k++) fx.parts.push({ x: o.x + rnd(0, o.w), h: rnd(0, BOX_H * o.n), ly: LANE_SY[l], vx: rnd(-40, 160), vy: rnd(40, 150), t: 0, life: rnd(0.5, 0.9), s: rint(1, 3), c: pick(['#c03e41', '#f55c5c', '#ffffff', '#c8e0ff']) }); }
}
// A wreck can't lie under a car: anything that ends up inside one is knocked out behind its back bumper.
export function clearWreck(bodies, lane) {
  if (!traffic.length) return;
  for (const q of bodies) for (const v of traffic) {
    if (Math.abs(v.laneF - lane) > 0.6 || q.h > terrain(lane, v.x) + v.top) continue;
    const back = v.x - (q === bodies[0] ? 28 : 6);
    if (q.x > back && q.x < v.x + v.len) { q.x = back; q.vx = Math.min(q.vx, v.v * 0.5 - 20); }
  }
}
// where to get back on: never inside a vehicle (step back behind it)
export function clearSpot(x, lane) {
  for (let k = 0; k < 6; k++) { const v = vehicleAt(lane, x, terrain(lane, x)); if (!v) break; x = v.x - 30; }
  return x;
}
export function vehicleAt(laneF, x, h) {
  for (const o of traffic) if (Math.abs(laneF - o.laneF) < 0.6 && x + 26 > o.x && x - 18 < o.x + o.len && h < terrain(o.lane, o.x) + o.top) return o;
  return null;
}
