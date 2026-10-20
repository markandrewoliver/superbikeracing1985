// The intro video's scenes.

import { CAR_SPRITES } from '../art/vehicles.js';
import { LOOKS, attEase, attPlace, attTheme, attWorld, camHere, pilot } from './attract.js';
import { EXTRA, ctx, cv } from '../core/canvas.js';
import { LANES, SC, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { ATT, game, menu, race, view } from '../core/state.js';
import { seededRand } from '../core/util.js';
import { imgOk } from '../gfx/backdrop.js';
import { rect } from '../gfx/pixel.js';
import { drawBarrier } from '../gfx/scenery.js';
import { bots } from '../race/rivals.js';
import { bike, burst, camAim, fx, inp, laneYAt } from '../race/session.js';
import { laneMove } from '../rider/physics.js';
import { secretCode } from '../rider/secretMoves.js';
import { splashImg } from '../ui/title.js';
import { slopeAt, terrain } from '../world/terrain.js';
import { world } from '../world/track.js';
import { traffic } from '../world/traffic.js';

// ---- the scenes ----
// The title picture in two layers: the sky with the sun (its lower stripes, hidden behind the city in the picture,
// drawn back in), and the city. On the splash the city sits TITLE_DY lower than in the picture (the sun and rider
// where they always were); in the first race it stands on the trackside barrier, and scrolls a little as the riders go
// (mirrored copy by copy, so the joins match), while the sky stays put. Panning down, the city keeps pace with the
// road and the sky only half does.
const SKY_K = 0.5, CITY_K = 0.25;
export function attLayers() {
  if (ATT.skyC || !imgOk(splashImg.bg)) return;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
  const [src, sg] = mk(240, 310); sg.drawImage(splashImg.bg, 0, 0, 240, 310);
  const px = sg.getImageData(0, 0, 240, 310).data, sky = new ImageData(240, 310), city = new ImageData(240, 310);
  const CX = 119.5, CY = 171, R = 80.5, CUT = 228, STR = [232, 64, 152], STR2 = [248, 84, 120], NIGHT = [20, 12, 60];
  const stripe = (y) => (y >= 232 && y <= 235) || (y >= 240 && y <= 244) || (y >= 249 && y <= 251);
  const inSun = (x, y) => Math.abs(x + 0.5 - CX) <= Math.sqrt(Math.max(0, R * R - (y + 0.5 - CY) * (y + 0.5 - CY)));
  for (let y = 0; y < 310; y++) for (let x = 0; x < 240; x++) {
    const i = (y * 240 + x) * 4, c = [px[i], px[i + 1], px[i + 2]], same = (a) => a[0] === c[0] && a[1] === c[1] && a[2] === c[2];
    if (y < CUT) { for (let k = 0; k < 3; k++) sky.data[i + k] = c[k]; sky.data[i + 3] = 255; continue; }
    const s = inSun(x, y) && stripe(y) ? STR : NIGHT; for (let k = 0; k < 3; k++) sky.data[i + k] = s[k]; sky.data[i + 3] = 255;
    if (same(NIGHT) || (y < 246 && inSun(x, y) && (same(STR2) || (same(STR) && stripe(y))))) continue;   // (sky, or sun showing between the buildings)
    for (let k = 0; k < 3; k++) city.data[i + k] = c[k]; city.data[i + 3] = 255;
  }
  const [sc, sx] = mk(240, 310), [cc, cx] = mk(240, 310); sx.putImageData(sky, 0, 0); cx.putImageData(city, 0, 0);
  const [bc, bx] = mk(480, 620); bx.drawImage(sc, 0, 0, 480, 620); bx.drawImage(cc, 0, 2 * TITLE_DY, 480, 620);   // the splash: the city lowered
  ATT.skyC = sc; ATT.cityC = cc; ATT.bgC = bc;
}
export function attTitleBackdrop(cx) {                                    // the first race's backdrop (see above); false until the picture has loaded
  attLayers(); if (!ATT.skyC) return false;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
  ctx.imageSmoothingEnabled = false;
  const ys = SKY_Y0() - ATT.lift * (1 - SKY_K), yc = TITLE_BASE - 310, off = (cx - race.startX) * SC * CITY_K;
  rect(0, ys - 400, W, 401, '#140c3c'); ctx.drawImage(ATT.skyC, 0, ys);
  for (let n = Math.floor(off / 240); n <= Math.floor((off + W) / 240); n++) {
    const x = Math.round(n * 240 - off);
    if (n & 1) { ctx.save(); ctx.translate(x + 240, 0); ctx.scale(-1, 1); ctx.drawImage(ATT.cityC, 0, yc); ctx.restore(); }
    else ctx.drawImage(ATT.cityC, x, yc);
  }
  drawBarrier(cx);
  return true;
}
const TITLE_DY = 24, TITLE_BASE = 49, titleY0 = () => cv.height >= 310 ? cv.height - 310 : -26;   // (where the title picture sits on this screen)
const TITLE_LIFT = () => titleY0() + 310 - (EXTRA + TITLE_BASE) + TITLE_DY, SKY_Y0 = () => titleY0() - EXTRA - TITLE_LIFT() * SKY_K;   // the race: the title's city stands on the barrier. The splash shows the picture TITLE_DY lower (a strip of city off the bottom), so the pan starts from exactly that and the riders are still out of sight;   // the title picture's foot, above the trackside barrier (its dark ground runs on down to it); on the title screen its foot is the bottom of the screen, and the riders are still out of sight below
function laneClear(l, x0, x1) { return !traffic.some(q => (Math.round(q.laneF) === l || q.laneT === l) && q.x + q.len > x0 && q.x < x1); }
function aheadIn(l) { let d = 1e9; for (const q of traffic) if ((Math.round(q.laneF) === l || q.laneT === l) && q.x + q.len > bike.x - 20) d = Math.min(d, q.x - bike.x); return d; }
export const ATT_SCENES = [
  { name: 'title', dur: 6.3, setup() {                             // the title builds, holds, and the rider shoots off top right
      attWorld({ tod: 'night', bg: 'city', feature: 'normal', seed: 31 }, { count: true });
      bike.x = race.startX; camHere();
      game.state = 'title'; game.stateT = 0; menu.titleMenu = false; menu.titleSeen = false; ATT.exitT = -1; ATT.pan = -1;
      ATT.keepWords = (ATT.loops = (ATT.loops || 0) + 1) > 1;   // (round again: the title's words are already up, so they stay put while the rest builds)
    }, step(t) { if (t > 5.1) ATT.exitT = t - 5.1; } },
  { name: 'pan', dur: 3.2, setup() {                               // pan down from the sky onto the racers on the line
      attWorld({ tod: 'evening', bg: 'city', feature: 'normal', seed: 31 }, { count: true });
      attTheme(0, LOOKS.player); ATT.noOverlay = true; ATT.pan = 0; ATT.exitT = 9;
      ATT.titleBg = true; ATT.lift = TITLE_LIFT();                   // the title's sun and city are this race's backdrop: start framed exactly as the title was
    }, step(t) { game.stateT = 0; ATT.pan = attEase(t / 3.0); ATT.lift = Math.round(TITLE_LIFT() * (1 - ATT.pan)); if (t >= 3.0) { ATT.pan = -1; ATT.lift = 0; ATT.noOverlay = false; } }, noWipe: true },
  { name: 'go', dur: 4.2, setup() { game.state = 'play'; game.stateT = 0; },  // the camera's settled: they're off (no countdown)
    step(t) { if (game.state === 'play') { pilot.tgt = t > 1.0 ? 0.42 : 0.2; } }, noWipe: true, keep: true },
  { name: 'redeemer', dur: 5.2, setup() {                          // a REDEEMER, standing tall on a wheelie, past the pack
      attTheme(0, LOOKS.rdm); attTheme(1, LOOKS.short); attTheme(2, LOOKS.brodie); attTheme(3, LOOKS.bobby);
      attWorld({ tod: 'day', bg: 'grass', base: 'dirt', crowd: true, seed: 41 }, { empty: true, raceM: 8000 });
      attPlace(bike, 900, 2, 330); bots.forEach((o, i) => { attPlace(o, 1000 + i * 60, [0, 1, 3][i], 260); o.think = 9; });
      pilot.tgt = 0.05; camHere(); secretCode('redeemer'); this.w = false;
    }, step(t) { for (const o of bots) o.think = 9; if (t > 0.8) { pilot.tgt = 0.45; } } },
  { name: 'ghost', dur: 5.6, setup() {                             // night street race: the flaming skull at 400 kph, weaving through the traffic
      attTheme(0, LOOKS.ghost);
      attWorld({ tod: 'night', bg: 'city', feature: 'street', seed: 5 }, { empty: true, noBots: true, raceM: 8000 });
      attPlace(bike, 600, 1, 1000); pilot.v = 1000; pilot.flame = true; pilot.tgt = 0.06;
      const R = seededRand(77), lanes = [2, 0, 3, 1, 2, 0, 3, 1, 0, 2, 3, 1, 2, 0, 1, 3, 0, 2, 3, 1];
      let x = 1150;
      for (let i = 0; i < 22; i++) {
        const spr = Math.floor(R() * CAR_SPRITES.length), S = CAR_SPRITES[spr], len = S.w / SC, lane = lanes[i % lanes.length], v = (60 + 20 * R()) / 0.4;
        traffic.push({ kind: 'car', spr, x, v, vT: v, lane, laneF: lane, laneT: lane, len, top: S.h / SC, roll: R() * 40, bph: R(), bper: 1.6 + 1.8 * R() });
        if (R() < 0.45) { const l2 = (lane + 2) % 4; traffic.push({ kind: 'car', spr: (spr + 3) % CAR_SPRITES.length, x: x + 40, v, vT: v, lane: l2, laneF: l2, laneT: l2, len: CAR_SPRITES[(spr + 3) % CAR_SPRITES.length].w / SC, top: 10, roll: 0, bph: R(), bper: 2 }); }
        x += 330 + 220 * R();
      }
      traffic.sort((a, b) => b.x - a.x); camHere();
    }, step() {                                                    // steer for whichever lane stays open longest (the cars keep to their lanes)
      for (const q of traffic) { if (q.lane0 === undefined) q.lane0 = q.lane; q.lane = q.laneT = q.lane0; q.laneF = q.lane0; }
      const b = bike; if (!b.grounded || Math.abs(b.laneF - b.laneT) > 0.05) return;
      const here = aheadIn(b.laneT); if (here > 640) return;
      let best = b.laneT, bd = here;
      for (const l of [0, 1, 2, 3]) {
        if (l === b.laneT) continue;
        let ok = true; for (let k = Math.min(l, b.laneT); k <= Math.max(l, b.laneT); k++) if (k !== b.laneT && !laneClear(k, b.x - 50, b.x + 140 + 90 * Math.abs(k - b.laneT))) ok = false;
        if (!ok) continue; const a = aheadIn(l) - 40 * Math.abs(l - b.laneT); if (a > bd) { bd = a; best = l; }
      }
      if (best !== b.laneT) laneMove(best > b.laneT ? 1 : -1);
    } },
  { name: 'ramps', dur: 6.2, setup() {                             // a ramp race: everyone off the kickers at slightly different times, all doing different things
      attTheme(0, LOOKS.clown); attTheme(1, LOOKS.short); attTheme(2, LOOKS.bobby); attTheme(3, LOOKS.prof);   // (the clown on the hot dog among them)
      attWorld({ tod: 'morning', bg: 'beach', base: 'dirt', crowd: true, seed: 3 }, { empty: true, raceM: 8000 });
      const X0 = 1500, off = [70, 0, 140, 35];
      for (let l = 0; l < LANES; l++) world.lanes[l].push({ type: 'ramp', x: X0 + off[l], w: 120, h: 78, a: l, b: l, full: true });
      for (let l = 0; l < LANES; l++) world.decals[l].push({ type: 'turbo', x: X0 - 320 + off[l], w: 48, hit: false });
      attPlace(bike, X0 - 470, 1, 470); pilot.flips = 1; pilot.pose = 'invert'; pilot.dir = 1;
      const set = [[0, -40, { flips: 1, dir: -1, pose: 'superman' }], [2, 25, { flips: 2, dir: 1, pose: null }], [3, -80, { flips: 0, dir: 1, pose: 'superman' }]];
      bots.forEach((o, i) => { const [l, dx, plan] = set[i]; attPlace(o, X0 - 470 + dx, l, 470); o.tStack = [2.4, 2.4]; o.plan = plan; o.think = 9; o.wheelieT = 0; });
      pilot.v = 470; camHere();
    }, step() { bots.forEach((o, i) => { o.think = 9; o.v = [478, 462, 486][i]; }); } },
  { name: 'police', dur: 5.0, setup() {                            // two riders cruising... and the police go past at 400 kph, on his head
      attTheme(0, LOOKS.police); attTheme(1, LOOKS.rdm); attTheme(2, LOOKS.mario);
      attWorld({ tod: 'day', bg: 'city', seed: 21 }, { empty: true, raceM: 8000 });
      bots.length = 2; attPlace(bots[0], 3000, 1, 250); attPlace(bots[1], 2960, 2, 250);
      for (const o of bots) { o.think = 9; o.wheelieT = 0; }
      attPlace(bike, 3000 - 1900, 3, 1000); pilot.v = 1000; pilot.flame = true; pilot.tgt = 0;
      ATT.camTo = () => bots[0].x - 40; camHere(); this.done = false;
    }, step() { for (const o of bots) { o.think = 9; o.wheelieT = 0; } if (!this.done && bots[0].x - bike.x < 480) { this.done = true; secretCode('headstand'); } },
    end() { ATT.camTo = null; } },
  { name: 'wipeout', dur: 6.2, setup() {                           // three racers on a ramp course... and a fourth flies in from the top left and wipes out, horribly
      attTheme(0, LOOKS.short); attTheme(1, LOOKS.brodie); attTheme(2, LOOKS.bobby); attTheme(3, LOOKS.rdm);
      attWorld({ tod: 'day', bg: 'dirt', base: 'dirt', crowd: true, seed: 13 }, { empty: true, raceM: 8000 });
      const X0 = 1950, off = [0, 60, 110, 30];
      for (let l = 0; l < LANES; l++) world.lanes[l].push({ type: 'ramp', x: X0 + off[l], w: 110, h: 46, a: l, b: l, full: true });
      const set = [[0, 0, { flips: 1, dir: 1, pose: 'superman' }], [2, -50, { flips: 0, dir: 1, pose: 'invert' }], [3, 30, { flips: 1, dir: -1, pose: null }]];
      bots.forEach((o, i) => { const [l, dx, plan] = set[i]; attPlace(o, 1000 + dx, l, 470); o.plan = plan; o.think = 9; o.wheelieT = 0; });
      ATT.camTo = () => bots[0].x - 40; ATT.camY = () => camAim(laneYAt(1) - terrain(1, view.camX) * SC);
      attPlace(bike, 1000 - 40 - 170, 1, 650); const b = bike;   // just off the left of the screen, high up, faster than the pack, spinning
      b.grounded = false; b.h = b.hv = terrain(1, b.x) + 330; b.vy = 60; b.angle = -0.6; b.angVel = -6; b.airT = 0;
      pilot.off = true; ATT.noCrash = false; this.hit = false; camHere(); view.camX = ATT.camTo(); view.camLift = ATT.camY();
    }, step() {
      bots.forEach((o, i) => { o.think = 9; o.v = [470, 462, 478][i]; });
      const b = bike;
      if (game.state === 'play' && !b.grounded) { b.v = 650; b.angVel = -6 / (1 - 1.8 / 120); inp.back = inp.fwd = inp.up = inp.down = false;
        if (b.vy < 0 && b.h - terrain(b.lane, b.x) < 45) b.angle = slopeAt(b.lane, b.x) - 1.75; }   // (he comes down nose first)
      if (b.crash && !this.hit) {                                  // ...and make it a bad one
        this.hit = true; fx.shake = 12; burst(30, P.dust, 6, 40);
        const [q0, q1] = b.crash.bodies; if (q0) { q0.vx = 300; q0.vy += 160; q0.rv *= 1.8; } if (q1) { q1.vx = 360; q1.vy += 240; q1.rv *= 2; }
      }
    }, end() { ATT.camTo = null; ATT.camY = null; ATT.noCrash = true; } }
];
