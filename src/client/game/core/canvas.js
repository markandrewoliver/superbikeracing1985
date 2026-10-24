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
// The handheld (a phone). The screen is laid out once, for the tallest the page has been at this width: its width,
// and the sky rows (EXTRA) that fill the space the D-pad leaves. When the page gets shorter (the address bar comes
// back), the screen stays as it is and the D-pad gives up the height; only once the D-pad is down to DP_MIN does the
// screen shrink, scaled whole (same picture, smaller). It all comes back when the height does.
const DP_MIN = 130;                                                  // px: the smallest D-pad still easy to thumb
let tallest = 0, atWidth = 0;
const px = (el, ...k) => { const s = getComputedStyle(el); return k.reduce((a, n) => a + (parseFloat(s[n]) || 0), 0); };
export function fitScreen() {
  if (HOST !== 'handheld') return fitRoom();
  try {
    const dev = document.querySelector('.device'), bez = document.querySelector('.bezel'), ctl = document.querySelector('.controls');
    if (!dev || !bez || !ctl) return;
    const vw = window.innerWidth, vis = visibleHeight();
    if (vw !== atWidth) { atWidth = vw; tallest = 0; }                // (turned, or resized: start again)
    tallest = Math.max(tallest, vis);
    const side = px(dev, 'paddingLeft', 'paddingRight') + px(bez, 'paddingLeft', 'paddingRight');
    const chrome = px(dev, 'paddingTop', 'paddingBottom', 'rowGap') + px(bez, 'paddingTop', 'paddingBottom') + px(ctl, 'paddingTop', 'paddingBottom');
    // The layout at the tallest: the D-pad's natural size, the screen as wide as leaves it room, the sky filling the rest.
    const dp0 = clamp(Math.min(vw * 0.64, tallest * 0.33), 170, 270);
    const w0 = Math.min(640, vw, (tallest - chrome - dp0 - 4) * 1.6 + side) - side;
    const ex = clamp(Math.floor((tallest - chrome - dp0) * 240 / w0) - 150, 0, 160);
    if (ex !== EXTRA) { EXTRA = ex; cv.height = 150 + ex; ctx.imageSmoothingEnabled = false; }
    // Now at the height there is: the D-pad takes what the screen leaves, then the screen gives way.
    let w = w0, dp = Math.min(dp0, vis - chrome - w0 * cv.height / 240);
    if (dp < DP_MIN) { dp = DP_MIN; w = Math.max(120, (vis - chrome - DP_MIN) * 240 / cv.height); }
    const root = document.documentElement.style;
    root.setProperty('--dp', Math.floor(dp) + 'px'); root.setProperty('--dev-w', Math.floor(w + side) + 'px');
  } catch (e) { console.error(`[fitScreen] ${String(e)}`); }
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
  const edge = ROOM_EDGE[HOST] || 0, w = window.innerWidth - 2 * edge, h = (HOST === 'splash' ? window.innerHeight : visibleHeight()) - 2 * edge;   // (inline, the frame is the post)
  if (w <= 0 || h <= 0) return;
  const ex = tallRoom ? 160 : roomExtra(w, h);
  if (ex !== EXTRA) { EXTRA = ex; cv.height = 150 + ex; ctx.imageSmoothingEnabled = false; }
  const cw = Math.floor(Math.min(w, h * 240 / cv.height));
  cv.style.width = cw + 'px'; cv.style.height = Math.floor(cw * cv.height / 240) + 'px';
  cv.dataset.sized = '';                                           // (the stylesheets keep it hidden until now: no jump)
}
