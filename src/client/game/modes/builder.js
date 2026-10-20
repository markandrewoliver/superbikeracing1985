// TRACK BUILDER: pieces, saved slots, compiling a built track into the world, templates, and the builder's controls.

import { CAR_SPRITES } from '../art/vehicles.js';
import { sfx } from '../audio/sound.js';
import { LANES, LANE_SY, PX_M, SC, W } from '../core/config.js';
import { ATT, game, race, view } from '../core/state.js';
import { clamp, seededRand } from '../core/util.js';
import { sxToWorld } from '../gfx/road.js';
import { bots } from '../race/rivals.js';
import { finishX, genWith, inp, newGame } from '../race/session.js';
import { genRow } from '../world/course.js';
import { BGS, FEATS, FEAT_NAME, TODS } from '../world/settings.js';
import { addLoop, knotsOf, laneBase } from '../world/terrain.js';
import { rollTrack, world } from '../world/track.js';
import { traffic } from '../world/traffic.js';

/* ---------- track builder ---------- */
// A built track is plain data: settings plus a list of pieces (metres along the course, lane).
// It is compiled into the same world structures the random generator fills, so it races identically.
export const PIECES = {
  hill:    { name: 'HILL',   span: 200 },
  mesa:    { name: 'MESA',   span: 420 },
  jump:    { name: 'JUMP',   span: 442 },                        // (older saves only: a kicker and its landing hill, now placed separately)
  kick:    { name: 'KICKER', span: 72 },
  bigkick: { name: 'BIG KICKER', span: 112 },
  whoops:  { name: 'WHOOPS', span: 330 },
  mud:     { name: 'MUD',    span: 170 },
  turbo:   { name: 'TURBO',  span: 48 },
  river:   { name: 'RIVER',  span: 140 },
  climb:   { name: 'CLIMB',  span: 240 },                        // stack these to build a mountain
  drop:    { name: 'DROP',   span: 240 },                        // ...and these to come back down it, fast (or go down from the start)
  car:     { name: 'CAR',    span: 66 },
  bar:     { name: 'BARRICADE', span: 12 },
  loop:    { name: 'LOOP',   span: 208 }
};
export const CLIMB_H = 64;
export const TOOLS = ['climb', 'drop', 'hill', 'mesa', 'kick', 'bigkick', 'whoops', 'mud', 'turbo', 'river', 'car', 'bar', 'loop', 'lanes', 'erase', 'done'];
export const MIN_LEN = 500;                                             // built tracks must reach at least this far
const MAX_EDIT_M = 6000;
// a built track runs until three grid cells past the last thing placed
function trackLen(t) {
  let end = 0;
  for (const p of t.pieces) end = Math.max(end, p.x + PIECES[p.t].span / PX_M);
  return end ? Math.ceil((end + 3 * 10) / 10) * 10 : 0;
}
export const editMax = () => clamp(Math.max(ed.t.len + 300, 800), 0, MAX_EDIT_M);   // how far the cursor may roam
function tooShort() { ed.err = 2.2; sfx('mud'); }
function tryDone() {                                                 // leaving the editor: warn once if it's too short
  if (ed.t.len < MIN_LEN && !(ed.err > 0)) { tooShort(); return; }
  ed.err = 0; game.state = 'buildset'; game.stateT = 0;
}
const TRACKS_KEY = 'four-lane-scramble-tracks';
export let slots = [null, null, null];
try { const v = JSON.parse(localStorage.getItem(TRACKS_KEY) || 'null'); if (Array.isArray(v)) slots = [0, 1, 2].map(i => v[i] || null); } catch (e) {}
export const saveSlots = () => { try { localStorage.setItem(TRACKS_KEY, JSON.stringify(slots)); } catch (e) {} };
const newTrack = () => ({ tod: 'day', bg: 'grass', surf: 'dirt', crowd: true, len: 1500, pieces: [], best: 0 });
export const ed = { slot: 0, t: null, row: 0, curM: 60, lane: 1, n: 1, tool: 0, tb: 0, focus: 'lanes', holdT: 0, sure: false, fromBuilder: false };   // n: how many lanes the brush covers
export let slotSel = 0;

export function useTrackSettings(t) {                                   // the builder's look feeds the same settings a random track uses
  race.trk = { tod: t.tod, bg: t.bg, crowd: t.crowd, base: t.surf, sections: [], rivers: t.pieces.filter(p => p.t === 'river').length, riverAt: [] };
}
// which lanes a placed piece covers (older saves: rivers, climbs and drops always covered every lane)
const LEGACY_ALL = { river: 1, climb: 1, drop: 1 };
export function lanesOf(p) {
  if (p.n === undefined && LEGACY_ALL[p.t]) return [0, LANES - 1];
  const a = clamp(p.l | 0, 0, LANES - 1);
  return [a, Math.min(LANES - 1, a + (p.n || 1) - 1)];
}
// climbs and drops in one lane -> slope segments. Back to back they stack into one long slope; overlapping ones join
// up and carry on at the same steepness for the extra length; a drop that runs into a climb starts where it ends.
function slopeSegs(list) {
  const segs = [];
  for (const p of list.slice().sort((a, b) => a.x - b.x)) {
    const dir = p.t === 'climb' ? 1 : -1;
    let x0 = race.startX + p.x * PX_M, x1 = x0 + 240;
    const last = segs[segs.length - 1];
    if (last && x0 < last.x + last.w) {
      if (last.dir === dir) { if (x1 > last.x + last.w) { last.w = x1 - last.x; last.dh = dir * CLIMB_H * last.w / 240; } continue; }
      x0 = last.x + last.w; if (x1 - x0 < 40) x1 = x0 + 40;
    }
    segs.push({ x: x0, w: x1 - x0, dh: dir * CLIMB_H * (x1 - x0) / 240, dir });
  }
  return segs;
}
const linAt = (K, x) => {                                          // straight-line level through knots (0 before the first)
  if (!K.length || x <= K[0].x) return 0;
  if (x >= K[K.length - 1].x) return K[K.length - 1].h;
  let i = 0; while (K[i + 1].x < x) i++;
  const A = K[i], B = K[i + 1]; return A.h + (B.h - A.h) * (x - A.x) / (B.x - A.x);
};
// The lanes' ground levels. Where every lane does the same, it's one shared mountain, as before. Where they differ,
// the shared base follows the lowest lane, and each higher lane gets a shelf on top. Anything that goes below the
// start lifts the whole course up so the start is on a hilltop.
function compileSlopes(t) {
  const S = [];
  for (let l = 0; l < LANES; l++) S.push(slopeSegs(t.pieces.filter(p => (p.t === 'climb' || p.t === 'drop') && l >= lanesOf(p)[0] && l <= lanesOf(p)[1])));
  const key = (sg) => JSON.stringify(sg.map(e => [Math.round(e.x * 100), Math.round(e.w * 100), Math.round(e.dh * 100)]));
  const K = S.map(knotsOf);
  let low = 0; for (const k of K) for (const q of k) low = Math.min(low, q.h);
  const pre = -low;                                                  // how far up the start has to be
  const lift = () => { if (pre > 0.5) world.elev.push({ x: race.startX - 3000, w: 10, dh: pre }); };
  if (S.every(sg => key(sg) === key(S[0]))) {
    lift(); for (const g of S[0]) if (Math.abs(g.dh) >= 0.5) world.elev.push({ x: g.x, w: g.w, dh: g.dh });
    return;
  }
  let X = [...new Set(K.flatMap(k => k.map(q => q.x)))].sort((a, b) => a - b);
  const cross = [];
  for (let i = 0; i + 1 < X.length; i++) for (let p = 0; p < LANES; p++) for (let q = p + 1; q < LANES; q++) {
    const d0 = linAt(K[p], X[i]) - linAt(K[q], X[i]), d1 = linAt(K[p], X[i + 1]) - linAt(K[q], X[i + 1]);
    if (d0 * d1 < 0) cross.push(X[i] + (X[i + 1] - X[i]) * d0 / (d0 - d1));
  }
  X = [...X, ...cross].sort((a, b) => a - b).filter((x, i, A) => i === 0 || x - A[i - 1] > 0.01);
  const minAt = (x) => Math.min(...K.map(k => linAt(k, x)));
  const lowLane = (x) => { let b = 0; for (let l = 1; l < LANES; l++) if (linAt(K[l], x) < linAt(K[b], x) - 0.01) b = l; return b; };
  const isCross = (x) => cross.some(c => Math.abs(c - x) < 0.02);
  const M = [];
  for (let i = 0; i < X.length; i++) {                               // keep the lowest lane's own knots, so the base matches it exactly
    const x = X[i], lL = i > 0 ? lowLane((X[i - 1] + x) / 2) : -1, lR = i + 1 < X.length ? lowLane((x + X[i + 1]) / 2) : -1;
    if (i === 0 || i === X.length - 1 || isCross(x) || lL !== lR || K[lL].some(q => Math.abs(q.x - x) < 0.02)) M.push({ x, h: minAt(x) });
  }
  lift();
  for (let i = 0; i + 1 < M.length; i++) if (M[i + 1].x - M[i].x > 0.5) world.elev.push({ x: M[i].x, w: M[i + 1].x - M[i].x, dh: M[i + 1].h - M[i].h });
  world.shelf = [null, null, null, null];
  for (let l = 0; l < LANES; l++) {
    if (world.shelf[l] || X.every(x => linAt(K[l], x) - minAt(x) < 0.01)) continue;
    let b = l; while (b + 1 < LANES && key(S[b + 1]) === key(S[l])) b++;
    const o = { type: 'shelf', x: X[0], w: 1e7, K: K[l], off: pre, a: l, b };
    for (let m = l; m <= b; m++) world.shelf[m] = o;
  }
}
export function compileTrack(t) {
  world.lanes = [[], [], [], []]; world.decals = [[], [], [], []]; world.rivers = []; world.riverQ = []; world.elev = []; world.shelf = null; race.elevN = -1; world.cursor = Infinity;
  world.carSpots = [];
  const add = (l, o) => world.lanes[l].push(o);
  compileSlopes(t);
  if (world.elev.length) for (let l = 0; l < LANES; l++) add(l, { type: 'base', x: world.elev[0].x, w: 1e6, a: 0, b: LANES - 1 });
  if (world.shelf) for (let l = 0; l < LANES; l++) if (world.shelf[l]) add(l, world.shelf[l]);
  for (const p of t.pieces) {
    const x = race.startX + p.x * PX_M, [a, b] = lanesOf(p);
    for (let l = a; l <= b; l++) {
      if (p.t === 'hill') add(l, { type: 'hill', x, w: 200, h: 32 });
      else if (p.t === 'mesa') add(l, { type: 'hill', x, w: 420, h: 28, up: 110, dn: 110 });
      else if (p.t === 'kick') add(l, { type: 'ramp', x, w: 72, h: 36 });
      else if (p.t === 'bigkick') add(l, { type: 'ramp', x, w: 112, h: 66 });
      else if (p.t === 'jump') { add(l, { type: 'ramp', x, w: 72, h: 36 }); add(l, { type: 'hill', x: x + 292, w: 150, h: 28 }); }   // (older saves)
      else if (p.t === 'whoops') for (let i = 0; i < 3; i++) add(l, { type: 'hill', x: x + i * 110, w: 110, h: 16 });
      else if (p.t === 'mud') world.decals[l].push({ type: 'mud', x, w: 170, seed: Math.round(x) % 99991 + l * 7 });
      else if (p.t === 'turbo') world.decals[l].push({ type: 'turbo', x, w: 48, hit: false });
      else if (p.t === 'car') world.carSpots.push({ x, l });
    }
    if (p.t === 'river') world.rivers.push({ x, w: 140, a, b });
    else if (p.t === 'loop') { const k = (b - a + 1) >> 1; if (k) addLoop(x, b - k + 1, b, k, 0); else addLoop(x, a, b, 0, 0); }   // in on the near half, out on the half behind it
    else if (p.t === 'bar') for (let c = a; c <= b; c += 2) {      // a barricade stands across one or two lanes, so a wider one is several
      const o = { type: 'box', x, w: 12, n: 1, hit: false, a: c, b: Math.min(b, c + 1) };
      for (let l = o.a; l <= o.b; l++) world.decals[l].push(o);
    }
  }
  {                                                                // rivers that touch or overlap in a lane run together into one wider river
    const out = [];
    for (let l = 0; l < LANES; l++) {
      const iv = world.rivers.filter(r => l >= r.a && l <= r.b).map(r => [r.x, r.x + r.w]).sort((p, q) => p[0] - q[0]), m = [];
      for (const v of iv) { const last = m[m.length - 1]; if (last && v[0] <= last[1] + 0.5) last[1] = Math.max(last[1], v[1]); else m.push(v.slice()); }
      for (const [x0, x1] of m) out.push({ x: x0, w: x1 - x0, a: l, b: l });
    }
    world.rivers = out;
  }
  for (let l = 0; l < LANES; l++) for (const o of world.lanes[l]) {   // a kicker just short of a river in its lane runs right up to the bank
    if (o.type !== 'ramp') continue;
    const r = world.rivers.find(rv => (rv.a === undefined || (l >= rv.a && l <= rv.b)) && o.x + o.w > rv.x - 90 && o.x + o.w < rv.x + 20);
    if (r) o.x = r.x - 4 - o.w;
  }
  // identical pieces side by side become one solid block across those lanes
  const same = (o, q) => q.type === o.type && q.x === o.x && q.w === o.w;
  for (let l = 0; l < LANES; l++) for (const o of world.lanes[l]) {
    if (o.a !== undefined) continue;
    let b = l; while (b + 1 < LANES && world.lanes[b + 1].some(q => same(o, q) && q.a === undefined)) b++;
    for (let m = l; m <= b; m++) { const q = m === l ? o : world.lanes[m].find(q2 => same(o, q2) && q2.a === undefined); q.a = l; q.b = b; }
  }
}
// cars placed in the builder: they drive off up the road when the race starts, like the street race's traffic
export function builtTraffic() {
  traffic.length = 0;
  for (const c of world.carSpots || []) {
    const r = seededRand((Math.round(c.x) * 31 + c.l * 7 + 1) >>> 0), spr = Math.floor(r() * CAR_SPRITES.length), S = CAR_SPRITES[spr];
    const v = (60 + 20 * r()) / 0.4;
    traffic.push({ kind: 'car', spr, x: c.x, v, vT: v, lane: c.l, laneF: c.l, laneT: c.l, len: S.w / SC, top: S.h / SC, roll: r() * 40, bph: r(), bper: 1.6 + 1.8 * r() });
  }
  traffic.sort((a, b) => b.x - a.x);
}
const pieceSpanM = (p) => PIECES[p.t].span / PX_M;
function pieceAt(t, l0, l1, m0, m1) {                           // the top piece under the brush (lanes l0..l1) touching the cell m0..m1
  for (let i = t.pieces.length - 1; i >= 0; i--) {
    const p = t.pieces[i], [a, b] = lanesOf(p);
    if (a <= l1 && b >= l0 && p.x < m1 && p.x + pieceSpanM(p) >= m0) return i;   // (even a thin one, like a barricade)
  }
  return -1;
}
// Placing never wipes out what's already there: pieces stack on top of each other, climbs and drops that overlap
// join into one longer slope. Anything goes anywhere, on as many lanes as the brush covers. Erase takes the top piece off.
export function placePiece(kind, lane, m) {
  const t = ed.t, n = Math.min(ed.n, LANES - lane);
  m = clamp(Math.round(m), 40, MAX_EDIT_M);
  const same = (p) => p.t === kind && Math.abs(p.x - m) < 0.5 && p.l === lane && (p.n || 1) === n;
  const flat = kind === 'mud' || kind === 'turbo' || kind === 'river' || kind === 'climb' || kind === 'drop' || kind === 'car' || kind === 'bar' || kind === 'loop';
  if (flat && t.pieces.some(same)) { sfx('lane'); return; }      // a second identical piece in the same spot would change nothing
  if (kind === 'loop') { const [a, b] = loopSpan(lane, ed.n); if (t.pieces.some(p => p.t === 'loop' && Math.abs(p.x - m) < 0.5 && p.l === a && p.n === b - a + 1)) { sfx('lane'); return; } t.pieces.push({ t: kind, l: a, n: b - a + 1, x: m }); }
  else t.pieces.push({ t: kind, l: lane, n, x: m });
  sfx('land'); afterEdit();
}
function erasePiece(lane, m) {
  const i = pieceAt(ed.t, lane, Math.min(LANES - 1, lane + ed.n - 1), m, m + CELL_M);
  if (i >= 0) { ed.t.pieces.splice(i, 1); sfx('mud'); afterEdit(); }
}
function afterEdit() { ed.t.len = trackLen(ed.t); slots[ed.slot] = ed.t; saveSlots(); race.startX = 0; race.raceM = ed.t.len; compileTrack(ed.t); }

export function openSlots() { game.state = 'slots'; game.stateT = 0; }
export function openBuilder(slot) {
  game.mode = 'race'; ed.slot = slot; ed.t = slots[slot] || newTrack(); ed.row = 0; ed.sure = ed.sureTpl = false;
  slots[slot] = ed.t; saveSlots();
  ed.t.len = trackLen(ed.t); ed.err = 0;
  useTrackSettings(ed.t); race.startX = 0; race.raceM = ed.t.len; compileTrack(ed.t); view.camX = 0;
  game.state = 'buildset'; game.stateT = 0;
}
export function openEditor() { game.state = 'build'; game.stateT = 0; ed.err = 0; ed.focus = 'lanes'; ed.curM = clamp(ed.curM, 40, editMax()); }
export function raceBuilt() {
  const t = ed.t;
  if (t.len < MIN_LEN) { tooShort(); return; }
  ed.fromBuilder = true;
  useTrackSettings(t); race.raceM = t.len;
  newGame(t);
}
export const BROWS = ['TIME', 'SCENERY', 'SURFACE', 'CROWD', 'BUILD FROM TEMPLATE', 'EDIT TRACK', 'RACE IT', 'CLEAR TRACK', 'BACK TO MENU'];
const TPL_FEATS = FEATS.filter(f => f !== 'stunt');                // the random track types a slot can start from
export let tplFeat = 'random';
// BUILD FROM TEMPLATE: roll a random track of that type (2000 m, as a SHORT race), lay all of it down, and turn what's
// there into builder pieces. Shapes the builder doesn't have become the nearest piece it does: any kicker is a KICKER
// or a BIG KICKER, a long flat-topped hill a MESA, a low hump part of a WHOOPS; slopes become CLIMBs and DROPs (at the
// builder's steepness), a wide river or mud patch several pieces side by side, and the traffic parked CARs.
function templateTrack(feat) {
  const keepLen = race.raceLen, keepMode = game.mode;
  race.raceLen = 'short'; game.mode = 'race'; rollTrack(feat);
  const T = race.trk;
  newGame(null, false, { replay: true });
  while (world.cursor < finishX() + 200) genWith(genRow);
  const pieces = [], m = (x) => Math.round((x - race.startX) / PX_M), inRace = (x) => x - race.startX > 30 && x - race.startX < race.raceM * PX_M - 60;
  const add = (t, l, n, x) => { if (inRace(x)) pieces.push({ t, l, n, x: Math.max(40, m(x)) }); };
  // slopes: each run of climbing or dropping becomes as many CLIMB/DROP pieces as it rises or falls
  let lift = 0;
  for (const e of world.elev.slice().sort((p, q) => p.x - q.x)) {
    if (e.x < race.startX) { lift += e.dh; continue; }                        // (a downhill starts at the top: the builder lifts the start for us)
    const k = Math.max(1, Math.round(Math.abs(e.dh) / CLIMB_H));
    for (let i = 0; i < k; i++) add(e.dh > 0 ? 'climb' : 'drop', 0, LANES, e.x + i * e.w / k);
  }
  const seen = new Set();
  for (let l = 0; l < LANES; l++) for (const o of world.lanes[l]) {
    if (seen.has(o) || o.type === 'base' || o.type === 'shelf') continue; seen.add(o);
    const a = o.a === undefined ? l : o.a, n = (o.b === undefined ? l : o.b) - a + 1;
    if (o.type === 'ramp') add(o.h >= 52 ? 'bigkick' : 'kick', a, n, o.x + o.w - (o.h >= 52 ? 112 : 72));   // the lip stays where it was
    else if (o.type === 'hill') add(o.h < 20 ? 'whoops' : o.w >= 320 ? 'mesa' : 'hill', a, n, o.x + o.w / 2 - (o.h < 20 ? 165 : o.w >= 320 ? 210 : 100));
    else if (o.type === 'loop') add('loop', Math.min(o.a, o.a - o.shift), o.b - Math.min(o.a, o.a - o.shift) + 1, o.x);
  }
  for (let l = 0; l < LANES; l++) for (const d of world.decals[l]) {
    if (seen.has(d)) continue; seen.add(d);
    if (d.type === 'turbo') add('turbo', l, 1, d.x);
    else if (d.type === 'mud') for (let x = d.x; x < d.x + d.w - 20; x += 170) add('mud', l, 1, Math.min(x, d.x + d.w - 170));
    else if (d.type === 'box') add('bar', d.a, d.b - d.a + 1, d.x);
  }
  for (const r of world.rivers) for (let x = r.x; x < r.x + r.w - 10; x += 140) add('river', r.a === undefined ? 0 : r.a, r.a === undefined ? LANES : r.b - r.a + 1, Math.min(x, r.x + r.w - 140));
  for (const c of traffic) add('car', c.lane, 1, c.x);
  // one piece of a kind on the same spot in neighbouring lanes is one piece across those lanes
  pieces.sort((p, q) => p.x - q.x || p.l - q.l);
  const out = [];
  for (const p of pieces) {
    const q = out.find(q => q.t === p.t && q.x === p.x && q.l + q.n === p.l);
    if (q) q.n += p.n; else if (!out.some(q => q.t === p.t && q.x === p.x && q.l === p.l && q.n === p.n)) out.push(p);
  }
  const t = { tod: T.tod, bg: T.bg, surf: ['dirt', 'asphalt', 'ice'].includes(T.base) ? T.base : 'dirt', crowd: !!T.crowd, pieces: out };
  bots.length = 0; traffic.length = 0; race.raceLen = keepLen; game.mode = keepMode; ed.fromBuilder = false;
  return t;
}
export function cycle(list, v, d) { return list[(list.indexOf(v) + d + list.length) % list.length]; }
function builderSetting(d) {
  const t = ed.t, r = BROWS[ed.row];
  if (r === 'TIME') t.tod = cycle(TODS, t.tod, d);
  else if (r === 'SCENERY') t.bg = cycle(Object.keys(BGS), t.bg, d);
  else if (r === 'SURFACE') t.surf = cycle(['dirt', 'asphalt', 'ice'], t.surf, d);
  else if (r === 'CROWD') t.crowd = !t.crowd;
  else if (r === 'BUILD FROM TEMPLATE') { tplFeat = cycle(TPL_FEATS, tplFeat, d); ed.sureTpl = false; sfx('lane'); return true; }
  else return false;
  sfx('lane'); useTrackSettings(t); afterEdit(); return true;
}
function builderAction() {
  const r = BROWS[ed.row];
  if (r === 'EDIT TRACK') openEditor();
  else if (r === 'RACE IT') raceBuilt();
  else if (r === 'CLEAR TRACK') { if (ed.sure) { ed.t.pieces = []; ed.sure = false; afterEdit(); sfx('crash'); } else ed.sure = true; }
  else if (r === 'BUILD FROM TEMPLATE') {
    if (ed.sureTpl || !ed.t.pieces.length) {
      Object.assign(ed.t, templateTrack(tplFeat)); ed.sureTpl = false;
      game.state = 'buildset'; game.stateT = 0; useTrackSettings(ed.t); afterEdit(); view.camX = 0; sfx('turbo');
    } else ed.sureTpl = true;
  }
  else if (r === 'BACK TO MENU') { game.state = 'title'; game.stateT = 0; rollTitleLook(); }
}
export function rollTitleLook() { race.trk = { tod: 'evening', bg: 'dirt', crowd: true, base: 'dirt', sections: [], rivers: 0, riverAt: [] }; }

// input for the builder screens; returns true when it handled the press
export function builderPress(btn, tap) {
  if (tap && game.state === 'slots') { const i = Math.floor((tap.y - 40) / 18); if (i >= 0 && i < 4) { slotSel = i; btn = 'ok'; } else return true; }
  if (tap && game.state === 'buildset') {
    const i = Math.floor((tap.y - 24) / 11);
    if (i < 0 || i >= BROWS.length) return true;
    if (i !== ed.row) { ed.row = i; ed.sure = ed.sureTpl = false; sfx('lane'); if (i <= 4) return true; }
    if (i === 4) { const vx = W - 30 - (FEAT_NAME[tplFeat].length * 6 - 1); if (tap.x > vx - 14) { builderSetting(1); return true; } builderAction(); return true; }   // tap the type to change it, the words to build it   // the arrows pick the type; anywhere else on the row builds it
    btn = i < 4 ? (tap.x < W / 2 ? 'left' : 'right') : 'ok';      // tap the left/right half of a setting to step it
  }
  if (game.state === 'slots') {
    if (btn === 'up' || btn === 'down') { slotSel = (slotSel + (btn === 'up' ? 3 : 1)) % 4; sfx('lane'); }
    else if (btn === 'right' || btn === 'ok') { if (slotSel === 3) { game.state = 'title'; game.stateT = 0; } else openBuilder(slotSel); }
    else if (btn === 'left') { game.state = 'title'; game.stateT = 0; }
    return true;
  }
  if (game.state === 'buildset') {
    if (BROWS[ed.row] === 'BUILD FROM TEMPLATE' && btn !== 'up' && btn !== 'down') {   // left picks the type, right builds it
      if (btn === 'left') builderSetting(1); else builderAction();
      return true;
    }
    if (btn === 'up' || btn === 'down') { ed.row = (ed.row + (btn === 'up' ? BROWS.length - 1 : 1)) % BROWS.length; ed.sure = ed.sureTpl = false; sfx('lane'); }
    else if (btn === 'left' || btn === 'right') { if (!builderSetting(btn === 'left' ? -1 : 1) && btn === 'right') builderAction(); }
    else if (btn === 'ok') { if (!builderSetting(1)) builderAction(); }
    return true;
  }
  if (game.state === 'build') {
    if (tap) return editorTap(tap);
    if (ed.focus === 'tools') {
      if (btn === 'left' || btn === 'right') { ed.tool = (ed.tool + (btn === 'left' ? TOOLS.length - 1 : 1)) % TOOLS.length; sfx('lane'); }
      else if (btn === 'up') { if (ed.tool >= TB_COLS) { ed.tool -= TB_COLS; sfx('lane'); } else ed.focus = 'lanes'; }
      else if (btn === 'down') { if (ed.tool + TB_COLS < TOOLS.length) { ed.tool += TB_COLS; sfx('lane'); } }
      else if (btn === 'ok') { if (TOOLS[ed.tool] === 'done') tryDone(); else if (TOOLS[ed.tool] === 'lanes') stepLanes(); else ed.focus = 'lanes'; }
      return true;
    }
    if (btn === 'up') { if (ed.lane > 0) { ed.lane--; sfx('lane'); } }
    else if (btn === 'down') { if (ed.lane + ed.n < LANES) { ed.lane++; sfx('lane'); } else ed.focus = 'tools'; }
    else if (btn === 'left' || btn === 'right') { ed.curM = clamp(cellM() + (btn === 'left' ? -CELL_M : CELL_M), 0, editMax()); ed.holdT = 0; }
    else if (btn === 'ok') useTool();
    return true;
  }
  return false;
}
function useTool() {
  const tool = TOOLS[ed.tool];
  if (tool === 'done') tryDone();
  else if (tool === 'lanes') stepLanes();
  else if (tool === 'erase') erasePiece(ed.lane, cellM());
  else placePiece(tool, ed.lane, cellM());
}
function stepLanes() { ed.n = ed.n % LANES + 1; ed.lane = Math.min(ed.lane, LANES - ed.n); sfx('lane'); }   // the brush: 1, 2, 3, 4 lanes
export const TOOL_W = 30, TB_COLS = 8, TB_Y = 118, ED_UP = 16;          // the toolbar: two rows of eight; the scene rides 16 px higher to make room
export const viewLift = () => Math.round(view.camLift) - (game.state === 'build' ? ED_UP : 0) + (ATT.on ? ATT.lift || 0 : 0);
export const loopSpan = (lane, n) => n >= 3 ? [0, LANES - 1] : n === 2 ? [Math.min(lane, LANES - 2), Math.min(lane, LANES - 2) + 1] : lane > 0 ? [lane - 1, lane] : [0, 1];   // a loop: in on the near lane(s), out on the one(s) behind
export const CELL_M = 10;                                               // the editor snaps everything to a 10 m grid
export const cellM = () => clamp(Math.floor(ed.curM / CELL_M) * CELL_M, 0, editMax());
function editorTap(p) {                                          // p = scene coords of a tap on the screen
  if (p.y >= TB_Y - 1) {
    const i = clamp((p.y >= TB_Y + 16 ? TB_COLS : 0) + clamp(Math.floor(p.x / TOOL_W), 0, TB_COLS - 1), 0, TOOLS.length - 1); ed.tool = i; sfx('lane');
    if (TOOLS[i] === 'done') tryDone(); else if (TOOLS[i] === 'lanes') stepLanes();
    return true;
  }
  const wx = sxToWorld(p.x, view.camX), yc = p.y - viewLift();   // undo the camera; each lane rides its own ground
  for (let l = 0; l < LANES; l++) {
    const y = yc + Math.round(laneBase(l, wx) * SC);
    if (y >= LANE_SY[l] - 15 && y < LANE_SY[l] + 3) {
      ed.lane = Math.min(l, LANES - ed.n); ed.curM = clamp(Math.floor((wx - race.startX) / PX_M / CELL_M) * CELL_M, 0, editMax());
      ed.focus = 'lanes'; if (TOOLS[ed.tool] !== 'lanes') useTool(); return true;
    }
  }
  return true;
}
export function tickBuilder(dt) {
  if (ed.err > 0) ed.err -= dt;
  if (game.state === 'build') {
    const dir = (inp.padR ? 1 : 0) - (inp.padL ? 1 : 0);            // (the pad itself, not the tilt it maps to: right is always forward here)
    if (dir && ed.focus === 'lanes') {                             // hold to scroll, faster the longer you hold
      ed.holdT += dt;
      if (ed.holdT > 0.3) ed.curM = clamp(ed.curM + dir * (ed.holdT > 1.3 ? 220 : 50) * dt, 0, editMax());
    } else ed.holdT = 0;
    view.camX += ((race.startX + cellM() * PX_M - 70 / SC) - view.camX) * Math.min(1, dt * 12);
  } else if (game.state === 'buildset') view.camX += ((race.startX + 40 * PX_M) - view.camX) * Math.min(1, dt * 3);
}
