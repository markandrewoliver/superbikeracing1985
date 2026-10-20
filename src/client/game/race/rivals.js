// The rival riders: lane choice, crashes and riding.

import { sfx } from '../audio/sound.js';
import { CRUISE0, G, LANES, PX_M } from '../core/config.js';
import { ATT, game, race, view } from '../core/state.js';
import { clamp, rnd } from '../core/util.js';
import { ghostTick } from '../modes/replay.js';
import { crash } from './crash.js';
import { bike, finishX, fx } from './session.js';
import { tooHigh } from '../rider/physics.js';
import { SURF } from '../world/settings.js';
import { hasElev, inDecal, laneSlope, loopAhead, loopEnter, loopExit, loopStep, slopeAt, terrain } from '../world/terrain.js';
import { riverAt, surfAt, world } from '../world/track.js';
import { boxAt, clearSpot, clearWreck, smashBox, traffic, vehicleAt, wreckAt } from '../world/traffic.js';

/* ---------- rival riders ---------- */
const RIVALS = [
  { name: 'VIOLET', theme: 1, skill: 0.95 },
  { name: 'GREEN', theme: 2, skill: 0.99 },
  { name: 'ORANGE', theme: 3, skill: 1.03 }
];
export const THEME_SUIT = ['#0058f8', '#6844fc', '#00a800', '#e45c10'];
export const bots = [];
export function resetBots(lanes) {
  bots.length = 0;
  RIVALS.forEach((r, i) => bots.push({
    name: r.name, theme: r.theme, skill: r.skill, x: race.startX, v: 0, lane: lanes[i], laneF: lanes[i], laneT: lanes[i],
    h: 0, hv: 0, vy: 0, grounded: true, angle: 0, rel: 0, wB: 0, wheelieT: 0, tStack: [], turbo: 0, mud: false,
    hits: new Set(), wobbleT: 0, hitCD: 0, think: rnd(0.3, 0.6), spin: 0, landT: 0, crash: null, done: 0, loop: null, loopDX: 0
  }));
}
function riderAheadIn(o, l, range) {
  for (const r of [bike, ...bots]) {
    if (r === o || (r.crash && r !== bike)) continue;
    if (Math.abs(r.laneF - l) < 0.5 && r.x > o.x - 20 && r.x < o.x + range) return true;
  }
  return false;
}
// lane choice: dodge mud, go for unclaimed turbo arrows, don't sit on someone's back wheel
function botChooseLane(o) {
  const look = 240 + o.v * 0.5;
  const score = (l) => {
    let sc = l === o.lane ? 0.6 : 0;
    if (l !== o.lane && (tooHigh(l, o.x, o.h) || tooHigh(l, o.x + 60, o.h))) return -1000;   // a wall
    if (l !== o.lane && terrain(l, o.x + 30) < o.h - 40) sc -= 3;   // a big drop: only if it's worth it
    for (const d of world.decals[l]) {
      if (d.x + d.w < o.x || d.x > o.x + look) continue;
      sc += d.type === 'mud' ? -3 : d.type === 'box' ? (d.hit ? 0 : -8) : (o.hits.has(d) ? 0 : 1.6 * o.skill);
    }
    if (riderAheadIn(o, l, 110)) sc -= 2;
    for (const q of traffic) if (Math.abs(q.laneF - l) < 0.9) {     // traffic: get out from behind it, and never swerve into it
      if (q.x + q.len > o.x - 50 && q.x < o.x + 60) sc -= 100;
      else if (q.x > o.x && q.x < o.x + look + 120) sc -= 5;
    }
    if (l !== o.lane) for (const r of [bike, ...bots]) {          // never swerve into a rider alongside
      if (r !== o && !(r !== bike && r.crash) && Math.abs(r.laneF - l) < 0.9 && Math.abs(r.x - o.x) < 60) sc -= 100;
    }
    const r = world.rivers.find(rv => rv.x > o.x && rv.x < o.x + 520 + o.v);    // a river ahead: be in a lane with a kicker (or one it doesn't cross)
    if (r) {
      let d = 9;
      for (let m = 0; m < LANES; m++) if (!world.rivers.some(rv => (rv.a === undefined || (m >= rv.a && m <= rv.b)) && rv.x < r.x + r.w + 10 && rv.x + rv.w > r.x - 10) || world.lanes[m].some(k => k.type === 'ramp' && Math.abs(k.x + k.w - (r.x - 4)) < 6)) d = Math.min(d, Math.abs(m - l));
      sc += 8 - 4 * d;                                          // pull toward the nearest lane with a kicker
    }
    return sc + rnd(-0.3, 0.3);
  };
  let bl = o.lane, bs = score(o.lane);
  for (const d of [-1, 1]) { const l = o.lane + d; if (l < 0 || l >= LANES) continue; const sc = score(l); if (sc > bs) { bs = sc; bl = l; } }
  o.laneT = bl;
}
export function botCrash(o, splash) {
  if (ATT.on && ATT.noBotCrash) return;
  o.crash = { t: 0, splash: splash ? riverAt(o.x, o.lane) : null, bodies: [
    { x: o.x, h: o.h, vx: o.v * 0.45, vy: Math.max(o.vy, 60), rot: o.angle, rv: 7 },
    { x: o.x, h: o.h + 14, vx: o.v * 0.62, vy: Math.max(o.vy, 0) + 110, rot: o.angle, rv: 10 }
  ] };
  o.tStack.length = 0; o.turbo = 0; o.wB = 0; o.wheelieT = 0; o.wobbleT = 0; o.laneF = o.laneT = o.lane; o.loop = null; o.loopDX = 0;
  if (Math.abs(o.x - view.camX) < 320) sfx('crash');
}
export function botCrashTick(o, dt) {
  const c = o.crash; c.t += dt;
  if (c.splash) { if (c.t > 1.9) { const bx = c.splash.x + c.splash.w + 30; o.resume = !!o.ghost; Object.assign(o, { crash: null, x: bx, v: 30, grounded: true, vy: 0, h: terrain(o.lane, bx), hv: terrain(o.lane, bx), angle: 0, rel: 0, mud: false, think: 0.2 }); } return; }
  if (c.ts === undefined) {                                      // tumbling, for as long as it takes
    let moving = false;
    for (const q of c.bodies) {
      q.vy -= G * dt; q.h += q.vy * dt; q.x += q.vx * dt; q.rot += q.rv * dt;
      const g = terrain(o.lane, q.x);
      if (q.h <= g) { q.h = g; if (q.vy < -30) q.vy *= -0.35; else q.vy = 0; q.vx *= Math.max(0, 1 - 2.6 * dt); q.rv *= Math.max(0, 1 - 3 * dt); }
      if (q.h > g + 0.5 || Math.abs(q.vx) > 45 || Math.abs(q.rv) > 3) moving = true;
    }
    clearWreck(c.bodies, o.lane);
    if ((!moving && c.t > 0.6) || c.t > 8) { c.ts = c.t; for (const q of c.bodies) { q.vx = q.vy = q.rv = 0; q.h = terrain(o.lane, q.x); } c.rot0 = c.bodies[0].rot; }
    return;
  }
  if (c.t - c.ts > 1.6) {
    o.resume = !!o.ghost;
    let bx = c.bodies[0].x; const rv = riverAt(bx, o.lane); if (rv) bx = rv.x + rv.w + 30;
    bx = clearSpot(bx, o.lane);
    Object.assign(o, { crash: null, x: bx, v: 30, grounded: true, vy: 0, h: terrain(o.lane, bx), hv: terrain(o.lane, bx), angle: slopeAt(o.lane, bx), rel: 0, mud: false, think: 0.2 });
  }
}
function botTick(o, dt) {
  if (o.ghost) { ghostTick(o, dt); return; }
  if (o.crash) { botCrashTick(o, dt); return; }
  const meters = Math.max(0, (o.x - race.startX) / PX_M);
  const sf = SURF[surfAt(o.x)];
  const cruise = (CRUISE0 + 70 * clamp(meters / 2500, 0, 1)) * sf.speed;
  if (o.laneF !== o.laneT) { const d = o.laneT - o.laneF; o.laneF += Math.sign(d) * Math.min(Math.abs(d), 7 * dt); }
  let lane = clamp(Math.round(o.laneF), 0, LANES - 1);
  if (lane !== o.lane && !o.loop && tooHigh(lane, o.x, o.h)) lane = o.laneT = o.laneF = o.lane;   // (they can't climb a wall either)
  const laneChanged = lane !== o.lane; o.lane = lane;
  if (o.loop) {
    const r = loopStep(o, dt);
    if (r === 'fall') { botCrash(o); return; }
    if (r === 'done') loopExit(o, o.lane);
    o.spin += o.v * dt / 7;
    if (o.loop) return;
  }
  o.think -= dt;
  if (o.think <= 0 && o.grounded && o.laneF === o.laneT && !o.done) { o.think = rnd(0.2, 0.45); botChooseLane(o); }

  const mud = o.grounded && inDecal(lane, o.x, 'mud');
  if (mud && !o.mud) o.v *= 0.72;
  o.mud = mud;
  if (o.grounded) for (const d of world.decals[lane]) {
    if (d.type === 'turbo' && !o.hits.has(d) && o.x >= d.x && o.x <= d.x + d.w) { o.hits.add(d); o.tStack.push(2.4); o.v += 55; }
  }
  if (o.wheelieT > 0) { o.wheelieT -= dt; o.wB = Math.min(110, o.wB + 90 * dt); }
  else { o.wB = Math.max(0, o.wB - 18 * dt); if (o.grounded && !mud && !o.done && Math.random() < dt * 0.12 * o.skill) o.wheelieT = rnd(0.8, 2.2); }
  let tb = 0;
  for (let i = o.tStack.length - 1; i >= 0; i--) { o.tStack[i] -= dt; if (o.tStack[i] <= 0) o.tStack.splice(i, 1); else tb += 100 * clamp(o.tStack[i] / 0.7, 0, 1); }
  o.turbo = o.tStack.length;
  let target = (cruise * o.skill + o.wB) * (mud ? 0.42 : 1) + tb;
  if (o.done) target = 110;
  else if (game.state !== 'finish') {                                  // keep the pack together: ease off when far ahead, push when far behind
    const gap = o.x - bike.x;
    if (gap > 650) target *= 0.92; else if (gap < -550) target *= 1.08;
  }
  const kb = !o.grounded ? 0.5 : (o.v > target && !mud && hasElev()) ? (laneSlope(o.lane, o.x) < -0.01 ? 0.6 : 1.6) : 2.6;
  o.v += (target - o.v) * Math.min(1, kb * dt);
  if (o.grounded && hasElev()) o.v = Math.max(20, o.v - 540 * Math.sin(laneSlope(o.lane, o.x)) * dt);
  o.v = Math.min(o.v, 700);

  const xPrev = o.x; o.x += o.v * dt;
  if (o.grounded) { const lo = loopAhead(lane, xPrev, o.x); if (lo) { o.laneF = o.laneT = lane; loopEnter(o, lo); return; } }
  const gNew = terrain(lane, o.x), gOld = terrain(lane, xPrev);
  if (o.grounded) {
    const pred = o.h + o.vy * dt - 0.5 * G * dt * dt;
    if ((!laneChanged && pred > gNew + 0.6) || (laneChanged && gNew < o.h - 6)) { if (laneChanged) o.vy = 0; o.grounded = false; o.airT = 0; o.h = Math.max(pred, gNew); o.vy = Math.min(o.vy, 560) - G * dt; o.wheelieT = 0; }
    else { o.h = gNew; o.vy = laneChanged ? 0 : (gNew - gOld) / dt; if (riverAt(o.x, lane)) { botCrash(o, true); return; } }
    o.rel += ((o.wheelieT > 0 ? 0.34 : 0) - o.rel) * Math.min(1, dt * 5);
    if (o.wobbleT > 0) {                                        // rattled after contact: thrashing, and likely to go down
      o.wobbleT -= dt; o.rel = 0.3 * Math.sin(race.raceT * 23 + o.theme) + rnd(-0.1, 0.1);
      if (Math.random() < dt * 1.0) { botCrash(o); return; }
    }
    o.angle = slopeAt(lane, o.x) + o.rel;
    if (o.wheelieT > 0 && Math.random() < dt * 0.02 * sf.pull) { botCrash(o); return; }
  } else {
    o.vy -= G * dt; o.h += o.vy * dt; o.airT = (o.airT || 0) + dt;
    const tf = Math.max(0.05, (o.vy + Math.sqrt(o.vy * o.vy + 2 * G * Math.max(0, o.h - gNew))) / G);
    o.angle += (slopeAt(lane, o.x + o.v * tf) + 0.08 - o.angle) * Math.min(1, dt * 3);   // level out for the landing
    if (o.h <= gNew) {
      if (riverAt(o.x, lane)) { botCrash(o, true); return; }
      const vLand = o.v;
      if (hasElev() && o.airT > 0.25) { const bs = laneSlope(lane, o.x); if (bs < -0.02) o.v = Math.max(o.v, o.v * Math.cos(bs) + o.vy * Math.sin(bs)); }
      o.h = gNew; o.grounded = true; o.vy = (gNew - gOld) / dt * Math.max(1, o.v / vLand); o.landT = 0.18; o.rel = o.angle - slopeAt(lane, o.x);
      if (o.airT > 0.4 && Math.random() < 0.05 * sf.pull / o.skill) { botCrash(o); return; }   // only real jumps are risky, not little hops
    }
  }
  o.hv = o.grounded ? o.hv + (o.h - o.hv) * Math.min(1, dt * 30) : o.h;
  o.landT = Math.max(0, o.landT - dt);
  o.spin += (o.grounded ? o.v : 90) * dt / 7;
  if (!o.done && o.x >= finishX()) o.done = race.raceT;
}
export function tickRivals(dt) {
  for (const o of bots) botTick(o, dt);
  // the rider behind backs off; the player crashes if they slam into a back wheel too fast
  for (const o of bots) {
    if (o.crash || !o.grounded || o.loop) continue;
    for (const r of [bike, ...bots]) {
      if (r === o || r.loop || (r !== bike && (r.crash || !r.grounded)) || (r === bike && game.state !== 'play')) continue;
      if (Math.abs(r.laneF - o.laneF) > 0.5) continue;
      const dx = r.x - o.x;
      if (dx > 0 && dx < 44 && o.v > r.v) { o.v = Math.max(40, r.v - 15); o.think = 0; }
    }
  }
  // contact with the player, from behind, in front or swiping across lanes: both riders get badly rattled
  for (const o of bots) {                                         // loose crates: a rival who hits one is thrown about like after a bump, and may go down
    if (o.crash || o.loop || (o.ghost && o.w > 0.5)) continue;
    const bx = boxAt(o.laneF, o.x, o.h); if (!bx) continue;
    smashBox(bx, Math.round(o.laneF)); o.v *= 0.8;
    if (Math.random() < 0.45) { botCrash(o); continue; } o.wobbleT = 1.2;
  }
  for (const o of bots) {                                         // ...and over a wreck, a rival barely notices
    if (o.crash || o.loop || (o.ghost && o.w > 0.5) || !o.grounded) continue;
    const wk = wreckAt(o.laneF, o.x); if (!wk) continue;
    o.jolts = o.jolts || new Set(); if (!o.jolts.has(wk)) { o.jolts.add(wk); o.v *= 0.985; }
  }
  if (game.state === 'play' && !bike.loop) {                            // ...and so are you: badly rattled, a big risk of going down
    const bx = boxAt(bike.laneF, bike.x, bike.h);
    if (bx) { smashBox(bx, Math.round(bike.laneF)); bike.v *= 0.82; fx.shake = Math.max(fx.shake, 4); rattle(); }
    const wk = bike.grounded ? wreckAt(bike.laneF, bike.x) : null;   // over the wreckage: a small jolt, once
    if (wk && !wk.jolted) { wk.jolted = true; bike.relVel += (Math.random() < 0.5 ? -1 : 1) * rnd(0.6, 1.0); bike.v *= 0.985; fx.shake = Math.max(fx.shake, 1.2); }
  }
  if (traffic.length) {                                           // traffic: brake behind it, and hitting it means going down
    for (const o of bots) {
      if (o.crash || o.loop || (o.ghost && o.w > 0.5)) continue;
      for (const q of traffic) if (o.grounded && Math.abs(q.laneF - o.laneF) < 0.7 && q.x - o.x > 0 && q.x - o.x < 90 && o.v > q.v) { o.v = Math.max(q.v - 10, 20); o.think = 0; }
      const hv = vehicleAt(o.laneF, o.x, o.h);
      if (hv) { botCrash(o); for (const q of o.crash.bodies) q.vx = Math.min(q.vx, hv.v * 0.5); }   // bounce off it: the vehicle pulls away from the wreck
    }
    const hv = game.state === 'play' && !bike.loop ? vehicleAt(bike.laneF, bike.x, bike.h) : null;
    if (hv) { crash('HIT A VEHICLE'); if (bike.crash) for (const q of bike.crash.bodies) q.vx = Math.min(q.vx, hv.v * 0.5); return; }   // bounce off it, so it drives on away from you
  }
  for (const o of bots) o.hitCD = Math.max(0, o.hitCD - dt);
  if (game.state !== 'play' || !bike.grounded || bike.loop) return;
  for (const o of bots) {
    if (o.crash || !o.grounded || o.loop || o.hitCD > 0 || Math.abs(o.laneF - bike.laneF) > 0.6) continue;
    const dx = o.x - bike.x;
    if (Math.abs(dx) > 40) continue;
    o.hitCD = 1.0; if (o.ghost) o.w = 0;                         // (a bumped ghost is off your line until he settles again)
    const rear = dx > 0 ? bike : o, front = dx > 0 ? o : bike, closing = rear.v - front.v;
    sfx('crash'); fx.shake = Math.max(fx.shake, 4);
    if (closing > 170) {                                         // ploughed straight into a back wheel
      if (rear === bike) { crash('HIT A RIDER'); return; }
      botCrash(o); rattle(); continue;
    }
    if (closing > 0) { rear.v = Math.max(40, front.v - 20); front.v += 15; }
    rattle();
    if (Math.random() < 0.45) botCrash(o); else o.wobbleT = 1.2;
  }
}
function rattle() {
  const b = bike;
  b.instab = Math.max(b.instab, 2.4);                            // tip-over point drops to its floor
  b.relVel += (Math.random() < 0.5 ? -1 : 1) * rnd(5.5, 7.5);
  b.shakeT = 1.5; b.kickT = Math.min(b.kickT, 0.15);
}
