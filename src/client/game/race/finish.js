// Placings, crossing the line, and the run-out past it.

import { sfx } from '../audio/sound.js';
import { G } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, race, view } from '../core/state.js';
import { clamp, wrapPi } from '../core/util.js';
import { endStunt } from '../modes/stunt.js';
import { saveBest } from './play.js';
import { bots } from './rivals.js';
import { bike, burst, ensureWorld, fx, inp } from './session.js';
import { airRotation } from '../rider/air.js';
import { slopeAt, terrain } from '../world/terrain.js';

export function playerPlace() {
  let n = 1;
  for (const o of bots) {
    if (game.state === 'finish') { if (o.done && o.done < race.finishT) n++; }
    else if (o.done || o.x > bike.x) n++;
  }
  return n;
}
export function crossLine() {
  const b = bike;
  if (game.mode === 'stunt') { endStunt(); b.tStack.length = 0; b.turbo = 0; return; }
  game.state = 'finish'; game.stateT = 0; race.finishT = race.raceT; saveBest();
  b.tStack.length = 0; b.turbo = 0; b.wBoost = 0;
  const n = playerPlace();
  sfx('perfect');
}
export function tickFinish(dt) {                                         // past the line: hands off, but whatever you were doing plays out
  const b = bike, held = { back: inp.back, fwd: inp.fwd, up: inp.up, down: inp.down };
  if (b.crash) {                                                   // a wipeout over the line: it tumbles to a stop (your time already counts)
    for (const q of b.crash.bodies) {
      q.vy -= G * dt; q.h += q.vy * dt; q.x += q.vx * dt; q.rot += q.rv * dt;
      const g = terrain(b.lane, q.x);
      if (q.h <= g) { q.h = g; if (q.vy < -30) q.vy *= -0.35; else q.vy = 0; q.vx *= Math.max(0, 1 - 2.6 * dt); q.rv *= Math.max(0, 1 - 3 * dt); }
    }
    view.camX += (b.crash.bodies[0].x - view.camX) * Math.min(1, 3 * dt);
    return;
  }
  inp.back = inp.fwd = inp.up = inp.down = false;
  b.v += (100 - b.v) * Math.min(1, (b.grounded ? 1.2 : 0.15) * dt);
  const lane = b.lane, xPrev = b.x; b.x += b.v * dt;
  const gNew = terrain(lane, b.x), gOld = terrain(lane, xPrev);
  if (b.grounded) {
    const pred = b.h + b.vy * dt - 0.5 * G * dt * dt;
    if (pred > gNew + 0.6) { b.grounded = false; b.h = pred; b.vy -= G * dt; b.angVel = b.relVel; }
    else {
      b.h = gNew; b.vy = (gNew - gOld) / dt;
      b.slopeS += (slopeAt(lane, b.x) - b.slopeS) * Math.min(1, dt * 16);
      b.rel *= 1 - Math.min(1, dt * 4); b.relVel = 0; b.angle = b.slopeS + b.rel;
    }
  } else {
    b.vy -= G * dt; b.h += b.vy * dt;
    {                                                              // autopilot: lean (with no more than a player's own push) to meet the ground where it'll land
      const g0 = terrain(lane, b.x), tf = Math.max(0.05, (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 2 * G * Math.max(0, b.h - g0)))) / G);
      const err = wrapPi(b.angle - (slopeAt(lane, b.x + b.v * tf) + 0.1)), want = clamp(-err * Math.min(4, 2.2 / tf), -7, 7);
      if (b.angVel > want + 0.25) inp.fwd = true; else if (b.angVel < want - 0.25) inp.back = true;
    }
    airRotation(dt);                                               // spins keep spinning, stunts wind back in
    if (b.h <= gNew) {
      const diff = wrapPi(b.angle - slopeAt(lane, b.x));
      if (diff < -0.85 || diff > 1.15 || b.trick === 'invert' || (b.trick === 'superman' && b.trickP >= 0.98)) {   // botched it after the flag
        const dir = diff < 0 ? -1 : 1;
        b.h = gNew; b.crash = { why: 'AFTER THE FLAG', bodies: [
          { x: b.x, h: b.h, vx: b.v * 0.45, vy: Math.max(b.vy, 60), rot: b.angle, rv: dir * 7 },
          { x: b.x, h: b.h + 14, vx: b.v * 0.62, vy: Math.max(b.vy, 0) + 110, rot: b.angle, rv: dir * 10 }] };
        sfx('crash'); fx.shake = 8; burst(16, P.dust, 4, 20);
        Object.assign(inp, held); return;
      }
      b.h = gNew; b.grounded = true; b.vy = 0; b.slopeS = slopeAt(lane, b.x);
      b.rel = clamp(wrapPi(b.angle - b.slopeS), -0.6, 0.6); b.angVel = 0; b.trick = null; b.trickP = 0; b.landT = 0.2;
      sfx('land'); burst(8, P.dust, 1, -30);
    }
  }
  b.hv = b.grounded ? b.hv + (b.h - b.hv) * Math.min(1, dt * 30) : b.h;
  b.pivotT += ((b.grounded ? (b.rel > 0.04 ? 1 : b.rel < -0.04 ? -1 : 0) : 0) - b.pivotT) * Math.min(1, dt * 12);
  b.landT = Math.max(0, b.landT - dt);
  b.spin += (b.grounded ? b.v : 90) * dt / 7; b.lean = 0;
  view.camX = b.x; ensureWorld();
  Object.assign(inp, held);
}
