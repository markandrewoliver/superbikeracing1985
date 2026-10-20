// Time-of-day lighting: tinting the scene, headlight beams and lamps, and the river splash.

import { ctx } from '../core/canvas.js';
import { LANE_SY } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, view } from '../core/state.js';
import { hash } from '../core/util.js';
import { rect } from './pixel.js';

// ---- time-of-day lighting: tint the scene, then let headlights and lamps shine through ----
export const LIGHT = { day: null, morning: { tint: '#f4e0d0' }, evening: { tint: '#a890b0', beam: 0.55, lit: '#e4dad2' }, night: { tint: '#4c5894', beam: 1, lit: '#b4a4b4' } };   // lit: what a headlight brings it up to
view.lamps = []; view.fires = [];                                        // fires: the flaming skull's flames, a flickering light of their own
// Lighting works in two layers so glowing windows and lamps never paint over the riders:
// the backdrop is tinted and its lights re-lit first, then the track and riders are drawn on their
// own layer, tinted on their own, and laid on top. Headlight beams go last.
export const fgC = document.createElement('canvas'), maskC = document.createElement('canvas'), lightC = document.createElement('canvas');
const lightCtx = lightC.getContext('2d');
view.lightOff = [0, 0];                                            // where the track layer's (0,0) sits on the canvas
export const fgCtx = fgC.getContext('2d'), maskCtx = maskC.getContext('2d');
// The track layer is lit with a light map: the night's tint everywhere, brightened where light falls, then multiplied in.
// Headlights throw a soft pool down the rider's own lane, brightest just ahead, fading with distance and into the
// lanes either side; streetlamps light a pool of road under them.
function lightMap(L) {
  const g = lightCtx, [ox, oy] = view.lightOff;
  if (lightC.width !== fgC.width || lightC.height !== fgC.height) { lightC.width = fgC.width; lightC.height = fgC.height; }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = L.tint; g.fillRect(0, 0, lightC.width, lightC.height);
  if (!L.beam) return;
  g.globalCompositeOperation = 'lighten';
  const pool = (cx, cy, rx, ry, fx, strength) => {                 // an elliptical pool, brightest at (cx + fx, cy)
    g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(fx, 0, 0, 0, 0, rx);
    const c = L.lit, r = parseInt(c.slice(1, 3), 16), gg = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
    gr.addColorStop(0, 'rgba(' + r + ',' + gg + ',' + b + ',' + strength + ')');
    gr.addColorStop(0.55, 'rgba(' + r + ',' + gg + ',' + b + ',' + (strength * 0.7) + ')');
    gr.addColorStop(1, 'rgba(' + r + ',' + gg + ',' + b + ',0)');
    g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  };
  for (const [lx, ly, a] of view.lamps) {                                // headlights, turned with the bike
    g.save(); g.translate(Math.round(lx + ox), Math.round(ly + oy)); g.rotate(-a);
    pool(78, 4, 96, 28, -70, 1);                                    // down the lane ahead (tall enough to light what stands in it)
    g.restore();
  }
  for (const [gx, gy] of view.glows) pool(gx + ox, LANE_SY[0] + 2 + oy, 46, 22, 0, 0.85);   // streetlamps: a pool on the back lanes
  for (const [fx, fy, fc] of view.fires) {                               // flames: a round, flickering glow in their own colour
    const fl = 0.85 + 0.15 * Math.sin(game.tNow * 23 + fx) * Math.sin(game.tNow * 9.7), R = 30 * fl;
    const r = parseInt(fc.slice(1, 3), 16), gg = parseInt(fc.slice(3, 5), 16), b = parseInt(fc.slice(5, 7), 16), mix = (v) => Math.round(v + (255 - v) * 0.35);
    const gr = g.createRadialGradient(fx + ox, fy + oy, 0, fx + ox, fy + oy, R);
    gr.addColorStop(0, 'rgba(' + mix(r) + ',' + mix(gg) + ',' + mix(b) + ',' + 0.95 * fl + ')');
    gr.addColorStop(0.4, 'rgba(' + mix(r) + ',' + mix(gg) + ',' + mix(b) + ',' + 0.55 * fl + ')');
    gr.addColorStop(1, 'rgba(' + r + ',' + gg + ',' + b + ',0)');
    g.fillStyle = gr; g.fillRect(fx + ox - R, fy + oy - R, R * 2, R * 2);
  }
}
export function tintLayer(L) {                                          // multiply by the light map, only where the layer has pixels
  if (!L) return;
  lightMap(L);
  maskCtx.globalCompositeOperation = 'copy'; maskCtx.drawImage(fgC, 0, 0); maskCtx.globalCompositeOperation = 'source-over';
  fgCtx.save(); fgCtx.setTransform(1, 0, 0, 1, 0, 0);
  fgCtx.globalCompositeOperation = 'multiply'; fgCtx.drawImage(lightC, 0, 0);
  fgCtx.globalCompositeOperation = 'destination-in'; fgCtx.drawImage(maskC, 0, 0);
  fgCtx.restore();
}
export function drawBeams(L) {                                          // the lamps themselves glow (the light they throw is in the light map)
  if (!L || !L.beam) return;
  ctx.globalCompositeOperation = 'lighter';
  const halo = (x, y, r, al) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(252,236,190,' + al + ')'); gr.addColorStop(1, 'rgba(252,236,190,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const [lx, ly] of view.lamps) halo(lx, ly, 7, 0.35 * L.beam);
  for (const [gx, gy] of view.glows) halo(gx, gy, 9, 0.4 * L.beam);
  for (const [fx, fy, fc] of view.fires) {                               // and the flames themselves glow
    const r = parseInt(fc.slice(1, 3), 16), gg = parseInt(fc.slice(3, 5), 16), b = parseInt(fc.slice(5, 7), 16), R = 10 + Math.sin(game.tNow * 19 + fx) * 1.5;
    const gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, R); gr.addColorStop(0, 'rgba(' + r + ',' + gg + ',' + b + ',' + 0.45 * L.beam + ')'); gr.addColorStop(1, 'rgba(' + r + ',' + gg + ',' + b + ',0)');
    ctx.fillStyle = gr; ctx.fillRect(fx - R, fy - R, R * 2, R * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const [lx, ly] of view.lamps) rect(Math.round(lx) - 1, Math.round(ly) - 1, 2, 2, P.white);
}
export function drawSplash(sx, gy, t) {
  sx = Math.round(sx);
  if (t < 1) for (let k = 0; k < 12; k++) {                         // a plume of droplets
    const vx = (k - 5.5) * 9, vy = 55 + hash(k * 7) * 45, x = sx + vx * t, y = gy - (vy * t - 110 * t * t);
    if (y < gy + 2) rect(Math.round(x), Math.round(y), 2, 2, k & 1 ? P.white : '#a4e4fc');
  }
  for (let k = 0; k < 3; k++) { const r = Math.round(((t * 14 + k * 5) % 15) + 2); rect(sx - r, gy - 1, r * 2, 1, '#a4e4fc'); }
}
