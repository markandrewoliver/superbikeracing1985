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
// ROTSPRITE: a turned frame is made from the art enlarged 8x with a pixel-art scaler (Scale2x, three times), turned, and
// sampled back down at screen resolution, so lines stay unbroken and single pixels survive. Every angle goes through it,
// upright too, so a sprite looks the same however it is turned. (Super Bike Workshop, section 1.)
function rsScale2x(src, w, h) {
  const out = new Uint32Array(w * h * 4), W2 = w * 2, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    out[(2 * y) * W2 + 2 * x] = C === A && C !== D && A !== B ? A : P;
    out[(2 * y) * W2 + 2 * x + 1] = A === B && A !== C && B !== D ? B : P;
    out[(2 * y + 1) * W2 + 2 * x] = D === C && D !== B && C !== A ? C : P;
    out[(2 * y + 1) * W2 + 2 * x + 1] = B === D && B !== A && D !== C ? D : P;
  }
  return out;
}
function rsArt(base) {                                               // the art behind a picture: its own pixels when it's drawn in 2x2 blocks, else the picture itself
  if (base.rsArt) return base.rsArt;
  const w = base.width, h = base.height, d = new Uint32Array(base.getContext('2d').getImageData(0, 0, w, h).data.buffer);
  const clean = (v) => (v >>> 24) > 100 ? (v | 0xff000000) >>> 0 : 0;
  let blocks = w % 2 === 0 && h % 2 === 0 && (base.ax | 0) % 2 === 0 && (base.ay | 0) % 2 === 0;
  for (let y = 0; blocks && y < h; y += 2) for (let x = 0; x < w; x += 2) { const v = d[y * w + x]; if (d[y * w + x + 1] !== v || d[(y + 1) * w + x] !== v || d[(y + 1) * w + x + 1] !== v) { blocks = false; break; } }
  const s = blocks ? 2 : 1, aw = w / s, ah = h / s; let a = new Uint32Array(aw * ah);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) a[y * aw + x] = clean(d[(y * s) * w + x * s]);
  let bw = aw, bh = ah; for (let i = 0; i < 3; i++) { a = rsScale2x(a, bw, bh); bw *= 2; bh *= 2; }
  return (base.rsArt = { s, big: a, bw, bh });
}
// Paint base (anchored at base.ax, base.ay) turned by angle a onto a w x h canvas with its anchor at (cx, cy).
export function rotSprite(base, a, w, h, cx, cy) {
  const f = document.createElement('canvas'); f.width = w; f.height = h;
  const g = f.getContext('2d'), A = rsArt(base), ca = Math.cos(a), sa = Math.sin(a), img = g.createImageData(w, h), o = new Uint32Array(img.data.buffer), m = 8 / A.s;
  const ax = base.ax || 0, ay = base.ay || 0;
  for (let oy = 0; oy < h; oy++) for (let ox = 0; ox < w; ox++) {
    const dx = ox + 0.5 - cx, dy = oy + 0.5 - cy, sx = dx * ca - dy * sa + ax, sy = dx * sa + dy * ca + ay;   // back into the picture
    const bx = Math.floor(sx * m), by = Math.floor(sy * m);
    if (bx >= 0 && by >= 0 && bx < A.bw && by < A.bh) o[oy * w + ox] = A.big[by * A.bw + bx];
  }
  g.putImageData(img, 0, 0);
  return f;
}
export function rotFrame(id, base, k) {
  const key = id + '|' + k; let f = frameCache.get(key); if (f) return f;
  f = rotSprite(base, k * 2 * Math.PI / STEPS, FRAME, FRAME, FC, FC);
  f.skull = base.skull; frameCache.set(key, f); return f;
}
