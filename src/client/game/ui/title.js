// The title screen: building up the title picture, and the menu layout.

import { loadImg } from '../art/assets.js';
import { SPLASH_ART } from '../art/splash.js';
import { EXTRA, ctx, cv } from '../core/canvas.js';
import { W } from '../core/config.js';
import { ATT, game, menu } from '../core/state.js';
import { imgOk } from '../gfx/backdrop.js';

const SPLASH_W = 120, SPLASH_H = 155;                              // the picture's own pixels; each is 2 screen pixels at full size
export const splashImg = {}, splashWhite = {};
for (const k in SPLASH_ART) { if (typeof Image === 'undefined') break; splashImg[k] = loadImg(SPLASH_ART[k]); }
export const SPLASH_T = { draw: [0.3, 1.3], rider: [1.7, 2.4], bike: [1.7, 2.25], sup: [2.3, 2.85], year: [2.9, 3.45] };   // seconds
export const splashOk = () => { for (const k in SPLASH_ART) if (!imgOk(splashImg[k])) return false; return true; };
function splashWhiteOf(k) {                                         // a solid white copy of a layer, for the flash as a word lands
  if (splashWhite[k]) return splashWhite[k];
  const im = splashImg[k], c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
  g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  return (splashWhite[k] = c);
}
export function drawTitleArt(t) {                                          // t seconds since the title came up; fills the whole screen, whatever its height
  const sp = Math.floor(t * 30) / 30, T = SPLASH_T, clamp01 = (v) => Math.min(1, Math.max(0, v));
  const easeOut = (u) => 1 - Math.pow(1 - u, 3), easeBack = (u) => 1 + 2.9 * Math.pow(u - 1, 3) + 1.9 * Math.pow(u - 1, 2);
  const Hc = cv.height, sc = 1, px = 2, dw = 240, dh = 310, x0 = Math.round((W - dw) / 2), y0 = Hc >= dh ? Hc - dh : -26;   // a tall screen keeps the city at the bottom; a short one shows just the title, lifted clear of the menu
  const crisp = true;
  const put = (k, dx, dy, flash) => { ctx.imageSmoothingEnabled = !(crisp && (k === 'bg' || k === 'rider')); if (k !== 'bg' && k !== 'rider') dx -= 4;   // (the words: centred on BIKE RACING's yellow faces, not on their shadow)
    ctx.drawImage(flash ? splashWhiteOf(k) : splashImg[k], x0 + Math.round(dx) * px, y0 + Math.round(dy) * px, dw, dh); };
  const flashing = (v) => v >= 0.55 && v < 0.55 + 2 / (30 * 0.55);
  if (sp >= T.draw[0]) {                                              // drawn in like an old computer loading a picture: left to right, row by row, in bursts
    const total = SPLASH_W * SPLASH_H, done = Math.min(total, Math.floor(clamp01((sp - T.draw[0]) / (T.draw[1] - T.draw[0])) * total / 16) * 16);
    const row = Math.floor(done / SPLASH_W), col = done % SPLASH_W, im = (ATT.on && ATT.bgC) || splashImg.bg;
    ctx.imageSmoothingEnabled = !crisp;
    if (row > 0) ctx.drawImage(im, 0, 0, 480, row * 4, x0, y0, dw, row * px);
    if (col > 0 && row < SPLASH_H) ctx.drawImage(im, 0, row * 4, col * 4, 4, x0, y0 + row * px, col * px, px);
    if (done < total) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + col * px, y0 + row * px, Math.min(4, SPLASH_W - col) * px, px); }
  }
  if (sp >= T.rider[0]) {                                             // in from the lower left, straight along the line he's leaning on (20 degrees up), then hanging in the air
    const u = clamp01((sp - T.rider[0]) / (T.rider[1] - T.rider[0])), e = easeOut(u), D = 112 * (1 - e);
    let dx = -D * Math.cos(Math.PI / 9), dy = D * Math.sin(Math.PI / 9);
    if (u >= 1) dy = Math.round(Math.sin((sp - T.rider[1]) / 0.52 * Math.PI));
    if (ATT.on && ATT.exitT >= 0) { const E = ATT.exitT, D2 = 40 * E + 300 * E * E; dx += D2 * Math.cos(Math.PI / 9); dy -= D2 * Math.sin(Math.PI / 9); }   // (the intro video: off he goes, top right)
    put('rider', dx, dy);
  }
  if (ATT.on && (ATT.noWords || ATT.keepWords)) { ctx.imageSmoothingEnabled = false; return; }   // (the intro video draws the words itself)
  if (sp >= T.bike[0]) { const v = clamp01((sp - T.bike[0]) / (T.bike[1] - T.bike[0])); put('bike', 0, -70 * (1 - easeBack(v)), flashing(v)); }
  if (sp >= T.sup[0]) { const v = clamp01((sp - T.sup[0]) / (T.sup[1] - T.sup[0])); put('super', -110 * (1 - easeOut(v)), 0, flashing(v)); }
  if (sp >= T.year[0]) { const v = clamp01((sp - T.year[0]) / (T.year[1] - T.year[0])), e = easeOut(v); put('n1985', 110 * (1 - e), 0, flashing(v)); }
  ctx.imageSmoothingEnabled = false;
}
// title screen, in whole-canvas pixels: the art at full size on a tall screen, half size on a short one; the menu at the bottom
export function titleLayout() { const Hc = cv.height; return { big: Hc >= 250, top: Hc - 68 }; }   // big: the art at 2x (a little of each side is cropped); otherwise 1x
export const MENU = ['RANDOM TRACK', 'TRACK BUILDER', 'EDIT PLAYER', 'HOW TO PLAY'];
menu.lpRow = 0;                                                  // EDIT PLAYER: which row
menu.menuSel = 0;
menu.titleMenu = false;                                          // false: the splash with PRESS TO START; true: the full screen menu
export const MROW = 22;                                                 // the menu's row height, in canvas pixels
export const menuTop = () => Math.round((cv.height - MENU.length * MROW) / 2) - 4;
export const RSROWS = ['FEATURES', 'LENGTH', 'RACE IT', 'BACK TO MENU'];
menu.rsRow = 0;
export const menuOff = () => (game.state === 'title' || game.state === 'buildset') ? Math.round(EXTRA / 4) * 2 : 0;
