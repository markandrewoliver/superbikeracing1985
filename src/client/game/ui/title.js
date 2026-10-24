// The title screen: building up the title picture, and the menu layout.

import { loadImg } from '../art/assets.js';
import { SPLASH_ART } from '../art/splash.js';
import { EXTRA, ctx, cv } from '../core/canvas.js';
import { W } from '../core/config.js';
import { ATT, game, menu } from '../core/state.js';
import { wideWords } from '../attract/wide.js';
import { imgOk } from '../gfx/backdrop.js';
import { rotSprite } from '../gfx/pixel.js';

const SPLASH_W = 120, SPLASH_H = 155;                              // the picture's own pixels; each is 2 screen pixels at full size
export const splashImg = {}, splashWhite = {};
for (const k in SPLASH_ART) { if (typeof Image === 'undefined') break; splashImg[k] = loadImg(SPLASH_ART[k]); }
export const SPLASH_T = { draw: [0.3, 1.3], rider: [1.7, 2.4], bike: [1.7, 2.25], sup: [2.3, 2.85], year: [2.9, 3.45] };   // seconds
export const splashOk = () => { for (const k in SPLASH_ART) if (!imgOk(splashImg[k])) return false; return true; };
// The rider leaping through the sun, through RotSprite like every other sprite (upright: the lean is in the art),
// at the screen's 240x310. Made once, after the picture has loaded.
let riderRS = null;
export function titleRider() {
  if (riderRS) return riderRS;
  const t = document.createElement('canvas'); t.width = 240; t.height = 310; t.ax = 0; t.ay = 0;
  const g = t.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(splashImg.rider, 0, 0, 240, 310);
  return (riderRS = rotSprite(t, 0, 240, 310, 0, 0));
}
function splashWhiteOf(k) {                                         // a solid white copy of a layer, for the flash as a word lands
  if (splashWhite[k]) return splashWhite[k];
  const im = splashImg[k], c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
  g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  return (splashWhite[k] = c);
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (u) => 1 - Math.pow(1 - u, 3), easeBack = (u) => 1 + 2.9 * Math.pow(u - 1, 3) + 1.9 * Math.pow(u - 1, 2);
const titleClock = (t) => Math.floor(t * 30) / 30;                       // (the picture moves on in steps of a 30th of a second)
// How far the picture has drawn itself in, t seconds after the title came up: picture pixels done, of SPLASH_W x SPLASH_H.
function titleDone(t) {
  const sp = titleClock(t), T = SPLASH_T;
  if (sp < T.draw[0]) return 0;
  return Math.min(SPLASH_W * SPLASH_H, Math.floor(clamp01((sp - T.draw[0]) / (T.draw[1] - T.draw[0])) * SPLASH_W * SPLASH_H / 16) * 16);
}
// Whole rows of the picture drawn so far, in screen rows (2 per picture row). The wide splash draws its city in step.
export const titleRowsDrawn = (t) => Math.floor(titleDone(t) / SPLASH_W) * 2;
// Where the rider is, in picture pixels from his place in the picture, or null before he flies in.
export function titleRiderAt(t) {
  const sp = titleClock(t), T = SPLASH_T;
  if (sp < T.rider[0]) return null;                                  // in from the lower left, straight along the line he's leaning on (20 degrees up), then hanging in the air
  const u = clamp01((sp - T.rider[0]) / (T.rider[1] - T.rider[0])), e = easeOut(u), D = 112 * (1 - e);
  let dx = -D * Math.cos(Math.PI / 9), dy = D * Math.sin(Math.PI / 9);
  if (u >= 1) dy = Math.round(Math.sin((sp - T.rider[1]) / 0.52 * Math.PI));
  if (ATT.on && ATT.exitT >= 0) { const E = ATT.exitT, D2 = 40 * E + 300 * E * E; dx += D2 * Math.cos(Math.PI / 9); dy -= D2 * Math.sin(Math.PI / 9); }   // (the intro video: off he goes, top right)
  return { dx, dy };
}
export let titleArtT = 0;                                               // (the t it was last drawn at: the wide splash draws its sides at the same moment)
export function drawTitleArt(t) {                                          // t seconds since the title came up; fills the whole screen, whatever its height
  titleArtT = t;
  const sp = titleClock(t), T = SPLASH_T;
  const Hc = cv.height, sc = 1, px = 2, dw = 240, dh = 310, x0 = Math.round((W - dw) / 2), y0 = Hc >= dh ? Hc - dh : -26;   // a tall screen keeps the city at the bottom; a short one shows just the title, lifted clear of the menu
  const crisp = true;
  const put = (k, dx, dy, flash) => { ctx.imageSmoothingEnabled = !(crisp && (k === 'bg' || k === 'rider')); if (k !== 'bg' && k !== 'rider') dx -= 4;   // (the words: centred on BIKE RACING's yellow faces, not on their shadow)
    ctx.drawImage(flash ? splashWhiteOf(k) : k === 'rider' ? titleRider() : splashImg[k], x0 + Math.round(dx) * px, y0 + Math.round(dy) * px, dw, dh); };
  const flashing = (v) => v >= 0.55 && v < 0.55 + 2 / (30 * 0.55);
  if (sp >= T.draw[0]) {                                              // drawn in like an old computer loading a picture: left to right, row by row, in bursts
    const total = SPLASH_W * SPLASH_H, done = titleDone(t);
    const row = Math.floor(done / SPLASH_W), col = done % SPLASH_W, im = (ATT.on && ATT.bgC) || splashImg.bg;
    ctx.imageSmoothingEnabled = !crisp;
    if (row > 0) ctx.drawImage(im, 0, 0, 480, row * 4, x0, y0, dw, row * px);
    if (col > 0 && row < SPLASH_H) ctx.drawImage(im, 0, row * 4, col * 4, 4, x0, y0 + row * px, col * px, px);
    if (done < total) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + col * px, y0 + row * px, Math.min(4, SPLASH_W - col) * px, px); }
  }
  const rider = titleRiderAt(t);
  if (rider) put('rider', rider.dx, rider.dy);
  if (ATT.on && (ATT.noWords || ATT.keepWords || wideWords())) { ctx.imageSmoothingEnabled = false; return; }   // (the intro video draws the words itself)
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
