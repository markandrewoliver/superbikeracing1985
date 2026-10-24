// The intro video on a wide post (the inline splash, wider than the title picture's 240x310).
//
// The title picture is drawn for a tall screen; a wide post gets a short one, which cropped the bottom off the title.
// So on a wide post the scenes framed on the title picture (TALL: the title, the pan down to the start line, the
// start) run on the tall canvas, and this composes what the post shows:
//   - the title: the whole picture in the middle, its city carried out to both edges (the game's own city layer,
//     copy by copy, every other one mirrored so each join meets itself) and drawn in row by row with the picture;
//     the rider flies in and out over the extended sky;
//   - as the rider shoots off, the view pushes in, anchored at the bottom, until the picture fills the post's width:
//     exactly the framing the pan starts from, so the pan and the start run on full width as they always did;
//   - the words leave the picture as the view pushes in, and glide to where every other scene has them (the top);
//   - coming round again, the title opens framed as the scene before it ended (full width, words at the top) and
//     pulls back over PULL seconds while the picture draws itself in, so the loop has no jump either.
// Every other scene runs on a canvas of the post's own shape. The canvas changes shape only at the cut into the
// title and the cut out of the start, both under a full wipe in the night colour, so no change is seen.

import { HOST } from '../core/host.js';
import { cv, roomExtra, setTallRoom } from '../core/canvas.js';
import { ATT } from '../core/state.js';
import { attEase } from './attract.js';
import { ATT_SCENES } from './scenes.js';
import { splashImg, splashOk, titleArtT, titleRider, titleRiderAt, titleRowsDrawn } from '../ui/title.js';

const TALL = new Set(['title', 'pan', 'go']);
const NIGHT = '#140c3c';
const CITY_DY = 24;                                                  // the title shows its city this far below the picture's own (attLayers)
const PULL = 1.2;                                                    // s: coming round again, the pull back to the whole picture (done before the rider flies in)
let post = null, pg = null;                                          // the post's canvas, which the game canvas is composed onto
const cache = {};                                                    // layers at the game's 240x310, drawn the way the game draws them

const isWide = () => HOST === 'splash' && roomExtra(window.innerWidth, window.innerHeight) < 160;
const scene = () => (ATT.on ? ATT_SCENES[ATT.scene] : null);
const tallNow = () => { const S = scene(); return !!S && TALL.has(S.name) && cv.height >= 310; };

// At each cut, before the scene frames itself: the tall canvas for the title's scenes on a wide post.
export function wideScene(S) { if (HOST === 'splash') setTallRoom(isWide() && TALL.has(S.name)); }
window.addEventListener('resize', () => { const S = scene(); if (S) wideScene(S); });

// 0: the whole picture fits the post's height. 1: it fills the post's width, bottom edge on the post's bottom edge.
function zoom() {
  const S = scene();
  if (S.name !== 'title') return 1;
  if (ATT.exitT >= 0) {
    const from = ATT.t - ATT.exitT;                                  // (the push-in runs from the rider's exit to the cut)
    return attEase(Math.min(1, ATT.exitT / (S.dur - from)));
  }
  if (ATT.keepWords && ATT.t < PULL) return 1 - attEase(ATT.t / PULL);   // (round again: the pull back)
  return 0;
}
// Whenever the view is not on the whole picture, the words are drawn here instead of on the game canvas.
export function wideWords() {
  if (!isWide() || !tallNow()) return false;
  return zoom() > 0;
}

function layer(key, draw) {
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = 240; c.height = 310;
  const g = c.getContext('2d'); draw(g);
  return (cache[key] = c);
}
const wordsLayer = () => layer('words', (g) => { g.imageSmoothingEnabled = true; for (const k of ['bike', 'super', 'n1985']) g.drawImage(splashImg[k], 0, 0, 240, 310); });

// One frame, after the game has drawn its own.
export function presentSplash() {
  const on = isWide() && ATT.on && splashOk();
  if (!on) { if (post) { post.style.display = 'none'; cv.style.display = ''; } return; }
  const Wp = window.innerWidth, Hp = window.innerHeight, dpr = window.devicePixelRatio || 1;
  if (!post) {
    post = document.createElement('canvas'); post.dataset.sized = ''; post.setAttribute('aria-hidden', 'true');
    cv.after(post); pg = post.getContext('2d');
  }
  if (post.width !== Math.round(Wp * dpr) || post.height !== Math.round(Hp * dpr)) {
    post.width = Math.round(Wp * dpr); post.height = Math.round(Hp * dpr); post.style.width = Wp + 'px'; post.style.height = Hp + 'px';
  }
  cv.style.display = 'none'; post.style.display = 'block';
  pg.setTransform(dpr, 0, 0, dpr, 0, 0); pg.imageSmoothingEnabled = true;   // (no pixel filter: the screen is scaled up smooth, as game.css does)
  pg.fillStyle = NIGHT; pg.fillRect(0, 0, Wp, Hp);
  if (!tallNow()) {                                                  // a scene on the post's own shape: the canvas fills it
    const s = Math.min(Wp / 240, Hp / cv.height);
    pg.drawImage(cv, (Wp - 240 * s) / 2, (Hp - cv.height * s) / 2, 240 * s, cv.height * s);
    return;
  }
  const z = zoom(), s0 = Hp / 310, s1 = Wp / 240, s = s0 + (s1 - s0) * z;
  const x0 = Wp / 2 - 120 * s, y0 = Hp - 310 * s;                   // where the game canvas lands: centred, on the bottom edge
  if (z < 1 && scene().name === 'title') drawSides(Wp, x0, y0, s);
  pg.drawImage(cv, x0, y0, 240 * s, 310 * s);
  if (wideWords()) pg.drawImage(wordsLayer(), x0 - 8 * s, y0 + (-26 * s - y0) * z, 240 * s, 310 * s);   // (-8, -26: where the short screens have them)
}

// Either side of the picture: night sky, the city (only as far down as the picture has drawn itself in), and the rider.
function drawSides(Wp, x0, y0, s) {
  const t = titleArtT, rows = titleRowsDrawn(t), w = 240 * s;
  if (rows > 0 && ATT.cityC) {
    pg.save(); pg.beginPath(); pg.rect(0, y0, Wp, rows * s); pg.clip();
    for (let k = Math.floor(-x0 / w) - 1; x0 + k * w < Wp; k++) {
      if (!k) continue;                                              // (the picture itself)
      const x = x0 + k * w, y = y0 + CITY_DY * s;
      if (k & 1) { pg.save(); pg.translate(x + w, y); pg.scale(-1, 1); pg.drawImage(ATT.cityC, 0, 0, w, 310 * s); pg.restore(); }
      else pg.drawImage(ATT.cityC, x, y, w, 310 * s);
    }
    pg.restore();
  }
  const r = titleRiderAt(t);
  if (r) pg.drawImage(titleRider(), x0 + Math.round(r.dx) * 2 * s, y0 + Math.round(r.dy) * 2 * s, w, 310 * s);
}
