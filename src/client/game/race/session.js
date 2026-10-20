// A race session: the player's bike, input flags, effects, starting a new game and keeping the world generated ahead.

import { EXTRA } from '../core/canvas.js';
import { H, LANES, LANE_SY, PX_M, SC, STEP } from '../core/config.js';
import { ATT, game, menu, race, view } from '../core/state.js';
import { lerp, rint, rnd, seededRand } from '../core/util.js';
import { builtTraffic, compileTrack, ed } from '../modes/builder.js';
import { buildStuntCourse } from '../modes/stunt.js';
import { bots, resetBots } from './rivals.js';
import { genRow, pruneWorld, setupDownhills } from '../world/course.js';
import { terrain } from '../world/terrain.js';
import { world } from '../world/track.js';
import { spawnTraffic, traffic } from '../world/traffic.js';

/* ---------- game state ---------- */
game.state = 'title';                 // title | intro | count | play | crash | finish
game.stateT = 0; game.tNow = 0; view.camX = 0; view.titleScroll = 0;
race.podium = null;                   // the finish podium (see drawPodium)
race.crashes = 0; race.startX = 0; race.best = 0; race.maxMeters = 0; race.topSpeed = 0; let pruneT = 0;
try { race.best = Number(localStorage.getItem('four-lane-scramble-best-time')) || 0; } catch (e) {}
race.raceT = 0; race.finishT = 0;
race.raceM = 2000;                           // race length in metres (random tracks are 2000; built ones vary)
export const finishX = () => race.startX + race.raceM * PX_M;

export const bike = {};
export const inp = { back: false, fwd: false, up: false, down: false };
export const fx = { popups: [], parts: [], shake: 0, acc: 0 };
export const kph = (v) => Math.round(v * 0.4);

export function resetBike(x, v, lane) {
  Object.assign(bike, {
    x, v, lane, laneF: lane, laneT: lane, h: 0, hv: 0, vy: 0, grounded: true,
    rel: 0, relVel: 0, angle: 0, angVel: 0, slopeS: 0, airRot: 0, flips: 0, pivotT: 0,
    turbo: 0, tStack: [], instab: 0, wBoost: 0, landT: 0, wasMud: false, wheelT: 0, stable: 0, spin: 0, lean: 0, thr: 0.66, thrF: 0.5, kickT: 1.2, bumpT: 0.6, shakeT: 0, rdm: null, hado: null, hst: null, mario: null, noCtl: false, trick: null, trickP: 0, trickHold: 0, trickBank: 0, trickLock: false, flipAcc: 0, trickSet: {}, trickNamed: false, surf: null, manualT: 0, manualDir: 1, crash: null, loop: null, loopDX: 0
  });
}
resetBike(0, 0, 1);

export function genWith(fn) { const prev = race.genRand; race.genRand = world.gen; try { return fn(); } finally { race.genRand = prev; } }
export function ensureWorld() {
  let hi = view.camX, lo = view.camX;
  for (const o of bots) { hi = Math.max(hi, o.x); lo = Math.min(lo, o.x); }
  for (const o of traffic) hi = Math.max(hi, o.x + o.len);         // the traffic looks ahead for obstacles too
  if (bike.crash) for (const q of bike.crash.bodies) hi = Math.max(hi, q.x);   // a wreck can fly further than the camera has got to
  while (world.cursor < hi + 900) genWith(genRow);
  pruneT += STEP; if (pruneT > 1) { pruneT = 0; pruneWorld(lo); }
}

export const camAim = (fy) => fy === null ? 0 : Math.max(0, Math.max(-EXTRA + 76, (H - EXTRA) / 2 - 10) - fy);   // on a tall screen, keep a high rider nearer the middle
export function newGame(built, stunt, opts) {
  world.gen = seededRand(race.trk.seed || 7);
  world.lanes = [[], [], [], []]; world.decals = [[], [], [], []]; world.rivers = []; world.elev = []; world.shelf = null; race.elevN = -1; world.lastPeak = -1e9; world.riverQ = race.trk.riverAt.slice(); world.landZones = [];
  resetBike(0, 0, 2);
  race.startX = 0; world.cursor = 560; view.camX = 0; view.camLag = 0;
  if (built) { genWith(() => compileTrack(built)); game.mode = 'race'; } else ed.fromBuilder = false;
  race.crashes = 0; race.maxMeters = 0; race.topSpeed = 0; race.raceT = 0; race.finishT = 0;
  fx.popups.length = 0; fx.parts.length = 0;
  resetBots([0, 1, 3]);
  game.stuntScore = 0; game.stuntLineSet = false; menu.resSel = 0; game.ghostRun = null; race.podium = null;
  game.runRec = opts && opts.replay ? null : { samples: [], pops: [], n: 0, loops: game.stuntLoops.slice(), j2: null, raceM: 0, final: 0, crash: null };
  if (stunt) { bots.length = 0; buildStuntCourse(); }
  else if (!built && game.mode === 'race') genWith(setupDownhills);
  if (!built && !stunt && game.mode === 'race') spawnTraffic(); else if (built) builtTraffic(); else traffic.length = 0;
  game.state = 'intro'; game.stateT = 0;                                      // the player rides up to join the others on the line, then 3 2 1 GO
  ensureWorld();
  for (const r of [bike, ...bots]) r.h = r.hv = terrain(r.lane, r.x);   // on the start line, wherever it is (the top of a hill, say)...
  view.camLift = camAim(laneYNow() - bike.hv * SC);                          // ...and the camera already there, not panning up to it
}

export function popup(text, color) {
  if (ATT.on) return;                                               // (no callouts in the intro video)
  if (game.runRec && game.state !== 'replay') game.runRec.pops.push([race.raceT, text, color]);
  const same = fx.popups.find(p => p.text === text);
  if (same) { same.t = 0; return; }                 // repeat events refresh instead of stacking
  fx.popups.push({ text, color: color || '#fff', t: 0, life: 1.3, slot: fx.popups.length % 4 }); }

export function burst(n, color, hMin, vx0) {
  for (let i = 0; i < n && fx.parts.length < 160; i++) {
    fx.parts.push({ x: bike.x - 10 + rnd(-6, 6), h: bike.h + hMin, ly: laneYNow(), vx: vx0 + rnd(-50, 30), vy: rnd(20, 90), t: 0, life: rnd(0.35, 0.8), s: rint(1, 3), c: color });
  }
}
export function laneYAt(lf) {
  const f = Math.floor(lf), c = Math.min(LANES - 1, Math.ceil(lf));
  return lerp(LANE_SY[f], LANE_SY[c], lf - f);
}
export function laneYNow() { return laneYAt(bike.laneF); }
