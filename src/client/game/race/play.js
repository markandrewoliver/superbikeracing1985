// One step of riding: the player's bike through a frame of play, and saving a best time.

import { sfx } from '../audio/sound.js';
import { BIKE_SX, CRUISE0, G, LANES, PX_M, SC, VMAX, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, race, view } from '../core/state.js';
import { clamp, pick } from '../core/util.js';
import { stuntOnTrack } from '../gfx/road.js';
import { ed, saveSlots } from '../modes/builder.js';
import { STUNT_DROP2_X, STUNT_DW, STUNT_DW2, STUNT_LEDGE, placeStuntJump2, stuntJump1End, stuntLastX, stuntTrack } from '../modes/stunt.js';
import { crash } from './crash.js';
import { crossLine } from './finish.js';
import { bike, burst, finishX, fx, inp } from './session.js';
import { airRotation, landBike } from '../rider/air.js';
import { checkTurbo, groundRotation, hitMud, takeoff, tooHigh } from '../rider/physics.js';
import { HADO_CHARGE, HADO_DASH, HADO_V, headstandTick, marioTick, redeemerTick } from '../rider/secretMoves.js';
import { SURF } from '../world/settings.js';
import { hasElev, inDecal, laneSlope, loopAhead, loopCatch, loopContact, loopEnter, loopExit, loopStep, terrain } from '../world/terrain.js';
import { riverAt, surfAt } from '../world/track.js';

export function tickPlay(dt) {
  const b = bike;
  redeemerTick(dt); headstandTick(dt); marioTick(dt);
  if (b.hado && b.hado.t >= HADO_CHARGE && !b.grounded) view.camLag = Math.min(220, view.camLag + b.v * dt * 0.6); else view.camLag *= Math.max(0, 1 - dt * 2.5);
  const meters = Math.max(0, (b.x - race.startX) / PX_M);
  race.maxMeters = Math.max(race.maxMeters, meters);
  const surf = surfAt(b.x);
  b.surf = surf;
  const cruise = (CRUISE0 + 70 * clamp(meters / 2500, 0, 1)) * SURF[surf].speed;

  if (b.laneF !== b.laneT) { const d = b.laneT - b.laneF; b.laneF += Math.sign(d) * Math.min(Math.abs(d), 7 * dt); }
  let lane = clamp(Math.round(b.laneF), 0, LANES - 1);
  if (lane !== b.lane && !b.loop && tooHigh(lane, b.x, b.h)) { lane = b.laneT = b.laneF = b.lane; sfx('land'); fx.shake = Math.max(fx.shake, 2); }   // the ground rose too high on the way across: back you go
  const laneChanged = lane !== b.lane; b.lane = lane;
  if (game.mode === 'stunt' && b.grounded && !b.loop && !stuntOnTrack(b.laneT, b.x)) {   // on the grass (flew clean over a loop): ease back onto the track
    const t = stuntTrack.find(t => b.x >= t.x0 && b.x < t.x1);
    if (t) b.laneT = b.laneT < t.pair ? t.pair : t.pair + 1;
  }
  if (b.loop) {                                                     // riding the loop: no steering, just hang on
    const r = loopStep(b, dt);
    if (r === 'fall') { crash('FELL OFF THE LOOP'); return; }
    if (r === 'done') loopExit(b, b.lane);
    b.spin += b.v * dt / 7; b.landT = Math.max(0, b.landT - dt);
    if (b.loop) return;
  }

  const mud = b.grounded && inDecal(lane, b.x, 'mud');
  if (mud && !b.wasMud) hitMud();
  b.wasMud = mud;
  let target = Math.max(70, (cruise + b.wBoost) * (mud ? 0.42 : 1) - (b.grounded ? 400 * Math.max(0, -b.rel) : 0));   // nose-down drags you back
  let tb = 0;
  for (let i = b.tStack.length - 1; i >= 0; i--) {
    b.tStack[i] -= dt;
    if (b.tStack[i] <= 0) b.tStack.splice(i, 1); else tb += 100 * clamp(b.tStack[i] / 0.7, 0, 1);
  }
  b.turbo = b.tStack.length ? Math.max(...b.tStack) : 0; b.tb = tb; target = Math.min(target + tb, VMAX);
  const kb = !b.grounded ? 0.5 : (b.v > target && !mud && b.rel > -0.15 && hasElev()) ? (laneSlope(b.lane, b.x) < -0.01 || game.mode === 'stunt' ? 0.6 : 1.6) : 2.6;   // hold descent speed, then let it go on the flat   // extra speed from a descent fades slowly
  b.v += (target - b.v) * Math.min(1, kb * dt);
  if (b.grounded && hasElev()) b.v = Math.max(20, b.v - 540 * Math.sin(laneSlope(b.lane, b.x)) * dt);   // mountain slopes: downhill speeds you up, climbing slows you
  b.v = Math.min(b.v, VMAX); race.topSpeed = Math.max(race.topSpeed, b.v);
  if (game.tut && game.tut.exiting) b.v = Math.min(b.v, Math.sqrt(Math.max(0, 2 * 260 * (game.tut.stopX - b.x))));   // how to play, leaving by an EXIT lane: brake to a stop at the line

  if (b.hado && b.hado.t >= HADO_CHARGE && !b.grounded) b.v = Math.max(20, HADO_V * Math.cos(b.angle));   // HADOUKEN: firing off whichever way it points (400 kph)
  const xPrev = b.x; b.x += b.v * dt;
  if (b.x >= finishX()) { crossLine(); return; }
  if (b.grounded) { const lo = loopAhead(lane, xPrev, b.x); if (lo) { b.laneF = b.laneT = lane; loopEnter(b, lo); return; } }
  if (game.mode === 'stunt' && !game.stuntJump2 && b.x > stuntJump1End + 120) {   // down from the first jump: wait until the bike has settled
    const settled = b.grounded && !b.loop && Math.abs(b.rel) < 0.15 && Math.abs(b.relVel) < 1;
    if (b.grounded) b.downT = (b.downT || 0) + dt;                       // time on the ground since the first touch
    b.stableT = settled ? (b.stableT || 0) + dt : 0;
  }
  if (game.mode === 'stunt' && !game.stuntJump2 && b.x > stuntJump1End + 120 && b.grounded && (b.stableT >= 0.75 || b.downT >= 4)) {   // settled (or long enough): the second jump goes in
    game.stuntJump2 = true;
    const hillEnd = race.startX + STUNT_DROP2_X + STUNT_LEDGE * STUNT_DW2, drop = 3 * STUNT_DW + 10;
    const x2 = Math.max(b.x + (W - BIKE_SX) / SC + 60, hillEnd + 20);   // just off screen (never on the landing hill's slope)
    placeStuntJump2(x2);
  }
  if (game.mode === 'stunt' && !game.stuntLineSet && b.grounded && b.x > stuntLastX + 120) {   // back down after the last jump: the line appears just off screen
    game.stuntLineSet = true; race.raceM = (b.x + (W - BIKE_SX) / SC + 40 - race.startX) / PX_M;
  }
  if (b.grounded) checkTurbo(lane);

  const gNew = terrain(lane, b.x), gOld = terrain(lane, xPrev);
  if (b.grounded) {
    const pred = b.h + b.vy * dt - 0.5 * G * dt * dt;      // where a free-flying bike would be
    if (!laneChanged && pred > gNew + 0.6) takeoff(pred, dt);   // ground fell away faster than gravity: launch
    else if (laneChanged && gNew < b.h - 6) { b.vy = 0; takeoff(b.h, dt); }   // stepped off the edge into a lower lane: you fall
    else {
      b.h = gNew; b.vy = laneChanged ? 0 : (gNew - gOld) / dt;
      if (riverAt(b.x, lane)) { crash('SPLASH'); return; }
      groundRotation(dt, lane); if (game.state !== 'play') return;
    }
  } else {
    const hPrev = b.h;
    if (game.tut && game.tut.stage === 'air') { b.vy += ((game.tut.hoverH - b.h) * 3 - b.vy) * Math.min(1, dt * 4); b.h += b.vy * dt; b.airT = (b.airT || 0) + dt; }   // how to play: hang in the sky
    else if (b.hado && b.hado.t >= HADO_CHARGE) { b.vy = HADO_V * Math.sin(b.angle); b.h += b.vy * dt; b.airT = (b.airT || 0) + dt; }   // firing: dead straight
    else { b.vy -= G * dt; b.h += b.vy * dt; b.airT = (b.airT || 0) + dt; }
    if (b.hado) { b.hado.t += dt; if (b.hado.t >= HADO_CHARGE + HADO_DASH) { const s = b.hado.s0; b.v = Math.max(20, s * Math.cos(b.angle)); b.vy = s * Math.sin(b.angle); b.hado = null; } }   // done: back to the speed it went in with, the way it's pointing
    airRotation(dt); if (game.state !== 'play') return;
    if (game.mode === 'stunt') {
      const c = loopContact(lane, xPrev, hPrev, b.x, b.h);
      if (c) { if (c.top) crash('LANDED ON THE LOOP'); else loopCatch(c.o, c.th, lane); return; }
    }
    if (b.h <= gNew) { if (riverAt(b.x, lane)) { crash('SPLASH'); return; } landBike(lane, gNew, gOld, dt); if (game.state !== 'play') return; }
  }

  // visuals
  b.hv = b.grounded ? b.hv + (b.h - b.hv) * Math.min(1, dt * 30) : b.h;
  b.pivotT += ((b.grounded ? (b.rel > 0.04 ? 1 : b.rel < -0.04 ? -1 : 0) : 0) - b.pivotT) * Math.min(1, dt * 12);   // rear wheel pivot, or front wheel when nose-down
  b.landT = Math.max(0, b.landT - dt);
  b.spin += (b.grounded ? b.v : 90) * dt / 7;
  b.lean += ((inp.fwd ? 1 : inp.back ? -1 : 0) - b.lean) * Math.min(1, dt * 10);
  if (b.grounded && b.v > 40) {
    fx.acc += dt * b.v / 14;
    while (fx.acc > 1) { fx.acc -= 1; burst(1, mud ? P.mud2 : P.dust, 1, -b.v * 0.25); }
  }
  if (b.turbo > 0 && Math.random() < dt * 60) burst(1, pick([P.turbo, P.orange, P.cream]), 8, -b.v * 0.5);
}

export function saveBest() {
  if (ed.fromBuilder) { if (!ed.t.best || race.finishT < ed.t.best) { ed.t.best = race.finishT; saveSlots(); } return; }
  if (!race.best || race.finishT < race.best) { race.best = race.finishT; try { localStorage.setItem('four-lane-scramble-best-time', String(race.best)); } catch (e) {} }
}
export const fmtTime = (t) => { const m = Math.floor(t / 60), sec = t - m * 60; return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1); };
export const ordinal = (n) => n + (['ST', 'ND', 'RD', 'TH'][Math.min(n, 4) - 1]);
