// Coming off: the crash itself, the bike and rider tumbling apart, and getting back on.

import { sfx } from '../audio/sound.js';
import { BIG_CRASH_M, BIKE_SX, G, PX_M, SC, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { ATT, game, race, view } from '../core/state.js';
import { clamp, rnd, wrapPi } from '../core/util.js';
import { endStunt } from '../modes/stunt.js';
import { bike, burst, fx, laneYNow, resetBike } from './session.js';
import { FALL_KIND, scrW } from '../rider/secretMoves.js';
import { slopeAt, terrain } from '../world/terrain.js';
import { riverAt } from '../world/track.js';
import { clearSpot, clearWreck } from '../world/traffic.js';

function hingeTick(c, dt) {
  const q0 = c.bodies[0], q1 = c.bodies[1], H = c.hinge, lane = bike.lane;
  // the bike
  const g0 = terrain(lane, q0.x), sl = slopeAt(lane, q0.x);
  if (!H.air && !H.free) {                                         // still tipping on one wheel: it turns about that wheel
    const off = [H.piv, 0], before = scrW(off, q0.rot);
    H.rel = clamp(H.rel + q0.rv * dt, -1.3, 1.4); q0.rv += (H.dir * 5.5 - q0.rv) * Math.min(1, dt * 6);
    q0.rot = sl + H.rel; const after = scrW(off, q0.rot);
    q0.x += q0.vx * dt + (before[0] - after[0]) / SC; q0.h = g0 + Math.max(0, -(before[1] - after[1]) / SC + (q0.h - g0));
    q0.vx = Math.max(0, q0.vx - 60 * dt);
  } else if (q0.ground) {                                            // riderless on the road: back down on its wheels, coasting to a stop
    q0.rv += (-wrapPi(q0.rot - sl) * 30 - q0.rv * 6) * dt; q0.rot += q0.rv * dt;
    q0.vx = Math.max(0, q0.vx - 220 * dt); q0.x += q0.vx * dt;
    q0.h = g0 + Math.abs(Math.sin(q0.rot - sl)) * 20;
  } else {                                                          // flying on
    q0.vy -= G * dt; q0.x += q0.vx * dt; q0.h += q0.vy * dt; q0.rot += q0.rv * dt;
    if (q0.h <= g0) { q0.h = g0; if (q0.vy < -120) { q0.vy *= -0.25; q0.rv *= 0.3; } else { q0.vy = 0; q0.ground = true; } if (!c.bikeHit) { c.bikeHit = true; sfx('land'); } }
  }
  // him
  if (!H.free) {
    const psi = q0.rot - sl * 0 + H.phi;                           // how far his body leans from straight up (+ = back)
    H.w += (14 * Math.sin(psi) - 1.2 * H.w) * dt; H.phi += H.w * dt;
    const FK = FALL_KIND[H.kind], cr = scrW(FK.piv, q0.rot); H.cx = q0.x + cr[0] / SC; H.ch = q0.h - cr[1] / SC; H.pa = q0.rot + H.phi;
    if (Math.abs(H.pa - (H.air ? 0 : sl)) > (H.air ? 1.6 : 1.45)) {      // past the point of no return: he slides off the seat
      H.free = true; H.vx = H.air ? q0.vx * 0.15 : q0.vx * 0.5 - H.dir * 44; H.vy = H.air ? Math.min(0, q0.vy * 0.3) - 40 : -20; H.va = (q0.rv + H.w) * 0.35;
      if (!H.air) q0.ground = true;
    }
  } else if (!H.landed) {                                           // dropping like a sack
    H.vy -= G * dt; H.cx += H.vx * dt; H.ch += H.vy * dt; H.pa += H.va * dt; H.vx *= 1 - dt * 0.8;
    const FK = FALL_KIND[H.kind], m = scrW([FK.com[0] - FK.piv[0], FK.com[1] - FK.piv[1]], H.pa), mx = H.cx + m[0] / SC, mh = H.ch - m[1] / SC;
    if (mh <= terrain(lane, mx) + 10) {                              // flat on his back: one small, heavy bump and a puff of dust
      H.landed = true; H.landT = game.stateT; q1.x = mx; q1.h = terrain(lane, mx); q1.vy = 110; q1.vx = H.vx * 0.3; c.lieM = H.pa < 0 ? -1 : 1; H.la = Math.abs(H.pa) * c.lieM;   // (lies on his back, head the way he went over)
      fx.shake = Math.max(fx.shake, 1.5); sfx('land');
      for (let k = 0; k < 7; k++) fx.parts.push({ x: mx + rnd(-10, 10), h: q1.h + 1, ly: laneYNow(), vx: rnd(-45, 45), vy: rnd(15, 50), t: 0, life: rnd(0.3, 0.5), s: 1, c: P.dust });
    }
  } else {                                                          // lying there (after the bump)
    const gq = terrain(lane, q1.x);
    q1.vy -= G * dt; q1.h += q1.vy * dt; if (q1.h <= gq) { q1.h = gq; q1.vy = 0; }
    q1.vx *= Math.max(0, 1 - dt * 4); q1.x += q1.vx * dt;
    H.la += (Math.PI / 2 * c.lieM - H.la) * Math.min(1, dt * 12);   // settling flat on his back
  }
  // settled: on to getting up
  const still = H.landed && q1.vy === 0 && Math.abs(q1.vx) < 5 && q0.ground && q0.vx < 5 && Math.abs(q0.rv) < 0.5;
  if ((still && game.stateT > 0.6) || game.stateT > 6) {
    if (!H.landed) { H.landed = true; H.landT = game.stateT; q1.x = H.cx; c.lieM = 1; H.la = Math.PI / 2; }
    if (bigThrow(c.x0, q1.x)) race.bigCrashes++;
    c.t0 = game.stateT; for (const q of c.bodies) { q.vx = 0; q.vy = 0; q.rv = 0; q.h = terrain(lane, q.x); }
    q0.rot = slopeAt(lane, q0.x); q1.rot = Math.PI / 2;
    const edgeR = view.camX + (W + 16 - BIKE_SX) / SC, edgeL = view.camX - (BIKE_SX + 16) / SC;   // (as in any wipeout: out of shot, he's already up and walks straight back in)
    if (q1.x > edgeR || q1.x < edgeL) { c.offR = q1.x > edgeR ? 1 : -1; q1.x = c.offR > 0 ? q0.x + (W + 16 - BIKE_SX) / SC : q0.x - (BIKE_SX + 16) / SC; c.t0 = game.stateT - (CR.lie + CR.sit + CR.stand); }
    c.rx0 = q1.x; c.rot0 = q0.rot; c.rrot0 = q1.rot; c.tx = q0.x - 13;
    c.dw = clamp(Math.abs(c.tx - q1.x) / (c.offR ? 250 : 140), 0.3, 12);
  }
  view.camX += (q0.x - view.camX) * Math.min(1, 3 * dt);                    // the camera stays on the bike, as in any wipeout
}

// Where a tumbling body would come to rest, run on with the tumble's own physics (for one thrown out of shot, which
// stops being moved at the screen edge).
function restX(q, lane) {
  const p = { ...q }, dt = 1 / 60;
  for (let k = 0; k < 8 * 60; k++) {
    p.vy -= G * dt; p.h += p.vy * dt; p.x += p.vx * dt;
    const g = terrain(lane, p.x);
    if (p.h <= g) { p.h = g; if (p.vy < -30) p.vy *= -0.35; else p.vy = 0; p.vx *= Math.max(0, 1 - 2.6 * dt); }
    if (p.h <= g + 0.5 && Math.abs(p.vx) <= 45) break;
  }
  return p.x;
}
// A big crash: the rider came to rest BIG_CRASH_M or more from where he came off.
export const bigThrow = (x0, x1) => Math.abs(x1 - x0) >= BIG_CRASH_M * PX_M;

export function crash(why, quiet) {
  if (ATT.on && ATT.noCrash && game.state === 'play') return;           // (the intro video: no crashing)
  const b = bike;
  if (game.tut && game.tut.stage === 'nice') { b.hst = null; b.rdm = null; if (b.mario) { b.mario = null; b.noCtl = false; } return; }   // how to play: you've landed it; nothing knocks you off now (a secret move just ends)
  if (game.mode === 'stunt') { game.stuntScore = 0; b.airPts = 0; }          // a wipeout at any point loses the lot
  const inRdm = !!(b.rdm && b.rdm.p > 0.5), mj = b.mario && b.mario.phase === 'jump' ? { h: b.mario.h, vy: b.mario.vy, dx: b.mario.dx, vx: b.mario.vx, a: b.mario.a } : null;   // (SUPER MARIO: he's up in the air off the bike)
  game.state = 'crash'; game.stateT = 0; fx.shake = quiet ? 0 : 8; sfx('crash'); race.crashes++; b.rdm = null; b.hado = null; b.hst = null; b.mario = null; b.noCtl = false; view.camX = b.x - view.camLag; view.camLag = 0;
  const dir = (why === 'NOSE DIVE' || why === 'FLIPPED FORWARD') ? -1 : 1;     // tumble the way you fell
  const back = why === 'FLIPPED BACK' && b.grounded && !inRdm && !mj;               // looped a wheelie: the over-the-back fall (see tickCrash)
  b.crash = back ? {
    why, slip: 0.13, flat: true,                                   // he rides it over for a moment, then slips off the back
    bodies: [
      { x: b.x, h: b.h, vx: b.v * 0.45, vy: 0, rot: b.angle, rv: 4.5 },
      { x: b.x, h: b.h, vx: 0, vy: 0, rot: b.angle, rv: 0 }
    ]
  } : {
    why,
    bodies: [
      { x: b.x, h: b.h, vx: b.v * 0.45, vy: Math.max(b.vy, 60), rot: b.angle, rv: dir * 7 },
      { x: b.x, h: b.h + 14, vx: b.v * 0.62, vy: Math.max(b.vy, 0) + 110, rot: b.angle, rv: dir * 10 }
    ]
  };
  b.crash.x0 = b.x;
  if (inRdm) { b.crash.rdmFall = true; Object.assign(b.crash.bodies[1], { h: b.h, vx: b.v * 0.5, vy: Math.max(b.vy, 0) + 60, rot: b.angle, rv: dir * 3 }); }   // he goes over from his Redeemer
  if (mj) Object.assign(b.crash.bodies[1], { x: b.x + mj.dx, h: mj.h, vx: b.v * 0.62 + mj.vx, vy: mj.vy, rot: mj.a, rv: dir * 2.5 });   // he wasn't on it: he just carries on from where he is and comes down
  if (why === 'SPLASH') { b.crash.splash = riverAt(b.x, b.lane); b.crash.t = 0; sfx('mud'); return; }
  if (!quiet) burst(16, P.dust, 4, 20);
}
// After a wipeout the rider tumbles, lies dazed, sits up, stands, walks back to the bike, hauls it upright and
// remounts. The race is on hold the whole time, then you set off again from a near standstill.
export const CR = { lie: 0.3, sit: 0.2, stand: 0.14, lift: 0.5, mount: 0.3 };
export function crashPhases(c) {
  const t0 = CR.lie + CR.sit + CR.stand;
  return { tWalk: t0, tLift: t0 + c.dw, tMount: t0 + c.dw + CR.lift, tEnd: t0 + c.dw + CR.lift + CR.mount };
}
function remount() {
  const c = bike.crash, lane = bike.lane;
  let bx = c.bodies[0].x; const r = riverAt(bx, lane); if (r) bx = r.x + r.w + 30;
  bx = clearSpot(bx, lane);
  resetBike(bx, 30, lane); view.camX = bx; game.state = 'play'; game.stateT = 0;
  bike.h = bike.hv = terrain(lane, bx); bike.angle = bike.slopeS = slopeAt(lane, bx);
  sfx('land');
}
export function tickCrash(dt) {
  const c = bike.crash; if (!c) return;
  const q0 = c.bodies[0], q1 = c.bodies[1];
  if (c.hinge && c.t0 === undefined) { hingeTick(c, dt); return; }   // off a Redeemer: the limp fall
  if (c.splash) {                                               // sank: fish the bike out on the far bank
    c.t += dt;
    if (c.t > 1.7) { q0.x = c.splash.x + c.splash.w + 30; remount(); }
    view.camX += (q0.x - view.camX) * Math.min(1, 3 * dt);
    return;
  }
  if (c.slip > 0) {                                            // over the back: bike and rider rotate up on the rear wheel together
    c.slip -= dt;
    q0.x += q0.vx * dt; q0.rot += q0.rv * dt; q0.h = terrain(bike.lane, q0.x);
    view.camX += (q0.x - view.camX) * Math.min(1, 3 * dt);
    if (c.slip <= 0) {                                          // ...and he slips off: from where his seat is, falling back and flat
      const a = q0.rot, ca = Math.cos(a), sa = Math.sin(a), px = -7;                  // the bike was drawn pivoting on its rear wheel
      const hipX = px + 2 * ca - 11 * sa, hipY = -2 * sa - 11 * ca;                    // the seat on screen, relative to the bike's drawn anchor
      q1.x = q0.x + hipX / SC; q1.h = q0.h - hipY / SC - 24;
      q1.rot = a; q1.vx = q0.vx * 0.15; q1.vy = 20;
      const tf = Math.sqrt(2 * Math.max(10, q1.h - terrain(bike.lane, q1.x) + 24) / G);
      q1.rv = (Math.PI / 2 - a) / Math.max(0.15, tf);           // turns flat on his back as he drops
      q0.x += (px - px * ca) / SC; q0.h -= (px * sa) / SC;     // the riderless bike carries on from exactly where it was drawn
      q0.vy = 40; q0.rv = 6;
    }
    return;
  }
  if (c.t0 === undefined) {                                    // tumbling
    let moving = false;
    const edgeR = view.camX + (W + 16 - BIKE_SX) / SC, edgeL = view.camX - (BIKE_SX + 16) / SC;   // just past the screen edges
    if (!c.offR && (q1.x > edgeR || q1.x < edgeL)) { c.offR = q1.x > edgeR ? 1 : -1; c.restX = restX(q1, bike.lane); q1.vx = q1.vy = q1.rv = 0; }   // flew out of shot: he'll walk back in
    if (c.offR) { q1.x = c.offR > 0 ? Math.max(q1.x, edgeR) : Math.min(q1.x, edgeL); q1.h = terrain(bike.lane, q1.x); }
    for (const q of c.bodies) {
      if (q === q1 && c.offR) continue;
      q.vy -= G * dt; q.h += q.vy * dt; q.x += q.vx * dt; q.rot += q.rv * dt;
      if (game.tut && game.tut.rampX !== null && q.x > game.tut.rampX - 30 && q.x - q.vx * dt <= game.tut.rampX - 30) { q.x = game.tut.rampX - 30; q.vx = 0; }   // how to play: the wreck stops against the ramp, so it's still ahead of you
      const g = terrain(bike.lane, q.x);
      if (q.h <= g) {
        if (q === q1 && c.flat) { q.h = g; q.vy = 0; q.vx *= 0.2; q.rot = Math.PI / 2; q.rv = 0; }   // lands flat on his back and stays there
        else { q.h = g; if (q.vy < -30) q.vy *= -0.35; else q.vy = 0;
        q.vx *= Math.max(0, 1 - 2.6 * dt); q.rv *= Math.max(0, 1 - 3 * dt); }
      }
      if (q.h > g + 0.5 || Math.abs(q.vx) > 45 || Math.abs(q.rv) > 3) moving = true;
    }
    clearWreck(c.bodies, bike.lane);
    if ((!moving && game.stateT > 0.6) || game.stateT > 8) {                 // let the wipeout play out until it all comes to rest
      c.t0 = game.stateT;
      if (bigThrow(c.x0, c.offR ? c.restX : q1.x)) race.bigCrashes++;
      for (const q of c.bodies) { q.vx = 0; q.vy = 0; q.rv = 0; q.h = terrain(bike.lane, q.x); }
      if (c.offR) {                                              // already up off-camera: he comes walking straight back in
        q1.x = c.offR > 0 ? q0.x + (W + 16 - BIKE_SX) / SC : q0.x - (BIKE_SX + 16) / SC;
        c.t0 = game.stateT - (CR.lie + CR.sit + CR.stand);
      }
      c.rx0 = q1.x; c.rot0 = q0.rot; c.rrot0 = q1.rot;
      c.tx = q0.x - 13;                                       // stand behind the saddle
      c.dw = clamp(Math.abs(c.tx - q1.x) / (c.offR ? 250 : 140), 0.3, 12);   // hurries back in when he flew out of shot            // he walks the whole way back, however far he flew
    }
  } else if (game.mode === 'stunt') { if (game.state === 'crash') endStunt(); return; }
  else if (game.stateT - c.t0 > crashPhases(c).tEnd) remount();
  view.camX += (q0.x - view.camX) * Math.min(1, 3 * dt);                    // the camera stays on the bike
}
