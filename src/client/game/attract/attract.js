// The intro video on the title screen: the real game, scripted, with a wipe between scenes.

import { KTHEMES } from '../art/riders.js';
import { ATT_SCENES, attLayers } from './scenes.js';
import { wideScene, wideWords } from './wide.js';
import { ctx, cv } from '../core/canvas.js';
import { G, SC, STEP, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { ATT, game, race, view } from '../core/state.js';
import { clamp, seededRand, wrapPi } from '../core/util.js';
import { drawStr, frameCache } from '../gfx/pixel.js';
import { render } from '../gfx/render.js';
import { bikeBases, flipBases, footBases } from '../gfx/riderSprites.js';
import { INTRO_T, tick, tickIntro } from '../race/loop.js';
import { LOOK_COLS, LOOK_SKIN, applyLook } from '../race/playerLook.js';
import { bots } from '../race/rivals.js';
import { bike, camAim, ensureWorld, fx, inp, laneYNow, newGame } from '../race/session.js';
import { laneMove } from '../rider/physics.js';
import { splashImg, splashOk } from '../ui/title.js';
import { slopeAt, terrain } from '../world/terrain.js';
import { world } from '../world/track.js';
import { traffic } from '../world/traffic.js';

/* ================= ATTRACT: the intro video =================
   Runs the real game, scripted: the title, the rider shooting off, a pan down to the start line, a race start, then
   a run of short scenes cut together with a diagonal wipe, and round again. Each scene sets the world up, dresses
   the riders, and drives the player's bike (and puppets the others' tricks) frame by frame. */
Object.assign(ATT, { scene: -1, t: 0, band: -1, exitT: -1, noOverlay: false, noHud: true, noWords: false, noCrash: true, noBotCrash: true, pan: -1, camTo: null, titleBg: false, lift: 0 });
let attRand = seededRand(1985);
const _random = Math.random;
Math.random = () => ATT.on ? attRand() : _random();             // (the video plays the same every time)
const ATT_KT = KTHEMES.map(t => t && Object.assign({}, t));          // the rivals' own looks, put back after


// ---- looks ----
export function attTheme(i, o) {
  const h = LOOK_COLS[o.hair], k = LOOK_SKIN[o.skin || 0], sh = LOOK_COLS[o.shirt], pa = LOOK_COLS[o.pants], bk = LOOK_COLS[o.bikeCol];
  KTHEMES[i] = { s: sh[0], S: sh[1], p: pa[0], P: pa[1], b: bk[0], B: bk[1], r: bk[0], f: h[0], h: h[1], i: k[0], j: k[1], head: o.head, bike: o.bike || 0 };
  bikeBases.clear(); footBases.clear(); flipBases.clear(); frameCache.clear();
}
export const LOOKS = {
  player: { head: 'helmet', hair: 0, skin: 0, shirt: 9, pants: 10, bike: 0, bikeCol: 3 },
  ghost:  { head: 'skull', hair: 4, skin: 0, shirt: 2, pants: 2, bike: 0, bikeCol: 2 },          // flaming skull, all in black, black bike
  clown:  { head: 'clown', hair: 6, skin: 0, shirt: 12, pants: 4, bike: 3, bikeCol: 3 },          // green hair, pink shirt, orange pants, the hot dog
  police: { head: 'cap', hair: 9, skin: 1, shirt: 9, pants: 2, bike: 0, bikeCol: 9 },             // blue cap, blue shirt, black pants, blue bike
  hado:   { head: 'mx', hair: 5, skin: 2, shirt: 4, pants: 2, bike: 1, bikeCol: 5 },
  mario:  { head: 'goggles', hair: 7, skin: 3, shirt: 6, pants: 13, bike: 0, bikeCol: 6 },
  rdm:    { head: 'long', hair: 5, skin: 5, shirt: 11, pants: 0, bike: 1, bikeCol: 11 },
  prof:   { head: 'prof', hair: 0, skin: 0, shirt: 0, pants: 13, bike: 2, bikeCol: 7 },
  bobby:  { head: 'bobby', hair: 10, skin: 4, shirt: 10, pants: 10, bike: 0, bikeCol: 0 },
  brodie: { head: 'brodie', hair: 13, skin: 1, shirt: 7, pants: 13, bike: 1, bikeCol: 4 },
  short:  { head: 'short', hair: 13, skin: 2, shirt: 3, pants: 9, bike: 0, bikeCol: 8 }
};

// ---- the world ----
export function attWorld(t, opts) {                                       // a fresh game in this place; opts.empty: an empty road
  ATT.titleBg = false; ATT.lift = 0;
  race.trk = Object.assign({ seed: 7, tod: 'day', bg: 'city', crowd: false, base: 'asphalt', sections: [], rivers: 0, riverAt: [], feature: 'normal' }, t);
  game.tut = null; race.raceM = opts.raceM || 2000;
  if (opts.stunt) { game.mode = 'stunt'; game.stuntLoops = opts.loops || [false, false]; newGame(null, true, { replay: true }); }
  else { game.mode = 'race'; newGame(null, false, { replay: true }); }
  if (opts.empty) { world.lanes = [[], [], [], []]; world.decals = [[], [], [], []]; world.rivers = []; world.cursor = Infinity; traffic.length = 0; }
  if (opts.noBots) bots.length = 0;
  game.stateT = INTRO_T; tickIntro(0);                                  // straight onto the line...
  if (!opts.count) { game.state = 'play'; game.stateT = 0; }                 // ...and away
  inp.back = inp.fwd = inp.up = inp.down = false;
  pilot = { tgt: 0, v: null, stable: true, air: null, flips: 0, pose: null, dir: 1, wasG: true, lane: null, lin: false };
  puppets.clear();
}
export function attPlace(r, x, lane, v) {                                    // put a rider down on the road here
  r.x = x; r.v = v; r.lane = r.laneF = r.laneT = lane; r.grounded = true; r.vy = 0;
  r.h = r.hv = terrain(lane, x); r.angle = slopeAt(lane, x); r.rel = 0; if (r === bike) { r.slopeS = r.angle; r.relVel = 0; r.angVel = 0; }
}
export function camHere() { view.camX = bike.x - view.camLag; view.camLift = camAim(laneYNow() - bike.hv * SC); ensureWorld(); }

// ---- driving the player's bike ----
export let pilot = null;
function airTime(h, vy, x, v, lane) {                              // how long until a jump comes down (and where)
  let t = 0;
  while (t < 8) { vy -= G * STEP; h += vy * STEP; x += v * STEP; t += STEP; if (vy < 0 && h <= terrain(lane, x)) break; }
  return { T: t, x };
}
function planAir() {
  const b = bike, A = airTime(b.h, b.vy, b.x, b.v, b.laneT);
  let n = pilot.flips; while (n > 0 && A.T < 0.8 * n + 0.8) n--;
  const land = slopeAt(b.laneT, A.x) + 0.05, a0 = b.angle;
  const aF = a0 + wrapPi(land - a0) + pilot.dir * 2 * Math.PI * n;   // n whole turns, ending at the landing angle
  pilot.air = { t: 0, T: A.T, a0, aF, n };
}
export const attEase = (u) => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
function pilotPre(dt) {
  const b = bike; if (!pilot || pilot.off || game.state !== 'play') return;
  if (pilot.v !== null) b.v = pilot.v;
  if (b.loop) { pilot.wasG = true; return; }
  if (b.grounded) {
    pilot.air = null; inp.up = inp.down = false;
    inp.back = pilot.tgt > 0.1; inp.fwd = false;
    if (pilot.lane !== null && b.laneT !== pilot.lane) laneMove(pilot.lane > b.laneT ? 1 : -1);
  } else {
    inp.back = inp.fwd = false;
    if (pilot.wasG || (!pilot.air && !b.hado)) planAir();
    if (b.hado) { pilot.air = null; return; }                       // (re-planned once the dash is over)
    const P2 = pilot.air; P2.t += dt;
    const r = (P2.t + dt) / Math.max(0.3, P2.T - 0.35), u = pilot.lin ? clamp(r, 0, 1) : attEase(r), want = P2.a0 + (P2.aF - P2.a0) * u;
    b.angVel = clamp((want - b.angle) / dt, -9, 9) / (1 - 1.8 * dt);
    const pose = pilot.pose, on = pilot.lin ? P2.t > 0.08 && P2.t < P2.T - 1.0 : P2.t > 0.2 && P2.t < Math.min(P2.T * 0.55, P2.T - 0.75);   // (a spin move: the pose held through the whole turn)
    inp.up = pose === 'superman' && on; inp.down = pose === 'invert' && on;
  }
  pilot.wasG = b.grounded;
}
function pilotPost(dt) {
  const b = bike;
  if (ATT.camTo !== null) { view.camX = ATT.camTo(); view.camLag = b.x - view.camX; if (ATT.camY) view.camLift = ATT.camY(); }   // (the camera on someone else)
  if (!pilot || pilot.off || game.state !== 'play') return;
  if (pilot.v !== null) { b.v = pilot.v; if (pilot.flame) b.tStack = [2.4, 2.4]; }
  if (pilot.stable && b.grounded && !b.loop) { b.rel += (pilot.tgt - b.rel) * Math.min(1, dt * 10); b.relVel *= 0.5; b.angle = b.slopeS + b.rel; }
}

// ---- puppeting the other riders' tricks ----
const puppets = new Map();                                         // bot -> its trick plan for this jump
function puppetPre() {
  for (const [o, p] of puppets) o.angle = p.base;                  // (their own physics never sees the flip)
}
function puppetPost() {
  for (const o of bots) {
    let p = puppets.get(o);
    if (!o.grounded && !o.loop && !p && o.plan) {
      const A = airTime(o.h, o.vy, o.x, o.v, o.lane);
      const k = Math.min(o.plan.flips, Math.max(0, Math.floor((A.T - 0.8) / 0.8)));
      p = { t: 0, T: A.T, k, dir: o.plan.dir, pose: o.plan.pose, base: o.angle }; puppets.set(o, p);
    }
    if (!p) continue;
    if (o.grounded) { puppets.delete(o); o.trick = null; o.trickP = 0; continue; }
    p.t += STEP; p.base = o.angle;
    const u = attEase(p.t / Math.max(0.3, p.T - 0.4));
    o.angle = p.base + p.dir * 2 * Math.PI * p.k * u;
    const inT = clamp((p.t - 0.15) / 0.3, 0, 1), outT = clamp((p.T - 0.55 - p.t) / 0.3, 0, 1);
    o.trick = p.pose && inT > 0 ? p.pose : null; o.trickP = Math.min(inT, outT);
  }
}

// ---- running it ----
const BAND = 0.3;                                                  // seconds for the band to cover the screen, and again to clear it
export function attGo(i) {
  const prev = ATT_SCENES[ATT.scene];
  if (prev && prev.end) prev.end();
  const S = ATT_SCENES[i];
  ATT.scene = i; ATT.t = 0; attRand = seededRand(1000 + i * 77);
  if (!S.keep) fx.popups.length = 0;
  wideScene(S);                                                    // (a wide splash picks the canvas's shape before the scene frames itself)
  S.setup();
}
const TITLE_HOLD = 5;                                                   // s: the title's last moment before the rider shoots off
export function frameTick(dt) {                                         // one fixed step: the game, or the intro video driving it
  if (!ATT.on) return tick(dt);
  const S = ATT_SCENES[ATT.scene];
  ATT.t += dt;
  if (S.name === 'title' && !game.artIn) ATT.t = Math.min(ATT.t, TITLE_HOLD);   // (the rest of the art is still on its way: the rider hangs in the sun until it lands)
  if (ATT.band >= 0) { ATT.band += dt; if (ATT.band > 2 * BAND) ATT.band = -1; }
  if (S.step) S.step(ATT.t, dt);
  puppetPre(); pilotPre(dt);
  tick(dt);
  pilotPost(dt); puppetPost();
  const nx = (ATT.scene + 1) % ATT_SCENES.length, wipe = !ATT_SCENES[nx].noWipe;
  if (wipe && ATT.band < 0 && ATT.t >= S.dur - BAND) ATT.band = 0;          // the band starts across...
  if (ATT.t >= S.dur && (!wipe || ATT.band >= BAND)) { attGo(nx); if (nx === 0) ATT.band = -1; }   // ...and the cut happens under it (back at the title, it doesn't sweep out again: the picture draws itself in instead)
}
export function frameRender() {                                         // one frame: the game, or the intro video over it
  if (!ATT.on) return render();
  attLayers();
  render();                                                       // (the pan is just the camera: see ATT.lift)
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (ATT.band >= 0) {                                             // the cut: a diagonal band sweeps across left to right; the scene changes while it covers the screen
    const Hc = cv.height, sl = 60, span = (u) => -sl - 4 + attEase(u) * (W + 2 * sl + 8);
    const lead = span(Math.min(1, ATT.band / BAND)), trail = ATT.band < BAND ? -1e4 : span((ATT.band - BAND) / BAND);
    ctx.fillStyle = '#140c3c'; ctx.beginPath(); ctx.moveTo(trail + sl, 0); ctx.lineTo(lead + sl, 0); ctx.lineTo(lead - sl, Hc); ctx.lineTo(trail - sl, Hc); ctx.closePath(); ctx.fill();
    for (const e of [lead, trail]) { if (e < -500) continue;
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(e + sl, 0); ctx.lineTo(e - sl, Hc); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = P.turbo; ctx.beginPath(); ctx.moveTo(e + sl, 0); ctx.lineTo(e - sl, Hc); ctx.stroke(); }
  }
  if ((game.state !== 'title' || ATT.keepWords) && splashOk()) {          // the title and PRESS TO START stay up over the whole video
    if (!wideWords()) {                                            // (a wide splash draws the words itself while it pushes in)
      const Hc = cv.height, y0 = Hc >= 310 ? Hc - 310 : -26;
      ctx.imageSmoothingEnabled = true;
      for (const k of ['bike', 'super', 'n1985']) ctx.drawImage(splashImg[k], -8, y0, 240, 310);
      ctx.imageSmoothingEnabled = false;
    }
    const Hc = cv.height;
    if (game.state !== 'title' && Math.sin(game.tNow * 5) > -0.3) {   // (the title screen draws its own)
      const s = 'PRESS TO START', sz = 2, w = s.length * 6 * sz - sz, x = Math.round((W - w) / 2), y = Hc - 30;
      for (let dx = -2; dx <= 2; dx += 2) for (let dy = -2; dy <= 2; dy += 2) if (dx || dy) drawStr(s, x + dx, y + dy, P.black, sz);
      drawStr(s, x, y, P.turbo, sz);
    }
  }
  ctx.restore();
}
export function attStart() { ATT.on = true; ATT.loops = 0; ATT.band = -1; attGo(0); }
export function attStop() {                                               // back to the game as it was: the menu's next
  const S = ATT_SCENES[ATT.scene]; if (S && S.end) S.end();
  Object.assign(ATT, { on: false, band: -1, titleBg: false, lift: 0, noOverlay: false, camTo: null, camY: null, pan: -1, exitT: -1, keepWords: false, noWords: false });
  for (let i = 1; i < KTHEMES.length; i++) if (ATT_KT[i]) KTHEMES[i] = Object.assign({}, ATT_KT[i]);
  applyLook(); bikeBases.clear(); footBases.clear(); flipBases.clear(); frameCache.clear();
  game.tut = null; game.mode = 'race'; bots.length = 0; traffic.length = 0; view.camLag = 0; fx.popups.length = 0; fx.parts.length = 0; fx.shake = 0;
  inp.back = inp.fwd = inp.up = inp.down = false; pilot = null;
  game.state = 'title'; game.stateT = 0;
}
