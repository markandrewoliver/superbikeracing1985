// Pixel toolkit: rectangles, world-to-screen x, the bitmap font, and cached rotated sprite frames.

import { ctx } from '../core/canvas.js';
import { BIKE_SX, SC } from '../core/config.js';
import { P } from '../core/palette.js';

/* ---------- pixel toolkit ---------- */
ctx.imageSmoothingEnabled = false;
export const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
export const wsx = (wx, cx) => BIKE_SX + (wx - cx) * SC;           // world x -> screen x

// 5x7 bitmap font, one hex row per scanline
const FONT = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [28, 18, 17, 17, 17, 18, 28], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12], ' ': [0, 0, 0, 0, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0],
  '-': [0, 0, 0, 31, 0, 0, 0], "'": [4, 4, 8, 0, 0, 0, 0], '!': [4, 4, 4, 4, 4, 0, 4], '.': [0, 0, 0, 0, 0, 12, 12],
  '/': [1, 2, 2, 4, 8, 8, 16], ':': [0, 12, 12, 0, 12, 12, 0], '%': [24, 25, 2, 4, 8, 19, 3], '?': [14, 17, 1, 2, 4, 0, 4]
};
export function drawStr(s, x, y, color, size) {
  ctx.fillStyle = color;
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] || FONT[' '], gx = x + i * 6 * size;
    for (let r = 0; r < 7; r++) {
      const bits = g[r]; if (!bits) continue;
      for (let c = 0; c < 5; c++) if (bits & (16 >> c)) ctx.fillRect(gx + c * size, y + r * size, size, size);
    }
  }
}
export function text(s, x, y, color, size, align) {
  s = String(s).toUpperCase(); size = size || 1;
  const w = s.length * 6 * size - size;
  const px = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  drawStr(s, px + size, y + size, P.black, size);
  drawStr(s, px, y, color, size);
}

// rotated sprites are pre-baked into 32 fixed angles (nearest-neighbour), like frames on a cartridge
export const STEPS = 32, FRAME = 160, FC = 80;
export const frameCache = new Map();
export function rotFrame(id, base, k) {
  const key = id + '|' + k; let f = frameCache.get(key); if (f) return f;
  f = document.createElement('canvas'); f.width = FRAME; f.height = FRAME;
  const g = f.getContext('2d'); g.imageSmoothingEnabled = false;
  g.translate(FC, FC); g.rotate(-k * 2 * Math.PI / STEPS); g.drawImage(base, -base.ax, -base.ay);
  f.skull = base.skull; frameCache.set(key, f); return f;
}
