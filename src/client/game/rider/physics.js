// Bike physics on the ground: lane changes, mud, turbos, take-off, wheelies and tilt, and the two held air stunts.

import { sfx } from '../audio/sound.js';
import { CRUISE0, G, LANES, STUNTS } from '../core/config.js';
import { P } from '../core/palette.js';
import { game } from '../core/state.js';
import { clamp, lerp, rnd } from '../core/util.js';
import { tutAllow } from '../modes/tutorial.js';
import { crash } from '../race/crash.js';
import { bike, burst, fx, inp } from '../race/session.js';
import { TRICK_HOLD, creditPose } from './air.js';
import { RDM_SHAKE, RDM_SQ, RDM_SQF, hstUp, rdmLvl, rdmOn, redeemerFall } from './secretMoves.js';
import { SURF } from '../world/settings.js';
import { slopeAt, terrain } from '../world/terrain.js';
import { surfAt, world } from '../world/track.js';

/* ---------- bike physics ---------- */
// Changing lanes onto higher ground: a step up of about one level (a climb, a hill) you can ride up onto, but
// anything much taller is a wall. Changing onto lower ground drops you off the edge.
const UP_MAX = 80;
export const tooHigh = (l, x, h) => terrain(l, x) - h > UP_MAX;
export function laneMove(dir) {
  if (game.state !== 'play' || !bike.grounded || bike.loop) return;          // lanes only change on the ground
  if (game.tut && (game.tut.exiting || !tutAllow()[dir < 0 ? 'up' : 'down'])) return;
  if (game.tut && game.tut.jump && dir < 0 && bike.laneT === 1 && bike.x > game.tut.jump.lx - 360 && bike.x < game.tut.jump.lx) return;   // how to play: the loop goes in from the second lane
  const lo = game.mode === 'stunt' ? (bike.laneT < 2 ? 0 : 2) : 0, n = clamp(bike.laneT + dir, lo, game.mode === 'stunt' ? lo + 1 : LANES - 1);
  if (n !== bike.laneT && (tooHigh(n, bike.x, bike.h) || tooHigh(n, bike.x + bike.v * 0.15, bike.h))) { sfx('land'); fx.shake = Math.max(fx.shake, 2); return; }   // a wall: can't get up there
  if (n !== bike.laneT) { bike.laneT = n; sfx('lane'); }
}

export function hitMud() {
  const b = bike;
  b.v *= 0.72; b.relVel -= 1.0;                                        // the jolt pitches the nose down
  sfx('mud'); fx.shake = Math.max(fx.shake, 3);
  burst(14, P.mud2, 2, -40);
}
export function pushTurbo(scale) {                               // every turbo adds its own +100 that fades after 2.4 s; they stack
  scale = scale === undefined ? 1 : scale;                 // a partial boost (sloppy trick landing) is shorter and smaller
  const b = bike, d = 0.35 + 2.05 * scale; b.tStack.push(d); b.turbo = Math.max(b.turbo, d); b.v += 55 * scale;
  return b.tStack.length;
}
export function checkTurbo(lane) {
  const b = bike;
  for (const o of world.decals[lane]) {
    if (o.type === 'turbo' && !o.hit && b.x >= o.x && b.x <= o.x + o.w) {
      const n = pushTurbo(); o.hit = true; b.instab = Math.max(b.instab, 0.3); b.relVel += 0.5; b.kickT = Math.max(b.kickT, 1.6);
      sfx('turbo'); fx.shake = Math.max(fx.shake, 2);
    }
  }
}

export function takeoff(pred, dt) {
  const b = bike;
  b.grounded = false; b.airT = 0; b.h = pred; b.vy = Math.min(b.vy, 560) - G * dt;     // launch speed is capped so extreme speeds don't fire you into orbit
  b.angVel = b.relVel; b.airRot = 0; b.flips = 0;
  b.trick = null; b.trickP = 0; b.trickHold = 0; b.trickBank = 0; b.trickLock = inp.up || inp.down;   // a press must start in the air
  b.flipAcc = 0; b.trickSet = {}; b.trickNamed = false; b.airPts = 0;                                  // distinct tricks this jump (they multiply the boost)
  b.rdmAir = 0; if (b.rdm) b.rdm.rot = 0; b.hadoUsed = false;
}

// rel = pitch relative to the ground: + nose up (wheelie), - nose down (forward wheelie / endo)
export function groundRotation(dt, lane) {
  const b = bike, ib = inp.back && !b.noCtl, ifw = inp.fwd && !b.noCtl;   // (no hands on the bars: no control)
  const slope = slopeAt(lane, b.x);
  b.slopeS += (slope - b.slopeS) * Math.min(1, dt * 16);
  const speedN = Math.max(0, (b.v - (CRUISE0 - 10)) / 140);   // no ceiling: instability keeps growing with speed
  const sp = Math.max(0, (b.v - (CRUISE0 - 10)) / 200);       // how far above the default speed you are
  const tq = Math.min(0.8 + 1.5 * speedN + b.instab, 5);
  b.thr = clamp(0.66 - 0.13 * (tq - 1), 0.26, 0.66);         // back tip angle shrinks as you go faster
  b.thrF = 0.5;                                              // forward tip angle
  if (b.shakeT > 0) { b.thr *= 0.6; b.thrF = 0.3; }            // rattled: it takes far less to go over either way
  b.thr += 1.3 / 9; b.thrF += 1.0 / 9;                        // a little more slack: tip points sit one gauge square further out
  if (rdmOn(b)) { b.thr -= RDM_SQ; b.thrF -= RDM_SQF; }        // up on his head: one square less
  if (hstUp(b.hst)) { b.thr -= 2 * 1.3 / 9; b.thrF -= 2 * 1.0 / 9; }   // HEADSTAND: two squares less
  let acc = 0;
  if (ib) acc += 6.5;
  if (ifw) acc -= 9;
  const ease = b.turbo > 0 ? lerp(0.5, 1, clamp((b.v - 450) / 300, 0, 1)) : 1;                        // turbo speed is borrowed, so it pulls back only half as hard
  const sf = SURF[surfAt(b.x)];
  const backF = clamp(b.rel / 0.08, 0, 1);                  // speed only pulls the nose up once you're already tilted back
  acc += 1.6 * Math.min(sp, 1.5) * ease * sf.pull * backF;          // the faster you go, the harder the engine pulls the nose up (up to a point: past ~220 kph it pulls no harder, so a clean landing at any speed can still be ridden out)
  if (b.wasMud) acc -= 1.5;                                  // wallowing in mud pitches the nose down
  b.kickT -= dt;
  if (b.kickT <= 0) {                                        // involuntary back tilts: bigger and more frequent with speed
    b.kickT = rnd(0.9, 1.6) / (0.4 + Math.min(sp, 3));
    if (sp > 0.12 && backF > 0) b.relVel += (0.5 + Math.min(sp, 1.6) + 0.25 * Math.max(0, sp - 1.6)) * rnd(0.7, 1.2) * ease * sf.pull * backF;
  }
  if (b.shakeT > 0) { b.shakeT -= dt; b.relVel += rnd(-1, 1) * 11 * Math.sqrt(dt); }   // rattled after contact
  if (rdmLvl(b)) b.relVel += rnd(-1, 1) * RDM_SHAKE[rdmLvl(b)] * Math.sqrt(dt);   // REDEEMER held too long: he's shaking it
  b.bumpT -= dt;
  if (sf.bump && b.bumpT <= 0) { b.bumpT = rnd(0.35, 0.9); b.relVel += sf.bump * rnd(-1, 1.2); }   // ruts and slides knock you either way
  if (b.rel > 0) {
    acc -= 9.0 * b.rel;                                      // gravity settles the front wheel...
    if (b.rel > b.thr) acc += 18 * tq * (b.rel - b.thr);     // ...until past the tip point, then it runs away
  } else if (b.rel < 0) {
    acc += 9.0 * -b.rel;                                     // same for the rear wheel when nose-down
    if (-b.rel > b.thrF) acc -= 18 * (-b.rel - b.thrF);
  }
  const damp = (!ib && !ifw && Math.abs(b.rel) < 0.2) ? 7 : 4.5;   // hands off near level: the suspension settles quickly
  b.relVel += acc * dt; b.relVel *= 1 - damp * dt; b.rel += b.relVel * dt;
  if (game.tut && game.tut.stage === 'nice') { const r = clamp(b.rel, -0.35, 0.4); if (r !== b.rel) { b.rel = r; b.relVel = 0; } }   // ...and the bike stays upright
  if (b.rdm && b.rdm.p > 0.5 && (b.rel > 1.0 || b.rel < -0.75)) { redeemerFall(b.rel > 0 ? 1 : -1); return; }
  if (hstUp(b.hst) && (b.rel > 1.0 || b.rel < -0.75)) { redeemerFall(b.rel > 0 ? 1 : -1, 'hst'); return; }   // up on his head, the bike tipping over: he comes off (see redeemerFall)
  if (b.rel > 1.3) { crash('FLIPPED BACK'); return; }
  if (b.rel < -1.0) { crash('FLIPPED FORWARD'); return; }
  b.angle = b.slopeS + b.rel; b.angVel = b.relVel;
  b.instab = Math.max(0, b.instab - 0.55 * dt);

  // Speed comes from tilting back on purpose; tilting forward slows you (see tickPlay).
  // Fixing a back tilt never costs speed; boost only bleeds off slowly.
  // The tilt counts as "on purpose" while you hold Back, and for a moment after you let off to save it.
  if (ib && b.rel > 0.1) b.manualT = 0.45; else b.manualT = Math.max(0, b.manualT - dt);
  const manual = b.manualT > 0 && b.rel > 0.15;
  const correcting = (ifw && b.rel > 0.02) || (ib && b.rel < -0.02);
  if (manual) {
    b.wheelT += dt;
    const rdmM = rdmOn(b) ? 2 : 1;                                     // (a wheelie in a Redeemer pays double)
    b.wBoost = Math.min(130 * rdmM, b.wBoost + 110 * rdmM * clamp((Math.abs(b.rel) - 0.1) / 0.45, 0, 1.2) * dt);
  } else {
    b.wheelT = 0;
    if (!correcting) b.wBoost = Math.max(0, b.wBoost - 18 * dt);   // fixing a tilt freezes your boost instead of costing it
  }
}
export function airStunts(dt) {
  const b = bike;
  if (b.trickLock && !inp.up && !inp.down) b.trickLock = false;
  const want = b.trickLock ? null : inp.up ? 'superman' : inp.down ? 'invert' : null;
  if (!b.trick && want) { b.trick = want; b.trickP = 0; b.trickHold = 0; b.trickT = 0; b.trickNamed = false; b.trickSpun = false; sfx('lane'); }
  if (!b.trick) return;
  const T = STUNTS[b.trick];
  if (want === b.trick) {
    b.trickP = Math.min(1, b.trickP + dt / T.tin); if (b.trickP >= 1) b.trickHold += dt;
    if (b.trickHold >= TRICK_HOLD && Math.abs(b.angVel) < 2.5) creditPose(b);   // it counts (and gets called out) once held in the full pose for half a second...
    // ...unless you're spinning: then it's waiting to see if it becomes a SUPERMAN SPIN (or BIKE FLIP SPIN) instead
  }
  else {
    b.trickP = Math.max(0, b.trickP - dt / T.tout);
    if (b.trickP <= 0) { creditPose(b); b.trickBank += b.trickHold * T.rate; b.trick = null; b.trickHold = 0; }   // back on: the stunt is banked
  }
}
