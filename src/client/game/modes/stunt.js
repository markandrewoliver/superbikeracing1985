// STUNT mode: the fixed two-jump course and its scoring.

import { LANES } from '../core/config.js';
import { game, race } from '../core/state.js';
import { pick } from '../core/util.js';
import { CLIMB_H, ed } from './builder.js';
import { bike, newGame } from '../race/session.js';
import { rdmOn } from '../rider/secretMoves.js';
import { TODS } from '../world/settings.js';
import { LOOP_D, addLoop, terrain } from '../world/terrain.js';
import { world } from '../world/track.js';

// STUNT MODE: no rivals, no clock. You start on top of a big hill, bomb down it into a huge kicker, land on a second
// hill and hit a second kicker. Tricks score points per millisecond, banked (x2 / x4) only if you land them.
game.mode = 'race'; game.stuntScore = 0; export let stuntBest = 0; game.stuntLoops = [false, false]; export let stuntLastX = 0; game.stuntLineSet = false; export let stuntTrack = []; export let stuntJump1End = 0; game.stuntJump2 = false;
try { stuntBest = Number(localStorage.getItem('super-bike-stunt-best')) || 0; } catch (e) {}
export const STUNT_DROPS = 10, STUNT_DW = 170, STUNT_RAMP_X = 300 + STUNT_DROPS * STUNT_DW + 10;   // first kicker, on a ledge at the foot of the hill
export const STUNT_LEDGE = 8, STUNT_DROP2_X = 2900, STUNT_DW2 = 220;                                  // landing hill falls away below the ledge...
const STUNT_RAMP2_X = STUNT_DROP2_X + STUNT_LEDGE * STUNT_DW2 + 10;                            // ...straight into the second kicker
export function placeStuntJump2(x2) {                                    // the second jump, on the flat (a slope in front of it could launch a fast bike right over it)
  game.stuntJump2 = true; stuntLastX = placeStuntJump(1, x2);
  if (game.runRec) game.runRec.j2 = x2;
}
// One jump of the stunt course: an optional loop that carries the 2-lane track across to the other pair, then the kicker.
function placeStuntJump(j, x) {
  const seg = stuntTrack[stuntTrack.length - 1];
  let pair = seg.pair, kx = x;
  if (game.stuntLoops[j]) {
    const shift = pair === 2 ? 2 : -2;
    addLoop(kx, pair, pair + 1, shift, 80);
    if (j === 1) for (let l = pair; l <= pair + 1; l++) world.decals[l].push({ type: 'turbo', x: kx - 70, w: 48, hit: false });   // a boost right before the second loop
    seg.x1 = kx; pair -= shift; stuntTrack.push({ x0: kx + LOOP_D, x1: Infinity, pair }); kx += LOOP_D;
  }
  for (let l = pair; l <= pair + 1; l++) world.lanes[l].push({ type: 'ramp', x: kx, w: 160, h: 110, a: pair, b: pair + 1, full: true });   // the big kicker
  return kx + 160;
}
export function startStunt(loops) {
  game.tut = null; game.mode = 'stunt'; ed.fromBuilder = false;
  game.stuntLoops = loops || [Math.random() < 0.5, Math.random() < 0.5];           // each jump: a coin flip for a loop in front of the kicker
  const bg = pick(['city', 'grass', 'dirt']);
  race.trk = { tod: pick(TODS), bg, crowd: bg === 'city' ? false : Math.random() < 0.7, base: 'asphalt', sections: [], rivers: 0, riverAt: [] };
  race.raceM = 1e6;                                                  // no fixed line: it appears once you've landed the second jump
  newGame(null, true);
}
export function buildStuntCourse() {
  world.cursor = Infinity;
  const H = (STUNT_DROPS + STUNT_LEDGE + 3) * CLIMB_H;            // +3: room for the short hill before the second jump without dropping below ground level
  world.elev.push({ x: race.startX - 3000, w: 10, dh: H });                     // already up the hill when you start
  for (let i = 0; i < STUNT_DROPS; i++) world.elev.push({ x: race.startX + 300 + i * STUNT_DW, w: STUNT_DW, dh: -CLIMB_H });   // steeper than a normal mountain
  for (let i = 0; i < STUNT_LEDGE; i++) world.elev.push({ x: race.startX + STUNT_DROP2_X + i * STUNT_DW2, w: STUNT_DW2, dh: -CLIMB_H });   // land on the way down
  for (let l = 0; l < LANES; l++) {
    world.lanes[l].push({ type: 'base', x: race.startX - 3000, w: 1e6, a: 0, b: LANES - 1 });
  }
  // The stunt course is two lanes wide: it starts on the front pair, and a loop carries it across to the other pair
  // (behind the way in for the first, in front of it for a second), so the loop never runs through itself.
  stuntTrack = [{ x0: -Infinity, x1: Infinity, pair: 2 }]; stuntLastX = Infinity; game.stuntJump2 = false;
  stuntJump1End = placeStuntJump(0, race.startX + STUNT_RAMP_X);       // the second jump is placed once you've landed the first
  world.elev.sort((p, q) => p.x - q.x); race.elevN = -1;
  bike.h = bike.hv = terrain(bike.lane, bike.x);
}
// points per millisecond while each move is happening (they add up if you combine them)
const STUNT_PTS = { superman: 1.0, invert: 1.5, backflip: 2.0, frontflip: 2.0, redeemer: 1.65 };   // (the Redeemer: a little more than a bike flip)
export function stuntAirPoints(dt) {
  const b = bike; let rate = 0;
  if (b.trick && b.trickP > 0) rate += STUNT_PTS[b.trick];
  if (rdmOn(b)) rate += STUNT_PTS.redeemer;
  if (b.angVel > 2.5) rate += STUNT_PTS.backflip; else if (b.angVel < -2.5) rate += STUNT_PTS.frontflip;   // spinning
  b.airPts = (b.airPts || 0) + rate * dt * 1000;
}
export function endStunt() {
  game.state = 'finish'; game.stateT = 0; race.finishT = race.raceT;
  if (game.runRec) { game.runRec.raceM = race.raceM; game.runRec.final = game.stuntScore; game.runRec.crash = bike.crash; }
  if (game.stuntScore > stuntBest) { stuntBest = game.stuntScore; try { localStorage.setItem('super-bike-stunt-best', String(stuntBest)); } catch (e) {} }
}
