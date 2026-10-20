// Recording every run; the stunt-mode replay and the ghost race.

import { CRUISE0, G, LANES, PX_M } from '../core/config.js';
import { game, menu, race, view } from '../core/state.js';
import { clamp, lerp, rnd, wrapPi } from '../core/util.js';
import { ed, useTrackSettings } from './builder.js';
import { placeStuntJump2 } from './stunt.js';
import { botCrash, botCrashTick, bots } from '../race/rivals.js';
import { bike, ensureWorld, finishX, fx, inp, newGame, popup } from '../race/session.js';
import { tooHigh } from '../rider/physics.js';
import { RDM_WOBBLE, moveLook, rdmNum } from '../rider/secretMoves.js';
import { SURF } from '../world/settings.js';
import { hasElev, inDecal, laneSlope, loopAhead, loopEnter, loopExit, loopStep, slopeAt, terrain } from '../world/terrain.js';
import { riverAt, surfAt, world } from '../world/track.js';

/* ---------- recording, replay and the ghost ---------- */
// Every run is recorded 60 times a second: enough to redraw the rider exactly (replay) or to have a ghost ride it again.
game.runRec = null; let replay = null; menu.resSel = 0; game.ghostRun = null;
export function snapBike() {
  const b = bike;
  return { t: race.raceT, st: game.state, x: b.x, dx: b.loopDX || 0, lp: b.loop ? b.loop.o.x : null, lth: b.loop ? b.loop.th : 0, h: b.h, hv: b.hv, a: b.angle, lf: b.laneF, l: b.lane, g: b.grounded,
    rel: b.rel, pv: b.pivotT, lt: b.landT, ln: b.lean, tr: b.trick, tp: b.trickP, sp: b.spin, tu: b.turbo, tb: b.tb || 0, mt: b.manualT, wb: b.wBoost,
    v: b.v, vy: b.vy, ib: inp.back, ifw: inp.fwd, sc: game.stuntScore, ap: b.airPts || 0, rdm: rdmNum(b), hd: b.hado ? b.hado.t : -1, mv: moveLook(b), cr: b.crash ? b.crash.bodies.map(q => [q.x, q.h, q.rot]) : null };
}
function findLoopAt(x) {
  for (const a of world.lanes) for (const o of a) if (o.type === 'loop' && Math.abs(o.x - x) < 1) return o;
  return null;
}
// REPLAY (stunt mode): rebuild the same course and play the recording back.
export function startReplay() {
  const R = game.runRec; if (!R || !R.samples.length) return;
  game.stuntLoops = R.loops.slice();
  newGame(null, true, { replay: true });
  if (R.j2 !== null) placeStuntJump2(R.j2);
  race.raceM = R.raceM || race.raceM; game.stuntLineSet = true; game.runRec = R;
  replay = { R, t: R.samples[0].t, i: 0, p: 0 };
  game.state = 'replay'; game.stateT = 0; fx.popups.length = 0;
}
export function tickReplay(dt) {
  const r = replay, S = r.R.samples, tPrev = r.t;
  r.t += dt;
  while (r.i < S.length - 1 && S[r.i + 1].t <= r.t) r.i++;
  while (r.p < r.R.pops.length && r.R.pops[r.p][0] <= r.t) { const q = r.R.pops[r.p++]; if (q[0] > tPrev - dt) popup(q[1], q[2]); }
  const s = S[r.i], b = bike;
  Object.assign(b, { x: s.x, loopDX: s.dx, h: s.h, hv: s.hv, angle: s.a, laneF: s.lf, laneT: s.l, lane: s.l, grounded: s.g, rel: s.rel, pivotT: s.pv, landT: s.lt,
    lean: s.ln, trick: s.tr, trickP: s.tp, spin: s.sp, turbo: s.tu, tb: s.tb, manualT: s.mt, wBoost: s.wb, v: s.v, vy: s.vy, airPts: s.ap });
  b.rdm = s.rdm ? { rot: 0, p: Math.min(1, s.rdm), dir: 1, hold: s.rdm > 1 ? RDM_WOBBLE : 0 } : null; b.hado = s.hd >= 0 ? { t: s.hd } : null; b.mvRec = s.mv || null;
  b.loop = s.lp !== null ? (findLoopAt(s.lp) ? { o: findLoopAt(s.lp), th: s.lth } : null) : null;
  b.crash = s.cr ? { bodies: s.cr.map(([x, h, rot]) => ({ x, h, rot })) } : null;
  inp.back = s.ib; inp.fwd = s.ifw; game.stuntScore = s.sc; race.raceT = s.t;
  if (s.cr) view.camX += (s.cr[0][0] - view.camX) * Math.min(1, 3 * dt); else view.camX = s.x;
  ensureWorld();
  if (r.t > S[S.length - 1].t + 0.8) endReplay();
}
export function endReplay() {
  const R = replay.R; replay = null; R.closed = true;
  inp.back = inp.fwd = inp.up = inp.down = false;
  game.stuntScore = R.final; bike.crash = R.crash;
  game.state = 'finish'; game.stateT = 2.05; menu.resSel = 0;
}
// VS. GHOST (races): the same track again, against the run you just did. The ghost is a rider like the bots, with the
// same physics, but trained on your run: the recording says, for every point along the track, which lane you were in,
// how fast you were going, whether you were in the air and how high, and what you were doing (wheelies, tricks).
// While nothing has got in his way he rides it in step with the clock (o.w = 1, o.gt = the moment of your run he's at):
// he is where you were, when you were, so an untouched ghost crosses the line in your time, and where you wiped out, he
// wipes out the same way. Bump him, knock him off a jump, make him crash, and he's on his own (o.w drops to 0): a bot
// that still steers for your lane and chases your speed at each point of the track, hit by mud, crates and traffic like
// any bot, until he's back on the ground and close to your line again, when he eases back onto it (from the moment of
// your run that matches where he is, so he's simply that much behind).
// Racing VS. GHOST straight after a ghost race adds your new run as another ghost, rather than swapping him out: each
// ghost starts in the lane that run started in, you take a free one, and only the last three runs are kept.
export function startGhostRace() {
  const R = game.runRec; if (!R || !R.samples.length) return;
  const runs = bots.filter(o => o.ghost).map(o => o.ghost).concat([R]).slice(-3);   // (after an ordinary race, just this run)
  game.mode = 'race';
  if (ed.fromBuilder) { useTrackSettings(ed.t); race.raceM = ed.t.len; newGame(ed.t); } else { if (race.trk.raceM) race.raceM = race.trk.raceM; newGame(); }
  bots.length = 0;
  const used = new Set();
  for (const G of runs) {
    const s0 = G.samples[0]; let gl = s0.l;
    if (used.has(gl)) for (const d of [1, -1, 2, -2, 3, -3]) { const l = gl + d; if (l >= 0 && l < LANES && !used.has(l)) { gl = l; break; } }   // (never two on one spot)
    used.add(gl);
    bots.push({ name: 'GHOST', theme: 0, skill: 1, x: race.startX, v: 0, lane: gl, laneF: gl, laneT: gl, h: 0, hv: 0, vy: 0, grounded: true, angle: 0, rel: 0, wB: 0, wheelieT: 0,
      tStack: [], turbo: 0, mud: false, hits: new Set(), wobbleT: 0, hitCD: 0, think: 1e9, spin: 0, landT: 0, crash: null, done: 0, loop: null, loopDX: 0,
      ghost: G, gi: 0, gt: s0.t, w: 1 });
  }
  game.ghostRun = R;
  let pl = [1, 2, 0, 3].find(l => !used.has(l)); bike.lane = bike.laneF = bike.laneT = pl;   // you start in a free lane, alongside them
}
// the recording where the ghost is now: the samples either side of his x (never a wipeout's), and how far between
function ghostSeek(o) {
  const S = o.ghost.samples, ok = (i) => S[i].st !== 'crash';
  let i = o.gi;
  while (i > 0 && (S[i].x > o.x || !ok(i))) i--;                    // (after a wipeout he may be put back a little)
  for (;;) {
    let j = i + 1; while (j < S.length && !ok(j)) j++;
    if (j >= S.length || S[j].x > o.x) break;
    i = j;
  }
  o.gi = i;
  let j = i + 1; while (j < S.length && !ok(j)) j++;
  if (j >= S.length) return null;                                  // past the end of the run: on his own from here
  const a = S[i], b = S[j], f = b.x > a.x ? clamp((o.x - a.x) / (b.x - a.x), 0, 1) : 0;
  return { a, b, f, crashNext: j > i + 1 && f > 0.5,
    l: f < 0.5 ? a.l : b.l, lf: lerp(a.lf, b.lf, f), v: lerp(a.v, b.v, f), hv: lerp(a.hv, b.hv, f), vy: lerp(a.vy, b.vy, f), g: f < 0.5 ? a.g : b.g, ang: a.a + wrapPi(b.a - a.a) * f };
}
// the recording at a moment of your run (in step with the clock, while he's on your line)
function ghostAtTime(o) {
  const S = o.ghost.samples;
  while (o.gi < S.length - 1 && S[o.gi + 1].t <= o.gt) o.gi++;
  while (o.gi > 0 && S[o.gi].t > o.gt) o.gi--;
  if (o.gi >= S.length - 1) return null;
  const a = S[o.gi], b = S[o.gi + 1];
  if (a.st === 'crash') return { crash: true };
  const f = b.t > a.t ? clamp((o.gt - a.t) / (b.t - a.t), 0, 1) : 0, c = b.st === 'crash' ? a : b;
  return { a, b: c, f, x: lerp(a.x, c.x, f), l: f < 0.5 ? a.l : c.l, lf: lerp(a.lf, c.lf, f), v: lerp(a.v, c.v, f), hv: lerp(a.hv, c.hv, f), vy: lerp(a.vy, c.vy, f), g: f < 0.5 ? a.g : c.g, ang: a.a + wrapPi(c.a - a.a) * f };
}
export function ghostTick(o, dt) {
  const S = o.ghost.samples;
  if (o.crash && o.crash.rec) {                                    // wiping out where you did, played as it happened
    o.gt += dt;
    while (o.gi < S.length - 1 && S[o.gi + 1].t <= o.gt) o.gi++;
    const s = S[o.gi];
    if (s.st === 'crash' && s.cr) { o.crash.bodies = s.cr.map(([x, h, rot]) => ({ x, h, rot })); o.x = s.cr[0][0]; return; }
    Object.assign(o, { crash: null, x: s.x, v: s.v, h: s.h, hv: s.hv, vy: s.vy, grounded: s.g, angle: s.a, lane: s.l, laneF: s.lf, laneT: s.l, rel: s.rel, w: 1, wobbleT: 0 });
    return;
  }
  if (o.crash) { botCrashTick(o, dt); if (!o.crash) { o.w = 0; o.resume = false; } return; }   // knocked off: up again like any bot, on his own for now
  let rec = null;
  if (o.done) o.w = 0;
  else if (o.w > 0.5 && !o.loop) {                                  // on your line: in step with your run
    o.gt += dt; rec = ghostAtTime(o);
    if (rec && rec.crash) {                                       // you wiped out here: so does he
      const s = S[o.gi];
      if (s.cr) { o.crash = { rec: true, t: 0, bodies: s.cr.map(([x, h, rot]) => ({ x, h, rot })) }; o.x = s.cr[0][0]; o.v = 0; o.trick = null; o.tStack.length = 0; return; }
      rec = null;
    }
    if (rec && (Math.abs(rec.x - o.x) > 150 || Math.abs(o.laneF - rec.lf) > 0.6 || (!o.grounded && Math.abs(o.h - rec.hv) > 80))) o.w = 0;   // knocked too far off it
  }
  if (!o.done && !(o.w > 0.5) && !o.loop) {                        // off it: what you did at this point of the track
    rec = ghostSeek(o);
    if (rec) { rec.x = o.x; o.gt = lerp(rec.a.t, rec.b.t, rec.f); }
  }
  const w = o.w;
  const meters = Math.max(0, (o.x - race.startX) / PX_M), sf = SURF[surfAt(o.x)];
  const own = (CRUISE0 + 70 * clamp(meters / 2500, 0, 1)) * sf.speed;   // what he'd do with nothing to go on
  // lanes: where you were, unless that means swerving into someone alongside
  if (!o.loop) {
    let lt = rec ? rec.l : o.laneT;
    if (lt !== o.lane) for (const r of [bike, ...bots]) if (r !== o && !(r !== bike && r.crash) && Math.abs(r.laneF - lt) < 0.9 && Math.abs(r.x - o.x) < 60) { lt = o.lane; break; }
    o.laneT = lt;
    if (rec && w > 0.8 && lt === rec.l) o.laneF += clamp(rec.lf - o.laneF, -7 * dt, 7 * dt);   // on your line: your exact sweep across
    else if (o.laneF !== o.laneT) { const d = o.laneT - o.laneF; o.laneF += Math.sign(d) * Math.min(Math.abs(d), 7 * dt); }
  }
  let lane = clamp(Math.round(o.laneF), 0, LANES - 1);
  if (lane !== o.lane && !o.loop && tooHigh(lane, o.x, o.h)) lane = o.laneT = o.laneF = o.lane;
  const laneChanged = lane !== o.lane; o.lane = lane;
  if (o.loop) {
    const r = loopStep(o, dt);
    if (r === 'fall') { botCrash(o); o.w = 0; return; }
    if (r === 'done') loopExit(o, o.lane);
    o.spin += o.v * dt / 7;
    if (o.loop) return;
  }
  // how closely he's on your line: back on it once he's in your lane, near your speed, steady, and on the ground or in the air with you
  if (o.wobbleT > 0 || !rec) o.w = 0;
  else if (o.w < 1) {                                            // easing back on
    const near = Math.abs(o.laneF - rec.lf) < 0.35 && Math.abs(o.v - rec.v) < Math.max(60, 0.2 * rec.v) &&
      (o.grounded ? rec.g : !rec.g && Math.abs(o.h - rec.hv) < 30 && Math.abs(o.vy - rec.vy) < 120);   // (or in the air off the same kicker, on much the same arc)
    o.w = near ? Math.min(1, o.w + dt / 1.2) : o.w > 0.5 ? o.w : Math.max(0, o.w - dt * 3);
  }
  const W2 = o.w;
  const mud = o.grounded && inDecal(lane, o.x, 'mud');
  if (mud && !o.mud && W2 < 0.5) o.v *= 0.72;                      // (on your line, your speed already has the mud in it)
  o.mud = mud;
  if (o.grounded) for (const d of world.decals[lane]) if (d.type === 'turbo' && !o.hits.has(d) && o.x >= d.x && o.x <= d.x + d.w) { o.hits.add(d); if (W2 < 0.5) { o.tStack.push(2.4); o.v += 55; } }
  let tb = 0;
  for (let i = o.tStack.length - 1; i >= 0; i--) { o.tStack[i] -= dt; if (o.tStack[i] <= 0) o.tStack.splice(i, 1); else tb += 100 * clamp(o.tStack[i] / 0.7, 0, 1); }
  let target = rec ? rec.v + (W2 < 0.5 ? tb : clamp((rec.x - o.x) * 4, -120, 120)) : o.done ? 110 : own * (mud ? 0.42 : 1) + tb;
  const kb = !o.grounded ? 0.5 : (o.v > target && !mud && hasElev()) ? (laneSlope(o.lane, o.x) < -0.01 ? 0.6 : 1.6) : 2.6;
  o.v += (target - o.v) * Math.min(1, (Math.max(kb, rec && o.grounded ? 4 : 0) + 12 * W2 * (o.grounded ? 1 : 0.4)) * dt);   // (chasing your speed: as quick off the mark as you were)
  if (o.grounded && hasElev() && W2 < 0.5) o.v = Math.max(20, o.v - 540 * Math.sin(laneSlope(o.lane, o.x)) * dt);
  o.v = Math.min(o.v, 700);

  const xPrev = o.x; o.x += o.v * dt;
  if (o.grounded) { const lo = loopAhead(lane, xPrev, o.x); if (lo) { o.laneF = o.laneT = lane; loopEnter(o, lo); return; } }
  const gNew = terrain(lane, o.x), gOld = terrain(lane, xPrev);
  if (o.grounded) {
    const pred = o.h + o.vy * dt - 0.5 * G * dt * dt;
    if ((!laneChanged && pred > gNew + 0.6) || (laneChanged && gNew < o.h - 6)) { if (laneChanged) o.vy = 0; o.grounded = false; o.airT = 0; o.h = Math.max(pred, gNew); o.vy = Math.min(o.vy, 560) - G * dt; }
    else { o.h = gNew; o.vy = laneChanged ? 0 : (gNew - gOld) / dt; if (riverAt(o.x, lane)) { botCrash(o, true); o.w = 0; return; } }
    if (o.wobbleT > 0) {                                           // rattled after contact: thrashing, and likely to go down
      o.wobbleT -= dt; o.rel = 0.3 * Math.sin(race.raceT * 23) + rnd(-0.1, 0.1);
      if (Math.random() < dt * 1.0) { botCrash(o); o.w = 0; return; }
    } else o.rel += ((rec && W2 > 0.5 ? rec.a.rel : 0) - o.rel) * Math.min(1, dt * 10);   // your wheelies
    o.angle = slopeAt(lane, o.x) + o.rel;
  } else {
    o.vy -= G * dt; o.h += o.vy * dt; o.airT = (o.airT || 0) + dt;
    if (rec && W2 > 0) {                                           // in the air on your jump: your arc
      const k = Math.min(1, dt * 14 * W2); o.h += (rec.hv - o.h) * k; o.vy += (rec.vy - o.vy) * k;
      o.angle += wrapPi(rec.ang - o.angle) * Math.min(1, dt * 12 * W2);
    } else {
      const tf = Math.max(0.05, (o.vy + Math.sqrt(o.vy * o.vy + 2 * G * Math.max(0, o.h - gNew))) / G);
      o.angle += (slopeAt(lane, o.x + o.v * tf) + 0.08 - o.angle) * Math.min(1, dt * 3);
    }
    if (o.h <= gNew) {
      if (riverAt(o.x, lane)) { botCrash(o, true); o.w = 0; return; }
      const vLand = o.v;
      if (hasElev() && o.airT > 0.25) { const bs = laneSlope(lane, o.x); if (bs < -0.02) o.v = Math.max(o.v, o.v * Math.cos(bs) + o.vy * Math.sin(bs)); }
      o.h = gNew; o.grounded = true; o.vy = (gNew - gOld) / dt * Math.max(1, o.v / Math.max(1, vLand)); o.landT = 0.18; o.rel = o.angle - slopeAt(lane, o.x);
      if (W2 < 0.5 && o.airT > 0.4 && Math.random() < 0.05 * sf.pull) { botCrash(o); o.w = 0; return; }   // only off your line is landing a gamble
    }
  }
  if (rec && W2 > 0.5) { const s = rec.f < 0.5 ? rec.a : rec.b; o.trick = s.tr; o.trickP = s.tp; o.turbo = s.tu > 0 ? 1 : 0; o.tb = s.tb; o.rdm = s.rdm || 0; o.hdT = s.hd === undefined ? -1 : s.hd; o.mv = s.mv || null; }   // your tricks and boosts
  else { o.trick = null; o.trickP = 0; o.turbo = o.tStack.length; o.rdm = 0; o.hdT = -1; o.mv = null; }
  o.hv = o.grounded ? o.hv + (o.h - o.hv) * Math.min(1, dt * 30) : o.h;
  o.landT = Math.max(0, o.landT - dt);
  o.spin += (o.grounded ? o.v : 90) * dt / 7;
  if (!o.done && o.x >= finishX()) o.done = race.raceT;
}
