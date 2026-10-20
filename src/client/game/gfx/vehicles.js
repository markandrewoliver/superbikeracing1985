// Drawing traffic, barricades, rivals, start and finish lines, particles and popups.

import { loadImg } from '../art/assets.js';
import { BAR_PAL, BAR_SPR, CAR_SPRITES } from '../art/vehicles.js';
import { ctx } from '../core/canvas.js';
import { BIKE_SX, LANE_SY, SC, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, race, view } from '../core/state.js';
import { clamp, wrapPi } from '../core/util.js';
import { drawBikeSprite, drawHado, drawInvert, drawMarioJump, drawRunner, drawUnsunk } from './bike.js';
import { drawSplash } from './lighting.js';
import { rect, text, wsx } from './pixel.js';
import { bikeBase, footBase } from './riderSprites.js';
import { stuntOnTrack } from './road.js';
import { stuntTrack } from '../modes/stunt.js';
import { bike, fx, laneYAt, laneYNow } from '../race/session.js';
import { rdmBody, rdmStage } from '../rider/secretMoves.js';
import { baseAt, laneBase, slopeAt, terrain } from '../world/terrain.js';

const carImgs = CAR_SPRITES.map(s => loadImg(s.src));
export function drawVehicle(o) {                                          // o.x is the back bumper
  const S = CAR_SPRITES[o.spr], im = carImgs[o.spr], sx = Math.round(wsx(o.x, view.camX));
  if (sx > W + 4 || sx + S.w < -4) return;
  const ly = Math.round(laneYAt(o.laneF)) - Math.round(terrain(o.lane, o.x) * SC);
  rect(sx + 2, ly - 1, S.w - 4, 2, P.dirtDD);                          // shadow
  if (im.complete && im.naturalWidth) {
    // now and then the body bobs up a pixel on its springs (a double bump), while the wheels stay on the road
    const u = (race.raceT + o.bph * o.bper) % o.bper, up = o.v > 20 && (u < 0.1 || (u > 0.17 && u < 0.24)) ? 1 : 0;
    const cut = Math.min(...S.hubs.map(hb => hb[1])) - 6, y0 = ly - S.h + 1;   // wheels below this row, body above
    if (up && cut > 2) { ctx.drawImage(im, 0, cut, S.w, S.h - cut, sx, y0 + cut, S.w, S.h - cut); ctx.drawImage(im, 0, 0, S.w, cut + 1, sx, y0 - up, S.w, cut + 1); }
    else ctx.drawImage(im, sx, y0);
    // the wheels turn: a dark mark goes round each hub, a quarter turn at a time, as fast as the car rolls
    const q = Math.floor((o.roll || 0) / 10 / (Math.PI / 2)) & 3, off = [[-2, -2], [0, -2], [0, 0], [-2, 0]][q];
    for (const [hx, hy] of S.hubs) rect(sx + hx + off[0], y0 + hy + off[1], 2, 2, '#3c3c3c');
  }
  view.lamps.push([sx + S.w - 1, ly - Math.min(S.h - 4, 12), 0]);           // headlight
}
const barCache = new Map();
function barFrame(lanes, k, f) {                                   // one pre-drawn barricade picture, as a canvas
  const key = lanes + '|' + k + '|' + f; let c = barCache.get(key); if (c) return c;
  const [dx, dy, rows] = BAR_SPR[lanes][k][f];
  c = document.createElement('canvas'); c.width = rows[0].length * 2; c.height = rows.length * 2; c.dx = dx * 2; c.dy = dy * 2;
  const g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') { g.fillStyle = BAR_PAL[r[x]]; g.fillRect(x * 2, y * 2, 2, 2); } });
  barCache.set(key, c); return c;
}
// A barricade standing across one or two lanes, angled so you see the face you're heading for.
// Hit it and it buckles, snaps, and lies wrecked in the road.
export function drawBarricade(o) {
  const sx = Math.round(wsx(o.x, view.camX)); if (sx > W + 40 || sx < -70) return;
  const k = 0;
  const t = o.hit ? race.raceT - o.ht : 0, f = !o.hit ? 0 : t < 0.08 ? 1 : t < 0.22 ? 2 : 3;
  const c = barFrame(o.b - o.a + 1, k, f), gy = LANE_SY[o.b] + 9 - Math.round(terrain(o.b, o.x) * SC);
  rect(sx - 1, gy - 9, 8, 1, P.dirtDD);                               // its shadow on the near lane
  ctx.drawImage(c, sx + c.dx, gy + c.dy);
}
export function drawRival(o) {
  const ly = Math.round(laneYAt(o.laneF)), th = o.theme;
  if (o.crash) {
    if (o.crash.splash) { drawSplash(wsx(o.x, view.camX), ly, o.crash.t); return; }
    const c = o.crash, q0 = c.bodies[0], q1 = c.bodies[1], bsx = wsx(q0.x, view.camX);
    if (bsx < -50 || bsx > W + 50) return;
    const gB = ly - Math.round(terrain(o.lane, q0.x) * SC);
    rect(Math.round(bsx) - 6, gB, 12, 1, P.dirtDD);
    if (c.ts === undefined) {
      drawUnsunk('bc' + th, bikeBase(0, 0, 0, 0, false, th), q0.rot, q0.x, ly - q0.h * SC, ly, o.lane);
      drawUnsunk('rag' + th, footBase('rag', th), q1.rot, q1.x, ly - q1.h * SC - 15 + 3 * Math.abs(Math.sin(q1.rot)), ly, o.lane);
      return;
    }
    const ct = c.t - c.ts;                                       // time since they came to rest
    const slope = slopeAt(o.lane, q0.x), u = clamp((ct - 0.8) / 0.5, 0, 1), e = 1 - (1 - u) * (1 - u);
    const rot = ct < 0.8 ? c.rot0 : slope + wrapPi(c.rot0 - slope) * (1 - e);
    drawUnsunk('bc' + th, bikeBase(0, 0, 0, 0, false, th), rot, q0.x, gB, ly, o.lane);
    const rx = q0.x - 13, hop = ct > 1.3 ? Math.sin(clamp((ct - 1.3) / 0.3, 0, 1) * Math.PI) * 8 : 0;
    drawRunner(wsx(rx, view.camX), ly - Math.round(terrain(o.lane, rx) * SC) - hop, ct < 0.3 ? 'sit' : ct < 0.8 ? 'stand' : ct < 1.3 ? 'lift' : 'jump', 1, th);
    return;
  }
  const sx = wsx(o.x, view.camX) + (o.loop ? o.loopDX * SC : 0); if (sx < -50 || sx > W + 50) return;
  if (o.loop) { drawBikeSprite(ly - Math.round(o.hv * SC), o.angle, 0, 0, 0, Math.floor(o.spin / 4.4) & 1, Math.floor(o.spin / 2.2) & 1, Math.round(sx), th); return; }
  const gy = ly - Math.round(terrain(o.lane, o.x) * SC), by = ly - Math.round(o.hv * SC);
  const air = clamp((gy - by) / 24, 0, 1), sw = Math.round(20 - air * 10);
  rect(Math.round(sx) - (sw >> 1), gy, sw, 2, P.dirtDD);
  let body = 0, mode = 0, bob = 0;
  if (o.grounded) {
    mode = o.landT > 0 ? 3 : 0;
    body = o.rel > 0.25 ? -2 : o.rel > 0.08 ? -1 : o.turbo ? 2 : 0;
    if (o.v > 60) bob = Math.floor(o.spin / (o.mud ? 2.2 : 4.4)) & 1;
  } else {
    mode = o.vy > 0 ? 1 : 2;
    if (o.trick === 'superman' && o.trickP > 0) { mode = 4; body = Math.max(1, Math.ceil(o.trickP * 3 - 0.01)); }
    if (o.trick === 'invert' && o.trickP > 0) { drawInvert(by, o.angle, o.trickP, Math.floor(o.spin / 2.2) & 1, Math.round(sx), th); return; }
  }
  if (o.rdm && rdmStage(o.rdm)) { mode = 5; body = rdmBody(o.rdm); }   // (a ghost of a run with a REDEEMER in it)
  if (o.mv) { mode = o.mv[0]; body = o.mv[1]; }                          // (...or a HEADSTAND or SUPER MARIO)
  const mj = o.mv && o.mv[0] === 7;
  drawBikeSprite(by, o.angle, o.grounded && o.rel > 0.04 ? 1 : 0, body, mode, bob, Math.floor(o.spin / 2.2) & 1, Math.round(sx), th, 0, mj);
  if (mj) drawMarioJump(Math.round(sx), by, o.mv, th);
  if (o.hdT >= 0) drawHado(Math.round(sx), by, o.angle, o.hdT);
}

// checkered line across every lane, with a banner over the track
// lane = which lane's strip of the line to draw; lane < 0 draws just the banner over the finish
export function drawLine(wx, cx, finish, lane) {
  if (lane >= 0 && game.mode === 'stunt' && stuntTrack.length && !stuntOnTrack(lane, wx)) return;   // stunt track: only across its two lanes
  const sx = Math.round(wsx(wx, cx));
  if (sx < -30 || sx > W + 30) return;
  const lift = Math.round((lane >= 0 ? laneBase(lane, wx) : baseAt(wx)) * SC);
  if (lift) { ctx.save(); ctx.translate(0, -lift); drawLine0(sx, finish, lane); ctx.restore(); } else drawLine0(sx, finish, lane);
}
function drawLine0(sx, finish, lane) {
  if (lane >= 0) {
    const y0 = LANE_SY[lane] - 15;
    for (let r = 0; r < 6; r++) for (let k = 0; k < 2; k++)
      rect(sx + k * 3, y0 + r * 3, 3, 3, finish ? (((r + k) & 1) ? P.black : P.white) : P.white);
    return;
  }
  if (!finish) return;
  rect(sx - 22, 36, 1, 19, P.gray); rect(sx + 27, 36, 1, 19, P.gray);
  rect(sx - 22, 33, 50, 10, P.black); rect(sx - 21, 34, 48, 8, P.flag);
  text('FINISH', sx + 3, 35, P.white, 1, 'center');
}

export function drawParts(cx) {
  for (const p of fx.parts) {
    if (p.t > p.life * 0.75 && (Math.floor(p.t * 30) & 1)) continue;          // blink out instead of fading
    const s = p.s > 2 ? 2 : 1;
    rect(Math.round(wsx(p.x, cx)), p.ly - Math.round(p.h * SC), s, s, p.c);
  }
}

export function drawPopups() {
  const by = laneYNow() - bike.hv * SC;
  for (const p of fx.popups) {
    if (p.t > p.life * 0.7 && (Math.floor(p.t * 20) & 1)) continue;
    text(p.text, BIKE_SX + 16, Math.round(by - 30 - p.slot * 9 - p.t * 8), p.color, 1);
  }
}
