// The game canvas, its drawing context (swapped to offscreen layers while compositing) and its height, which grows to fill a tall screen.

import { HOST } from './host.js';
import { view } from './state.js';
import { clamp } from './util.js';
import { visibleHeight } from '../../lib/visibleHeight';

export const cv = document.getElementById('game');
export let EXTRA = 0; view.camLift = 0;                          // extra sky rows above the scene, sized so the screen fills a tall phone
export let ctx = cv.getContext('2d');           // swapped to an offscreen layer while the foreground is drawn
export function setCtx(c) { ctx = c; }
const css = (n, fb) => { try { return (getComputedStyle(document.documentElement).getPropertyValue(n) || '').trim() || fb; } catch (e) { return fb; } };
// Heights are what is really on screen (lib/visibleHeight.ts → --vis-h), not the window's: on a phone's browser the
// address bar comes and goes, and Reddit's expanded view can run past the bottom of the page.
// Grow the canvas upward (more sky) until the screen fills the space the D-pad leaves.
export function fitScreen() {
  if (HOST !== 'handheld') return fitRoom();
  try {
    const ctr = document.querySelector('.pad'), keys = document.querySelector('.keys'), dev = document.querySelector('.device');
    if (!ctr || !dev || !cv.clientWidth) return;
    const cs = getComputedStyle(dev);
    const used = ctr.offsetHeight + 16 + (keys && keys.offsetParent ? keys.offsetHeight + 10 : 0) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 10 + 18;
    const ex = clamp(Math.floor((visibleHeight() - used) * 240 / cv.clientWidth) - 150, 0, 160);
    if (ex !== EXTRA) { EXTRA = ex; cv.height = 150 + ex; ctx.imageSmoothingEnabled = false; }
  } catch (e) {}
}
// The inline splash and desktop: no D-pad, so the screen takes the whole window (less the bezel's edge on desktop).
// The sky grows to match the window's shape as far as it can (up to the same 160 rows), then the canvas is scaled
// to fit, and centred by the stylesheet.
const ROOM_EDGE = { splash: 0, desktop: 10 };                       // px of bezel and ring round the screen, each side
let tallRoom = false;
// The wide splash's title scenes draw on the tall canvas whatever the post's shape (attract/wide.js composes it).
export function setTallRoom(on) { if (on !== tallRoom) { tallRoom = on; fitScreen(); } }
// Sky rows that would match a room of w x h: 160 (all of them) for anything as tall as the title picture or taller.
export const roomExtra = (w, h) => clamp(Math.floor(h * 240 / w) - 150, 0, 160);
function fitRoom() {
  const edge = ROOM_EDGE[HOST] || 0, w = window.innerWidth - 2 * edge, h = visibleHeight() - 2 * edge;
  if (w <= 0 || h <= 0) return;
  const ex = tallRoom ? 160 : roomExtra(w, h);
  if (ex !== EXTRA) { EXTRA = ex; cv.height = 150 + ex; ctx.imageSmoothingEnabled = false; }
  const cw = Math.floor(Math.min(w, h * 240 / cv.height));
  cv.style.width = cw + 'px'; cv.style.height = Math.floor(cw * cv.height / 240) + 'px';
  cv.dataset.sized = '';                                           // (the stylesheets keep it hidden until now: no jump)
}
