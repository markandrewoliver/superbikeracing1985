// The secret d-pad moves: REDEEMER, HADOUKEN, HEADSTAND and SUPER MARIO.

import { sfx } from '../audio/sound.js';
import { SC, STUNTS } from '../core/config.js';
import { P } from '../core/palette.js';
import { game } from '../core/state.js';
import { clamp, wrapPi } from '../core/util.js';
import { kRear } from '../gfx/riderSprites.js';
import { crash } from '../race/crash.js';
import { bike, fx, popup } from '../race/session.js';
import { pushTurbo } from './physics.js';
import { terrain } from '../world/terrain.js';

// REDEEMER (up up down down left right left right, on the ground or in the air): the rider stands up on the seat with his arms out, and stays up there until the code is entered again. Up there a wheelie pays 1.5x, the bike
// is one gauge square twitchier, and in the air it's worth a little more than a BIKE FLIP. Let the bike turn 90 degrees
// and he comes off: in the air he drops like a stone while the bike flies on.
// HADOUKEN (down, down-right, right; in the air): the bike stops turning and gathers a blue fireball for a second,
// then fires off at 400 kph whichever way it's pointing for a quarter of a second, and comes out of it at the speed it
// went in with, still pointing the same way. It isn't a trick: no points, no boost, no multiplier. Pointing at the ground, it fires you into the ground.
export const RDM_RATE = STUNTS.invert.rate * 1.1, HADO_V = 1000, HADO_CHARGE = 1.0, HADO_DASH = 0.25;
export function secretCode(name) {
  const b = bike;
  if (game.state !== 'play' || b.crash || b.loop || (game.tut && game.tut.stage === 'intro')) return;
  if (name === 'redeemer' && !b.hst && !b.mario) {
    if (b.rdm) { b.rdm.dir = b.rdm.dir > 0 ? -1 : 1; sfx('lane'); return; }   // the code again: back down onto the seat (or, halfway down, up again)
    b.rdm = { rot: 0, p: 0, dir: 1 }; b.rdmAir = 0; b.trick = null; b.trickP = 0; b.trickHold = 0; b.trickLock = true;
    popup('REDEEMER!', P.cyan); sfx('perfect');
  } else if (name === 'headstand' && !b.rdm && !b.hst && !b.mario && !b.hado) {
    b.hst = { phase: 'up', t: 0, rot: 0 }; b.trick = null; b.trickP = 0; b.trickHold = 0; b.trickLock = true;
    popup('HEADSTAND!', P.cyan); sfx('perfect');
    if (!b.grounded && Math.abs(wrapPi(b.angle)) >= Math.PI / 2) b.hst.over = wrapPi(b.angle) > 0 ? 1 : -1;   // already over too far: he's off as soon as he lets go of the bars
  } else if (name === 'mario' && !b.rdm && !b.hst && !b.mario && !b.hado) {
    b.mario = { phase: 'up', t: 0 }; b.noCtl = true; b.trick = null; b.trickP = 0; b.trickHold = 0; b.trickLock = true;
    popup('SUPER MARIO!', P.cyan); sfx('perfect');
  } else if (name === 'hadouken' && !b.grounded && !b.hado && !b.hadoUsed && !b.mario) {   // (one per jump)
    b.hadoUsed = true;
    b.hado = { t: 0, s0: Math.hypot(b.v, b.vy) }; b.trick = null; b.trickP = 0; b.trickHold = 0; b.trickLock = true; b.angVel = 0;
    popup('HADOUKEN!', P.cyan); sfx('turbo');
  }
}
// Getting up takes half a second and getting down 0.4: he leans over the bars, tucks his head onto the seat with his
// hips up, rolls upside down with his knees tucked, then pushes his legs up (and the same the other way). Only the full
// pose counts for the bonuses; once he's more than halfway up, turning the bike 90 degrees throws him off.
export const rdmOn = (b) => !!(b.rdm && b.rdm.p >= 1 && b.rdm.dir > 0);
// He can't stay up there forever: 5 s into a REDEEMER he lifts a foot and starts to shake, and the bike's balance gets
// worse (its instability goes up); 5 s later, worse again; 5 s after that, as bad as being knocked by a crash (and it stays that bad). It's all
// balance: up in the air nothing happens till you land, and on the road it's the bike tipping that throws him off.
export const RDM_WOBBLE = 5, RDM_WOBBLE2 = 10, RDM_LIMIT = 15, RDM_SQ = 1.3 / 9, RDM_SQF = 1.0 / 9;
export const RDM_INSTAB = [0, 1.2, 2.4, 5], RDM_SHAKE = [0, 3, 6, 11];       // (level 3 = a crash's rattle, and it doesn't wear off)
export const rdmLvl = (b) => !rdmOn(b) ? 0 : b.rdm.hold >= RDM_LIMIT ? 3 : b.rdm.hold >= RDM_WOBBLE2 ? 2 : b.rdm.hold >= RDM_WOBBLE ? 1 : 0;
export const rdmNum = (b) => b.rdm ? b.rdm.p + (rdmLvl(b) ? 1 : 0) : 0;      // (what's recorded: how far up, +1 once he's shaking)
export const rdmBody = (r) => r > 1 ? 6 + (Math.floor(game.tNow * 10) & 1) : rdmStage(r);   // (the drawing for that)
export const rdmStage = (p) => p > 0.12 ? Math.min(4, Math.ceil(p * 4)) : 0;   // which drawing of the move (0: just sitting)
// HEADSTAND (down, down-left, left; ground or air): 0.25 s up onto his head, a second kicking his legs, 0.25 s rolling
// back onto the seat. The bike is two gauge squares twitchier while he's up there. Turn it 90 degrees and he comes off
// (the same limp fall as the REDEEMER); start it with the bike already past 90 degrees and he's off at once; land a
// jump on his head and it's a wipeout. Back on the seat safely: in the air it counts like a BIKE FLIP SPIN (a full flip
// and a move of its own for the multiplier), on the road like running over a boost arrow.
const HST_UP = 0.25, HST_HOLD = 1.0, HST_DOWN = 0.25;
function hstStage(h) {                                             // which drawing of it
  if (h.phase === 'up') return clamp(Math.ceil(h.t / HST_UP * 4), 1, 4);
  if (h.phase === 'hold') return 4 + (Math.floor(h.t * 8) & 1);
  return clamp(Math.ceil((1 - h.t / HST_DOWN) * 4), 1, 4);
}
export const hstUp = (h) => !!h && (h.phase === 'hold' || (h.phase === 'up' && h.t > HST_UP / 2) || (h.phase === 'down' && h.t < HST_DOWN / 2));   // on his head (or most of the way)
export function moveLook(b) {
  if (b.hst) return [6, hstStage(b.hst), -1];
  const m = b.mario; if (!m) return null;
  if (m.phase === 'up') return [5, clamp(Math.ceil(m.t / MARIO_UP * 3), 1, 3), -1];
  if (m.phase === 'down') return [5, clamp(Math.ceil((1 - m.t / MARIO_DOWN) * 3), 1, 3), -1];
  return [7, 1, m.h - b.h, m.dx, m.a];
}
export function headstandTick(dt) {
  const b = bike, h = b.hst; if (!h) return;
  h.t += dt;
  if (h.phase === 'up' && h.t >= HST_UP) { h.phase = 'hold'; h.t = 0; }
  else if (h.phase === 'hold' && h.t >= HST_HOLD) { h.phase = 'down'; h.t = 0; }
  else if (h.phase === 'down' && h.t >= HST_DOWN) {                 // back on the seat: it pays out
    b.hst = null;
    if (!b.grounded) { b.flips++; b.trickBank += STUNTS.invert.rate * 0.5; if (b.trickSet) b.trickSet.headstand = 1; if (game.mode === 'stunt') b.airPts = (b.airPts || 0) + 3500; sfx('lane'); }   // like a BIKE FLIP SPIN
    else { pushTurbo(); b.instab = Math.max(b.instab, 0.3); b.relVel += 0.5; b.kickT = Math.max(b.kickT, 1.6); sfx('turbo'); fx.shake = Math.max(fx.shake, 2); }   // like a boost arrow
  }
}
// SUPER MARIO (right, down, down-right; ground or air): 0.25 s climbing up onto the seat, then he jumps off it with his
// fist up, and sits back down (0.25 s) once he's landed back on it. The bike's his for the whole thing: no control.
// While he climbs, the bike steadies itself, by up to 45 degrees, so most jumps go straight up. He jumps the way he's
// standing, so if it was more than 45 degrees off, he goes up at an angle and comes down off the side of the bike (onto
// the ground: a wipeout); upside down, he jumps straight into the ground. On the road the jump takes half a second; in
// the air the bike drops away under him while he goes up, so it takes longer to come back down onto it, and if the bike
// lands while he's still in the air, that's a wipeout too.
// Back on the seat: in the air it counts like a SUPERMAN SPIN; on the road it's three quarters of a HEADSTAND's boost.
const MARIO_UP = 0.25, MARIO_DOWN = 0.25, MARIO_G = 900, MARIO_V = MARIO_G * 0.25, MARIO_FIX = Math.PI / 4, MARIO_CATCH = 20;
export function marioTick(dt) {
  const b = bike, m = b.mario; if (!m) return;
  m.t += dt; b.noCtl = true;
  if (m.phase === 'up') {                                          // the bike steadies itself while he climbs (45 degrees' worth at most)
    const step = MARIO_FIX / MARIO_UP * dt;
    if (b.grounded) { b.rel -= Math.sign(b.rel) * Math.min(Math.abs(b.rel), step); b.relVel = 0; }
    else { const a = wrapPi(b.angle); b.angle -= Math.sign(a) * Math.min(Math.abs(a), step); b.angVel = 0; }
    if (m.t >= MARIO_UP) {                                         // ...and off he goes, the way he's standing
      const a = b.grounded ? b.rel : wrapPi(b.angle);
      Object.assign(m, { phase: 'jump', t: 0, a, h: b.h, dx: 0, vx: -Math.sin(a) * MARIO_V, vy: (b.grounded ? 0 : b.vy) + Math.cos(a) * MARIO_V, miss: false });
      sfx('lane');
    }
  } else if (m.phase === 'jump') {
    m.vy -= MARIO_G * dt; m.h += m.vy * dt; m.dx += m.vx * dt;
    if (m.h > b.h + 4) m.rose = true;                                // (jumped down, not up: he's not coming back onto it)
    if (!m.miss && m.t > 0.1 && !m.rose && m.vy < (b.grounded ? 0 : b.vy)) m.miss = true;
    if (!m.miss && m.rose && m.h <= b.h && m.vy <= (b.grounded ? 0 : b.vy) + 1) {
      if (Math.abs(m.dx) <= MARIO_CATCH) {                         // back on the bike
        m.phase = 'down'; m.t = 0; sfx('land');
        if (!b.grounded) { b.flips++; b.trickBank += STUNTS.superman.rate * 0.5; if (b.trickSet) b.trickSet.mario = 1; if (game.mode === 'stunt') b.airPts = (b.airPts || 0) + 3000; sfx('lane'); }   // like a SUPERMAN SPIN
        else { pushTurbo(0.75); b.instab = Math.max(b.instab, 0.225); b.relVel += 0.375; b.kickT = Math.max(b.kickT, 1.2); sfx('turbo'); fx.shake = Math.max(fx.shake, 1.5); }   // 3/4 of a HEADSTAND
        return;
      }
      m.miss = true;                                               // came down beside it
    }
    if (m.h <= terrain(b.lane, b.x + m.dx)) crash('OFF THE BIKE');   // hit the ground
  } else if (m.phase === 'down' && m.t >= MARIO_DOWN) { b.mario = null; b.noCtl = false; }
}
export function redeemerTick(dt) {
  const b = bike; if (!b.rdm) return;
  b.rdm.p = clamp(b.rdm.p + dt * b.rdm.dir / (b.rdm.dir > 0 ? 0.5 : 0.4), 0, 1);
  if (b.rdm.p <= 0 && b.rdm.dir < 0) { b.rdm = null; return; }          // back on the seat
  if (b.rdm.dir > 0) b.rdm.hold = (b.rdm.hold || 0) + dt;                 // (the clock starts as soon as he starts getting up)
  const lv = rdmLvl(b); if (lv) b.instab = Math.max(b.instab, RDM_INSTAB[lv]);   // his time's running out: the balance goes
}
// Coming off a Redeemer (the bike tipping too far back or forward, on the road or in the air) is a limp fall, not an
// explosion. His head stays on the seat like a hinge while his body keeps swinging over the way the bike is tipping;
// once it's past the point of no return he slides off and drops like a sack, lands flat on his back with one small
// bump and a puff of dust, and lies there. The bike carries on without him: on the road it slaps back down onto its
// wheels and coasts to a stop; in the air it flies on and lands on its own. Then he gets up and walks back to it as usual.
const RDM_FEET = [-5, -15], RDM_COM = [-6, -32];                   // in the REDEEMER sprite, from its anchor: his feet on the seat (the hinge), and the middle of him
export const FALL_KIND = {                                                // the limp fall, for each move that can end in one: its drawing (mode, pose), lying flat (lie), hinge and middle
  rdm: { mode: 5, pose: 4, lie: 5, piv: RDM_FEET, com: RDM_COM },
  hst: { mode: 6, pose: 4, lie: 6, piv: [-2, -14], com: [-3, -34] }   // HEADSTAND: he goes over about the crown of his head on the seat
};
export const scrW = (p, a) => [p[0] * Math.cos(a) + p[1] * Math.sin(a), -p[0] * Math.sin(a) + p[1] * Math.cos(a)];   // a screen offset turned with the bike (+a = nose up)
export function redeemerFall(dir, kind) {
  const b = bike, air = !b.grounded, v = b.v, vy = b.vy, av = b.angVel, rel = b.rel, a = b.angle, x = b.x, h = b.h;
  crash('OFF THE BIKE', true); if (!b.crash) return;
  const piv = dir > 0 ? kRear(0) : -kRear(0), px = air ? 0 : kRear(0) * b.pivotT;   // (on the road the bike was drawn turning about a wheel: start from exactly there)
  b.crash = { why: 'OFF THE BIKE', limp: true, hinge: { kind: kind || 'rdm', air, dir, phi: 0, w: 0, free: false, landed: false, piv, rel }, bodies: [
    { x: x + (px - px * Math.cos(a)) / SC, h: h - px * Math.sin(a) / SC, vx: v, vy: air ? vy : 0, rot: a, rv: air ? (Math.abs(av) > 1 ? av : dir * 3) : dir * 2, ground: !air },
    { x, h, vx: 0, vy: 0, rot: a, rv: 0 }
  ] };
}
