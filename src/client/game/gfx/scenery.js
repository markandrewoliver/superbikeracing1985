// Roadside scenery in front of the backdrop: the crowd, the barrier, the dither pattern, and lamp glow lists.

import { LIGHT_SPR } from '../art/vehicles.js';
import { ctx } from '../core/canvas.js';
import { BIKE_SX, SC, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { ATT, game, race, view } from '../core/state.js';
import { hash } from '../core/util.js';
import { rect } from './pixel.js';

/* ---------- backdrop, track, obstacles ---------- */
export const CROWD = [P.flag, P.hay, P.cyan, P.white, '#b800b8', P.green];
const ditherC = document.createElement('canvas'); ditherC.width = 2; ditherC.height = 2;
(() => { const g = ditherC.getContext('2d'); g.fillStyle = P.black; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1); })();
export const ditherPat = ctx.createPattern(ditherC, 'repeat');

// things that glow: drawn again after the lighting pass so they stay bright at night
view.emits = []; view.glows = [];                      // glows: streetlamps' pools of light
export const lit = () => race.trk.tod === 'night' || race.trk.tod === 'evening';
function emit(x, y, w, h, c) { rect(x, y, w, h, c); if (lit()) view.emits.push([x, y, w, h, c]); }

export function drawMid(cx) {
  if (race.trk.crowd) {
    rect(0, 31, W, 14, '#10002c');
    const co = cx * SC * 0.5, k0 = Math.floor(co / 4);
    for (let k = k0; k <= k0 + Math.ceil(W / 4) + 1; k++) {
      const sx = Math.round(k * 4 - co);
      for (let r = 0; r < 3; r++) {
        const h1 = hash(k * 11 + r * 131), bob = ((game.state === 'play' || game.state === 'finish') && Math.sin(game.tNow * (3 + h1 * 4) + k) > 0.7) ? 1 : 0;
        const col = CROWD[Math.floor(h1 * CROWD.length)], y = 32 + r * 4 - bob;
        rect(sx + 1, y, 2, 2, P.cream); rect(sx, y + 2, 4, 2, col);
      }
    }
    const bo = cx * SC * 0.8;
    for (let k = Math.floor(bo / 24); k <= Math.floor((bo + W) / 24); k++) {
      const sx = Math.round(k * 24 - bo), a = (k & 1) ? P.flag : P.white, b = (k & 1) ? P.white : P.flag;
      rect(sx, 44, 23, 5, a); rect(sx + 3, 46, 16, 1, b);
    }
    return;
  }
  const bg = race.trk.bg, co = cx * SC * 0.6;
  if (bg !== 'city') return;                                       // outdoors the scenery runs right down to the barrier
  const F = { city: ['#747474', '#5c5c5c'], grass: ['#00a800', '#58d854'], dirt: ['#8c5c00', '#ac7c00'], desert: ['#fcd8a8', '#f8b878'], arctic: ['#fcfcfc', '#d8f8fc'] }[bg];
  for (let y = 31; y < 49; y++) rect(0, y, W, 1, ((y >> 1) & 1) ? F[0] : F[1]);
  for (let k = Math.floor(co / 20) - 1; k <= Math.floor((co + W) / 20) + 1; k++) {
    const sx = Math.round(k * 20 - co), r = hash(k * 23 + 7), y = 33 + Math.floor(hash(k * 3 + 1) * 12);
    if (bg === 'city') rect(sx, 31, 1, 18, '#5c5c5c');
    else if (bg === 'grass') { if (r > 0.5) { rect(sx, y, 5, 3, '#005800'); rect(sx + 1, y - 1, 3, 1, '#005800'); } }
    else if (bg === 'dirt') { if (r > 0.45) { rect(sx, y, 4, 2, '#7c4800'); rect(sx + 1, y - 1, 2, 1, '#a4501c'); } }
    else if (bg === 'desert') { if (r > 0.6) { rect(sx, y - 4, 2, 6, '#00a800'); rect(sx - 2, y - 2, 2, 1, '#00a800'); rect(sx + 2, y - 3, 2, 1, '#00a800'); } else if (r > 0.35) rect(sx, y + 1, 3, 1, '#d8a050'); }
    else { if (r > 0.5) { rect(sx + 2, y - 6, 1, 8, '#7c4800'); rect(sx, y - 3, 5, 3, '#005800'); rect(sx + 1, y - 5, 3, 2, '#005800'); rect(sx + 1, y - 6, 3, 1, '#fcfcfc'); } }
  }
}
// trackside barrier (y 49..55)
export function drawBarrier(cx) {
  const co2 = cx * SC, bg = race.trk.bg;
  if (bg === 'city') {
    for (let k = Math.floor((co2 - BIKE_SX) / 16); k <= Math.floor((co2 - BIKE_SX + W) / 16); k++) {
      const sx = Math.round(BIKE_SX + k * 16 - co2);
      rect(sx, 49, 16, 6, '#bcbcbc'); rect(sx, 49, 16, 1, '#d8d8d8'); rect(sx, 54, 16, 1, '#747474'); rect(sx + 15, 49, 1, 6, '#747474');
      rect(sx + 4, 51, 8, 2, (k & 1) ? P.flag : P.white);
    }
    if (!(ATT.on && ATT.titleBg)) for (let k = Math.floor((co2 - BIKE_SX - 20) / 120); k <= Math.floor((co2 - BIKE_SX + W) / 120); k++) {   // Kenney's streetlights along the kerb, arm out over the road
      const sx = Math.round(BIKE_SX + k * 120 - co2), top = 55 - LIGHT_SPR.length * 2;
      LIGHT_SPR.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === 'p') rect(sx + x * 2, top + y * 2, 2, 2, '#c8e0ff'); });
      emit(sx + 10, top, 4, 4, '#fcfcd8');                       // the lamp (stays lit at night)
      if (lit()) view.glows.push([sx + 12, top + 4]);
    }
    return;
  }
  if (bg === 'desert') {
    for (let k = Math.floor((co2 - BIKE_SX) / 8); k <= Math.floor((co2 - BIKE_SX + W) / 8); k++) {
      const sx = Math.round(BIKE_SX + k * 8 - co2);
      rect(sx, 49, 7, 3, '#2c2c2c'); rect(sx, 52, 7, 3, '#2c2c2c'); rect(sx + 2, 50, 3, 1, '#747474'); rect(sx + 2, 53, 3, 1, '#747474');
    }
    return;
  }
  if (bg === 'arctic') {
    for (let x = 0; x < W; x++) { const u = x + co2, h = 3 + Math.round(2 * Math.sin(u / 6) + Math.sin(u / 2.3)); rect(x, 55 - h, 1, h, (Math.floor(u / 6) & 1) ? '#fcfcfc' : '#d8f8fc'); rect(x, 54, 1, 1, '#a4e4fc'); }
    return;
  }
  for (let k = Math.floor((co2 - BIKE_SX) / 13); k <= Math.floor((co2 - BIKE_SX + W) / 13); k++) {   // hay bales
    const sx = Math.round(BIKE_SX + k * 13 - co2);
    rect(sx, 49, 12, 6, (k & 1) ? P.hay : P.hayD); rect(sx + 2, 51, 8, 1, P.hayL); rect(sx + 2, 53, 8, 1, P.hayL);
  }
}
