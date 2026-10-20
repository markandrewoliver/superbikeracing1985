// The game canvas, its drawing context (swapped to offscreen layers while compositing) and its height, which grows to fill a tall screen.

import { view } from './state.js';
import { clamp } from './util.js';

export const cv = document.getElementById('game');
export let EXTRA = 0; view.camLift = 0;                          // extra sky rows above the scene, sized so the screen fills a tall phone
export let ctx = cv.getContext('2d');           // swapped to an offscreen layer while the foreground is drawn
export function setCtx(c) { ctx = c; }
const css = (n, fb) => { try { return (getComputedStyle(document.documentElement).getPropertyValue(n) || '').trim() || fb; } catch (e) { return fb; } };
// Grow the canvas upward (more sky) until the screen fills the space the D-pad leaves.
export function fitScreen() {
  try {
    const ctr = document.querySelector('.pad'), keys = document.querySelector('.keys'), dev = document.querySelector('.device');
    if (!ctr || !dev || !cv.clientWidth) return;
    const cs = getComputedStyle(dev);
    const used = ctr.offsetHeight + 16 + (keys && keys.offsetParent ? keys.offsetHeight + 10 : 0) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 10 + 18;
    const ex = clamp(Math.floor((window.innerHeight - used) * 240 / cv.clientWidth) - 150, 0, 160);
    if (ex !== EXTRA) { EXTRA = ex; cv.height = 150 + ex; ctx.imageSmoothingEnabled = false; }
  } catch (e) {}
}
