// HOW TO PLAY: the professor, the message box, and the guided steps.

import { PROF, PROF_PAL } from '../art/professor.js';
import { sfx } from '../audio/sound.js';
import { EXTRA, ctx, cv } from '../core/canvas.js';
import { BIKE_SX, H, LANES, SC, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, race, view } from '../core/state.js';
import { clamp } from '../core/util.js';
import { rect, text, wsx } from '../gfx/pixel.js';
import { KS } from '../gfx/riderSprites.js';
import { syncPad } from '../input/pad.js';
import { ed, rollTitleLook } from './builder.js';
import { bots } from '../race/rivals.js';
import { bike, inp, laneYAt, newGame } from '../race/session.js';
import { LOOP_D, addLoop, knotsOf, terrain } from '../world/terrain.js';
import { world } from '../world/track.js';

/* ---------- how to play ---------- */
// A lone rider on an empty city road. A message box at the top walks through the controls one at a time; only the
// buttons for the current step light up and do anything. The words are the owner's own.
const TUT_MSG = {                                                  // (**...** = picked out in yellow)
  lanes: '**Switch lanes** with up and down.',
  wheelie: '**Speed up** by popping a wheelie with right.',
  wipe: '**Careful!** Lean too far and you can lose your balance.',
  balance: '**Balance** your bike by tilting forward with left.',
  air: '**Doing tricks** in the air gives you a big boost. See what each button can do.',
  land: '... But you have to **land the jump** cleanly.',
  ouch: 'Ouch! **Try again** -- you need to land flat on your wheels.',
  nice: "Nice! Let's try it out for real. There is **no slow-mo** in the real game.",
  freeCrash: '**Keep trying!** You can take the exit ramp at any time to end the tutorial.',
  freeLand: '**Nice!** You can take the exit ramp at any time to end the tutorial.'
};
// The professor's intro: before the lessons, he stands by your (empty) bike and explains the laws of bike racing,
// one page at a time in a box along the bottom, with his face in it. A press finishes the page, or moves on; it also
// moves on by itself. Then a quick fade, and you're on the bike, riding off on your own.
const PROF_PAGES = [
  'Bike racing follows the simple laws of physics.',
  '1. An object in motion speeds up when it pops a wheelie.',
  '2. The acceleration of an object depends on the sickness of the trick it just landed.',
  '3. The force of any impact at any speed is equal to a minor inconvenience.',
  "Ready? Let's give bike racing a try."
];
const profSprites = {};
function profSprite(set, k) {                                      // (his pixel art, at the game's 2 px per pixel)
  const key = set + k; if (profSprites[key]) return profSprites[key];
  const rows = PROF[set][k], c = document.createElement('canvas'); c.width = rows[0].length * KS; c.height = rows.length * KS; const x = c.getContext('2d');
  rows.forEach((r, y) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') { x.fillStyle = PROF_PAL[r[i]]; x.fillRect(i * KS, y * KS, KS, KS); } });
  return (profSprites[key] = c);
}
const PROF_CPS = 32, PROF_COLS = 31, PROF_WAIT = 2.4, PROF_FADE = 0.35;
const profWrap = (s) => { const out = []; let cur = ''; for (const w of s.toUpperCase().split(' ')) { if ((cur + ' ' + w).trim().length > PROF_COLS) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out; };
const profFull = (p) => profWrap(PROF_PAGES[p]).join(' ').length;
function profPress() {
  const I = game.tut.intro; if (I.out !== null) return;
  if (Math.floor(I.pt * PROF_CPS) < profFull(I.page)) { I.pt = profFull(I.page) / PROF_CPS + 0.001; return; }   // first press finishes the page
  if (I.page < PROF_PAGES.length - 1) { I.page++; I.pt = -0.3; I.doneAt = null; sfx('lane'); } else { I.out = 0; sfx('lane'); }
}
function profTick(dt) {
  const I = game.tut.intro, b = bike;
  if (I.out !== null) {                                            // fading out... then on the bike, and back in
    I.out += dt;
    if (I.out >= PROF_FADE && game.tut.stage === 'intro') { b.laneT = b.laneF = b.lane; inp.up = inp.down = false; tutGo('lanes'); I.fadeIn = 0; }
    return;
  }
  I.pt += dt;
  if (Math.floor(I.pt * PROF_CPS) >= profFull(I.page)) { if (I.doneAt === null) I.doneAt = I.pt; if (I.pt - I.doneAt > PROF_WAIT) profPress(); }
}
export function drawProf() {                                               // him, standing on the road beside the bike (only during the intro)
  const I = game.tut && game.tut.intro; if (!I || game.tut.stage !== 'intro') return;   // (gone by the time you're on the bike)
  const sx = Math.round(wsx(I.x, view.camX)) - Math.round((bike.x - view.camX) * SC); if (sx < -20 - W || sx > W + 20) return;   // (drawn inside the bike's shifted frame: undo it)
  const gy = Math.round(laneYAt(I.lane)) - Math.round(terrain(I.lane, I.x) * SC);
  const on = game.tut.stage === 'intro' && I.out === null, n = Math.floor(I.pt * PROF_CPS), talking = on && n > 0 && n < profFull(I.page) && (Math.floor(game.tNow * 8) & 1);
  const law = on && I.page >= 1 && I.page <= 3, s = profSprite('body', talking ? (law ? 'pointTalk' : 'talk') : law ? 'point' : 'idle');
  rect(sx - 9, gy + 1, 18, 2, P.dirtDD);
  ctx.drawImage(s, sx - s.width / 2, gy - s.height + 1 - (law && n < 6 ? 1 : 0));
}
export function drawProfBox() {                                            // the box along the bottom, with his face
  const I = game.tut.intro, BY = 104, n = Math.floor(I.pt * PROF_CPS), full = profFull(I.page), talking = n > 0 && n < full && (Math.floor(game.tNow * 8) & 1);
  rect(0, 132, W, H - 132, P.black);
  rect(4, BY, W - 8, H - BY - 4, P.black); rect(4, BY, W - 8, 1, P.white); rect(4, H - 5, W - 8, 1, P.white); rect(4, BY, 1, H - BY - 4, P.white); rect(W - 5, BY, 1, H - BY - 4, P.white);
  rect(8, BY + 4, 34, 34, '#1d2fb8'); rect(8, BY + 4, 34, 1, P.white); rect(8, BY + 37, 34, 1, P.white); rect(8, BY + 4, 1, 34, P.white); rect(41, BY + 4, 1, 34, P.white);
  ctx.drawImage(profSprite('por', talking ? 'talk' : 'idle'), 9, BY + 5);
  let left = n; profWrap(PROF_PAGES[I.page]).forEach((l, i) => { if (left > 0) text(l.slice(0, left), 46, BY + 6 + i * 10, P.white); left -= l.length + 1; });
  if (n >= full && (Math.floor(game.tNow * 2.5) & 1)) { const x = W - 14, y = H - 13; rect(x, y, 5, 1, P.white); rect(x + 1, y + 1, 3, 1, P.white); rect(x + 2, y + 2, 1, 1, P.white); }   // (done: press to go on)
}
export function drawProfFade() {
  const I = game.tut && game.tut.intro; if (!I) return;
  const a = I.out === null ? 0 : game.tut.stage === 'intro' ? clamp(I.out / PROF_FADE, 0, 1) : clamp(1 - (I.out - PROF_FADE) / PROF_FADE, 0, 1);
  if (a <= 0) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore();
}
game.tut = null;
const ALL4 = { up: 1, down: 1, left: 1, right: 1 };
const TILT_BACK = 'right', TILT_FWD = 'left';                     // on the ground: right leans back (wheelie, faster), left leans forward
// In the air the spin keeps its original feel: left spins you back, right spins you forward.
export function mapTilt() {
  if (!inp.fromPad) return;
  const air = !bike.grounded && !bike.loop;
  inp.back = air ? inp.padL : inp.padR;
  inp.fwd = air ? inp.padR : inp.padL;
}
export function tutAllow() {
  if (!game.tut) return ALL4;
  if (game.tut.stage === 'lanes') return { up: 1, down: 1 };
  if (game.tut.stage === 'wheelie') return { up: 1, down: 1, right: 1 };   // (no leaning forward yet)
  return ALL4;
}
export function tutLit() {
  if (!game.tut) return {};
  const s = game.tut.stage;
  if (s === 'lanes') return { up: 1, down: 1 };
  if (s === 'wheelie') return { right: 1 };
  if (s === 'balance') return { left: 1, right: 1 };
  if (s === 'air' || s === 'land') return ALL4;
  return {};
}
function tutMsg() {
  const s = game.tut.stage;
  if ((s === 'wheelie' || s === 'balance') && game.state === 'crash') return TUT_MSG.wipe;   // while he gets back on
  if (s === 'free') return game.tut.first === 'crash' ? TUT_MSG.freeCrash : game.tut.first === 'land' ? TUT_MSG.freeLand : TUT_MSG.nice;   // (the 'for real' message stays up till the first practice jump's done)
  if (s === 'land' && game.state === 'crash') return TUT_MSG.ouch;
  if (s === 'again') return TUT_MSG.ouch;
  return TUT_MSG[s] || '';
}
export function startTutorial() {
  race.trk = { seed: 1, tod: 'day', bg: 'city', crowd: false, base: 'asphalt', sections: [], rivers: 0, riverAt: [] };
  game.mode = 'tutorial'; ed.fromBuilder = false; race.raceM = 1e6;
  newGame(null, false, { replay: true });                         // nothing recorded
  bots.length = 0; world.lanes = [[], [], [], []]; world.decals = [[], [], [], []]; world.rivers = []; world.shelf = null; world.cursor = Infinity;   // an empty road
  game.tut = { stage: 'intro', t: 0, mark: null, hit: {}, rampX: null, allAt: null, hoverH: 300, slow: false, fade: 0, wiped: false };
  bike.x += 200; bike.lane = bike.laneF = bike.laneT = 1; bike.h = bike.hv = 0;   // (parked a little past the line, on the second lane, as in the mock-up)
  game.tut.intro = { page: 0, pt: -0.6, doneAt: null, out: null, x: bike.x - 27 / SC, lane: bike.lane };   // the professor, just behind the bike
  view.camLag = (158 - BIKE_SX) / SC;                                   // (the camera holds the pair of them mid-screen; it swings back as you ride off)
  game.state = 'play'; game.stateT = 0; syncPad();
}
function tutGo(stage) { game.tut.stage = stage; game.tut.mark = null; game.tut.st0 = game.tut.t; if (stage !== 'land') game.tut.slow = false; syncPad(); }
export function tutPress(btn) {
  if (game.tut.stage === 'intro') { profPress(); return; }
  if (!['up', 'down', 'left', 'right'].includes(btn) || !tutAllow()[btn]) return;
  const T = game.tut;
  if (T.stage === 'lanes' && (btn === 'up' || btn === 'down') && T.mark === null) T.mark = T.t;
  if (T.stage === 'wheelie' && btn === TILT_BACK && T.mark === null) T.mark = T.t;
  if (T.stage === 'balance' && btn === TILT_FWD && T.mark === null) T.mark = T.t;
  if (T.stage === 'air' && !bike.grounded) T.hit[btn] = true;
}
function tutSpawnRamp() {                                         // a kicker just off screen, so you reach it about three seconds after the cue
  const b = bike, x = b.x + Math.max((W - BIKE_SX) / SC + 20, b.v * 1.8);
  for (let l = 0; l < LANES; l++) world.lanes[l].push({ type: 'ramp', x, w: 96, h: 48, a: 0, b: LANES - 1 });
  game.tut.rampX = x;
}
const TUT_DIP = 128;                                                // how far the EXIT lanes fall away
function tutRise() {                                               // practice starts with the road climbing a rise, so the EXIT lanes have somewhere to drop to
  const b = bike, x = b.x + (W - BIKE_SX) / SC + 40, lift = { x, w: 360, dh: TUT_DIP };
  world.elev.push(lift); race.elevN = -1;
  for (let l = 0; l < LANES; l++) world.lanes[l].unshift({ type: 'base', x: x - 10, w: 1e7, a: 0, b: LANES - 1 });
  const o = { type: 'shelf', x, w: 1e7, K: knotsOf([lift]), off: 0, a: 0, b: 1, road: true };   // the top two lanes stay up where the bottom two drop
  world.shelf = [o, o, null, null]; world.lanes[0].push(o); world.lanes[1].push(o);
  game.tut.free = { at: x + 360, end: x + 360 };
}
function tutSpawnJump() {                                       // just off screen: on the top two lanes a boost, a loop and the kicker; the bottom two bend down and end (EXIT)
  const b = bike, F = game.tut.free;
  const lx = Math.max(b.x + (W - BIKE_SX) / SC + 560, F.end + 420 + 1300), kx = lx + LOOP_D, dx0 = lx - 420;   // a long run with the EXIT lanes open before each drop: time to choose
  world.decals[1].push({ type: 'turbo', x: lx - 90, w: 48, hit: false });
  addLoop(lx, 1, 1, 1, 80);                                        // built like the STUNT loops: in on the near lane, out on the one behind...
  world.lanes[0].push({ type: 'ramp', x: kx, w: 160, h: 110, a: 0, b: 0, full: true });   // ...straight into the kicker
  world.decals[2].push({ type: 'exitsign', x: dx0 - 150, w: 40 });                                    // a sign over the EXIT lanes...
  for (let l = 2; l <= 3; l++) for (const d of [-120, -40]) world.decals[l].push({ type: 'exitarrow', x: dx0 + d, w: 24 });   // ...and arrows bending down
  const segs = [{ x: dx0, w: 240, dh: -TUT_DIP }, { x: kx + 1500, w: 300, dh: TUT_DIP }];         // down and gone, then back up once the jump is well behind you
  world.elev.push(...segs); race.elevN = -1; F.end = kx + 1800;
  game.tut.jump = { pair: 0, lx, kx, edge: dx0, passed: false };
}
export function tutTick(dt) {
  const T = game.tut, b = bike; T.t += dt;
  if (T.intro) { if (T.intro.out !== null && T.stage !== 'intro') T.intro.out += dt; else profTick(dt); if (T.stage === 'intro') return; }
  if (T.stage === 'lanes') {
    if (T.mark !== null && T.t - T.mark >= 2) tutGo('wheelie');
  } else if (T.stage === 'wheelie') {                             // pop a wheelie: on to balancing once he's wiped out and got back on, or after a few seconds of it
    if (game.state === 'crash') T.wiped = true;
    else if (game.state === 'play' && (T.wiped || (T.mark !== null && T.t - T.mark >= 4))) { T.wiped = false; tutGo('balance'); }
  } else if (T.stage === 'balance' || T.stage === 'again') {
    if (game.state === 'crash' && T.stage === 'balance') {             // wiped out while learning to balance: start this step over once he's back on (and no ramp waiting for him)
      if (T.rampX !== null) { for (let l = 0; l < LANES; l++) world.lanes[l] = world.lanes[l].filter(o => !(o.type === 'ramp' && o.x === T.rampX)); T.rampX = null; }
      T.mark = null; T.st0 = T.t;
    } else if (game.state === 'crash') { if (T.mark === null) T.mark = T.t; }
    if (T.stage === 'balance' && T.mark === null && game.state === 'play' && T.t - T.st0 >= 6) T.mark = T.t;   // (never leaned forward: on with it anyway)
    if (T.rampX !== null && game.state === 'play' && b.grounded && T.rampX + 96 < b.x - 4) T.rampX = null;   // only if you're already past the ramp do you need a new one
    if (T.stage === 'again' && T.mark === null) T.mark = T.t - 1.2;
    if (T.mark !== null && game.state === 'play' && T.rampX === null && T.t - T.mark >= (T.stage === 'balance' ? 2 : 1.2)) tutSpawnRamp();
    if (T.rampX !== null && game.state === 'play' && !b.grounded && b.x > T.rampX) {   // off the kicker: up into the sky
      const A = Math.max(-EXTRA + 76, (H - EXTRA) / 2 - 10);
      T.hoverH = Math.max(260, 2 * (140 - A) + 60);                // high enough that the ground drops out of view
      T.allAt = null; tutGo('air');
    }
  } else if (T.stage === 'air') {
    if (T.allAt === null && T.hit.up && T.hit.down && T.hit.left && T.hit.right) T.allAt = T.t;
    if (T.allAt !== null && T.t - T.allAt >= 3) { tutGo('land'); T.slow = true; }
  } else if (T.stage === 'land') {
    if (game.state === 'crash') T.slow = false;
    else if (game.state === 'play' && T.slow === false && T.crashSeen) { T.crashSeen = false; T.rampX = null; tutGo('again'); }
    else if (game.state === 'play' && b.grounded) tutGo('nice');
    if (game.state === 'crash') T.crashSeen = true;
  } else if (T.stage === 'nice') {
    if (T.mark === null) T.mark = T.t;
    if (T.t - T.mark >= 1 && !b.tStack.length && game.state === 'play' && b.grounded) { T.jump = null; tutGo('free'); tutRise(); }   // on as soon as the trick boost has worn off
  } else if (T.stage === 'free') {                               // practice at full speed: a boost, a loop and a big kicker, again and again
    if (!T.first && game.state === 'crash' && T.jump) T.first = 'crash';
    if (T.exiting) { if (bike.v < 60) T.fade += dt / 1.0; }      // fade out once you've pulled up
    else if (game.state === 'play') {
      const J = T.jump;
      if (!T.first && J && b.x > J.kx && !b.grounded) T.flying = true;            // (off the first kicker...)
      if (!T.first && T.flying && b.grounded) T.first = 'land';                      // (...and down on his wheels)
      if (!J && b.grounded && !b.loop && b.x > T.free.at) tutSpawnJump();
      if (J && !b.loop && b.grounded && b.laneT === 0 && b.x > J.lx - 360 && b.x < J.lx) b.laneT = 1;   // the loop goes in from the second lane: ease over onto it
      else if (J && !J.passed && !b.loop && b.x > J.edge - 260 && b.lane >= 2) { J.passed = true; T.exiting = true; T.stopX = J.edge + 10; }   // on an EXIT lane: pull up at the edge, and fade out
      else if (J && !J.passed && b.x > J.lx + 20) J.passed = true;
      else if (J && J.passed && b.grounded && !b.loop && b.x > J.kx + 400 && b.lane <= 1) T.jump = null;
    }
    if (T.fade >= 1) { game.tut = null; game.mode = 'race'; game.state = 'title'; game.stateT = 0; rollTitleLook(); inp.back = inp.fwd = inp.up = inp.down = false; syncPad(); }
  }
}
let tutBox = { msg: null, t: 0 };
export function drawTutBox() {                                            // the message box across the top: it goes away between messages, then comes back typing the next one out
  const msg = tutMsg();
  if (msg !== tutBox.msg) { tutBox.msg = msg; tutBox.t = game.tNow; }
  const age = game.tNow - tutBox.t - 0.45;
  if (!msg || age < 0) return;
  const plain = msg.replace(/\*\*/g, ''), hi = [];                 // which letters are in **...** (yellow)
  { let on = false; for (let i = 0; i < msg.length; i++) { if (msg.startsWith('**', i)) { on = !on; i++; continue; } hi.push(on); } }
  const words = plain.toUpperCase().split(' '), lines = [];
  let cur = '', st = 0, ls = [];
  for (const w of words) { if ((cur + ' ' + w).trim().length > 36) { lines.push(cur); ls.push(st); st += cur.length + 1; cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) { lines.push(cur); ls.push(st); }
  const h = lines.length * 10 + 8;
  rect(4, 4, W - 8, h, P.black); rect(4, 4, W - 8, 1, P.white); rect(4, 3 + h, W - 8, 1, P.white); rect(4, 4, 1, h, P.white); rect(W - 5, 4, 1, h, P.white);
  let n = Math.floor(age * 32);                                     // letters typed so far
  lines.forEach((l, i) => { for (let c = 0; c < Math.min(n, l.length); c++) if (l[c] !== ' ') text(l[c], 10 + c * 6, 9 + i * 10, hi[ls[i] + c] ? P.turbo : P.white); n -= l.length + 1; });
}
