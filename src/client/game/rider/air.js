// In the air: rotation and flips, naming tricks, and landing (clean, sketchy or a crash).

import { sfx } from '../audio/sound.js';
import { STUNTS } from '../core/config.js';
import { P } from '../core/palette.js';
import { game } from '../core/state.js';
import { clamp, pick, wrapPi } from '../core/util.js';
import { stuntAirPoints } from '../modes/stunt.js';
import { crash } from '../race/crash.js';
import { bike, burst, fx, inp, popup } from '../race/session.js';
import { airStunts, pushTurbo } from './physics.js';
import { RDM_RATE, hstUp, rdmOn, redeemerFall } from './secretMoves.js';
import { hasElev, laneSlope, slopeAt } from '../world/terrain.js';

export function airRotation(dt) {
  const b = bike;
  if (b.hado) { b.angVel = 0; return; }                          // gathering or firing: no turning, no tricks (and it isn't a trick itself)
  if (rdmOn(b)) {                                                   // up on his head: no other tricks, and it counts once held half a second
    b.trickBank += dt * RDM_RATE; b.rdmAir = (b.rdmAir || 0) + dt;
    if (b.rdmAir >= TRICK_HOLD && b.trickSet && !b.trickSet.redeemer) b.trickSet.redeemer = 1;
  }
  if (b.rdm || b.hst || b.mario) b.trickLock = true;
  airStunts(dt);
  if (game.mode === 'stunt' && game.state === 'play') stuntAirPoints(dt);
  b.wBoost = Math.max(0, b.wBoost - 18 * dt);
  let a = 0; if (inp.back && !b.noCtl) a += 13; if (inp.fwd && !b.noCtl) a -= 13;
  b.angVel += a * dt;
  b.angVel *= 1 - (a !== 0 ? 0.3 : 1.8) * dt;
  b.angVel = clamp(b.angVel, -9, 9);
  b.angle += b.angVel * dt; b.airRot += b.angVel * dt;
  if (b.hst) { b.hst.rot += b.angVel * dt; if (hstUp(b.hst) && (b.hst.over || Math.abs(b.hst.rot) >= Math.PI / 2)) { redeemerFall(b.hst.over || (b.hst.rot > 0 ? 1 : -1), 'hst'); return; } }   // HEADSTAND: turned 90 degrees (he hangs on while his hands are on the bars, and goes the moment they let go)
  if (b.rdm) { b.rdm.rot += b.angVel * dt; if (b.rdm.p > 0.5 && Math.abs(b.rdm.rot) >= 1.2) { redeemerFall(b.rdm.rot > 0 ? 1 : -1); return; } }   // (his body starts to go over; by 90 degrees he's off)
  b.flipAcc += b.angVel * dt;                                      // each full turn either way is a flip (a hair under counts)
  const FULL = 2 * Math.PI - 0.5;
  // A full turn made mostly in a pose is its own move: the pose (from the moment you go into it) has to cover two thirds of the turn's time.
  if (Math.abs(b.angVel) < 1) { b.rotT = 0; b.rotPose = {}; }        // not really turning: start over
  b.rotT = (b.rotT || 0) + dt; b.rotPose = b.rotPose || {};
  if (b.trick && b.trickP > 0) b.rotPose[b.trick] = (b.rotPose[b.trick] || 0) + dt;   // (going into it counts)
  const spinName = (back) => {
    let pose = null, best = 0;
    for (const k in b.rotPose) if (b.rotPose[k] > best) { best = b.rotPose[k]; pose = k; }
    if (best < SPIN_SHARE * b.rotT) pose = null;
    b.rotT = 0; b.rotPose = {};
    if (pose && pose === b.trick && !b.trickNamed) b.trickSpun = true;   // this pose is spent on the spin move
    return pose ? pose + (back ? 'Back' : 'Spin') : back ? 'backflip' : 'frontflip';
  };
  if (b.flipAcc >= FULL) { b.flipAcc -= 2 * Math.PI; b.flips++; sfx('lane'); nameTrick(spinName(true)); }
  else if (b.flipAcc <= -FULL) { b.flipAcc += 2 * Math.PI; b.flips++; sfx('lane'); nameTrick(spinName(false)); }
}
// VARIETY: eight moves, each counted once per jump, and only once it's been done properly (a pose held for half a
// second at full pose, a full turn of a flip). The name is called out the moment it counts. Every different move multiplies the
// jump's points (stunt mode) and its speed boost: all eight in one jump is x8. Doing two things at once doesn't need a
// bonus of its own: both earn points and speed at the same time anyway.
export const FLIP_UNITS = 2.5, TRICK_HOLD = 0.5, SPIN_SHARE = 0.66;   // (same rule for all four spin moves)                          // one full rotation = 2.5 turbo units
const TRICK_NAMES = { superman: 'SUPERMAN', invert: 'BIKE FLIP', backflip: 'BACKFLIP', frontflip: 'FRONTFLIP',
  supermanSpin: 'SUPERMAN SPIN', supermanBack: 'SUPERMAN BACK SPIN', invertSpin: 'BIKE FLIP SPIN', invertBack: 'BIKE FLIP BACK SPIN' };
// the plain pose, once per time you go into it, and not if that same pose already went into a spin move
export function creditPose(b) { if (b.trick && !b.trickNamed && !b.trickSpun && b.trickHold >= TRICK_HOLD) { b.trickNamed = true; sfx('lane'); nameTrick(b.trick); } }
const variety = (b) => Math.max(1, Object.keys(b.trickSet || {}).length);
function nameTrick(k) {                                            // call the move out the moment it counts
  const b = bike; b.trickSet[k] = (b.trickSet[k] || 0) + 1;
  const n = b.trickSet[k];
  popup((n > 1 ? n + 'X ' : '') + TRICK_NAMES[k], P.cyan);
}

export function landBike(lane, gNew, gOld, dt) {
  const b = bike;
  const slope = slopeAt(lane, b.x);
  const diff = wrapPi(b.angle - slope);                    // + nose high, - nose low (vs the ground)
  const ad = Math.abs(diff);
  const vLand = b.v;
  if (hasElev() && b.airT > 0.25) { const bs = laneSlope(lane, b.x); if (bs < -0.02) b.v = Math.max(b.v, b.v * Math.cos(bs) + b.vy * Math.sin(bs)); }   // land on a downslope: the fall turns into speed
  b.h = gNew; b.grounded = true; b.vy = (gNew - gOld) / dt; b.slopeS = slope; b.hado = null;
  if (hstUp(b.hst)) { b.rel = diff; redeemerFall(diff > 0 ? 1 : -1, 'hst'); return; }   // landed on his head: a wipeout
  if (b.mario && b.mario.phase === 'jump') { crash('OFF THE BIKE'); return; }   // SUPER MARIO: landed without him
  if (b.v > vLand + 1) b.vy *= b.v / vLand;                // sped up by the slope: follow it down instead of floating off
  if (b.trick === 'invert') { crash('LANDED UPSIDE DOWN'); return; }              // bike not back upright: no saving it
  if (b.trick === 'superman' && b.trickP >= 0.98) { crash('OFF THE BIKE'); return; }
  if (diff < -0.85 || diff > 1.15) { crash(diff < 0 ? 'NOSE DIVE' : 'FLIPPED BACK'); return; }
  const v0 = b.v;
  landPayout(diff);
  if (b.v > v0 && v0 > 1) b.vy *= b.v / v0;                // the trick boost kicks in on the spot: keep following the ground down
}
// what a landing pays out (shared by the ground and by catching a loop mid-air): wobble, stunt points, trick boosts
export function landPayout(diff) {
  const b = bike, ad = Math.abs(diff);
  let scrambled = false;
  if (b.trick) {                                                  // half back on: a violent wobble, worse the further off you were
    creditPose(b);
    const p = b.trickP; scrambled = true;
    b.shakeT = 0.4 + 1.2 * p; b.instab = Math.max(b.instab, 1 + 2 * p);
    b.trickBank += b.trickHold * STUNTS[b.trick].rate;
    b.trick = null; b.trickP = 0; b.trickHold = 0;
  }
  b.rel = diff; b.relVel = clamp(b.angVel * 0.25, -2, 2); b.kickT = Math.max(b.kickT, 0.6);
  b.angle = b.slopeS + b.rel; b.angVel = 0; b.stable = 0;
  b.landT = ad >= 0.45 ? 0.3 : 0.17;
  if (scrambled) b.relVel += (Math.random() < 0.5 ? -1 : 1) * (1.5 + 6 * clamp(b.shakeT - 0.4, 0, 1.2) / 1.2);
  const bank = b.trickBank; b.trickBank = 0;
  if (game.mode === 'stunt' && b.airPts > 0) {                          // stunt mode: land it to bank the air points, x4 if clean
    const m = ad < 0.2 ? 4 : 2, pts = b.airPts * m * variety(b);  // (and x the number of different moves)
    game.stuntScore += pts; b.airPts = 0;
    popup(m + 'X  +' + Math.floor(pts), m === 4 ? P.turbo : P.white);
  }
  sfx('land'); burst(8, P.dust, 1, -30); fx.shake = Math.max(fx.shake, 1.5);
  // Trick payout: a clean landing gets the full boost, a decent one half, a rough (or scrambled) one a quarter.
  const units = b.flips * FLIP_UNITS + bank / 100;
  if (ad < 0.2) { b.v += 20; sfx('perfect'); }
  if (ad >= 0.45) { b.v *= 1 - 0.4 * clamp((ad - 0.45) / 0.45, 0, 1); b.instab = Math.max(b.instab, 0.9); }
  if (units > 0.2) {
    const q = scrambled || ad >= 0.45 ? 0.25 : ad >= 0.2 ? 0.5 : 1;
    const mult = variety(b);                                        // every different move multiplies the boost
    const n = Math.max(1, Math.round(units * mult));
    for (let i = 0; i < n; i++) pushTurbo(q);
    sfx('turbo'); fx.shake = Math.max(fx.shake, q === 1 ? 2.5 : 1.5);
    b.instab = Math.max(b.instab, 0.4); b.kickT = Math.max(b.kickT, 1.5);
    popup(q === 1 ? pick(units >= 2.5 ? ['INSANE!', 'LEGENDARY!', 'UNREAL!'] : ['SWEET!', 'AMAZING!', 'AWESOME!', 'RADICAL!']) : q === 0.5 ? pick(['NOT BAD', 'OKAY!', 'NICE']) : pick(['PHEW!', 'SKETCHY!', 'MESSY']),
          q === 1 ? P.turbo : q === 0.5 ? P.white : P.muted);
    if (mult > 1) popup(mult + ' TRICKS X' + mult, P.turbo);
  }
}
