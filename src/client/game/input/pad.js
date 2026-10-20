// Input: the on-screen D-pad (two buttons at once from one thumb), the keyboard, taps on the screen, and the secret-code reader.

import { EXTRA, cv } from '../core/canvas.js';
import { W } from '../core/config.js';
import { ATT, game } from '../core/state.js';
import { mapTilt, tutAllow, tutLit } from '../modes/tutorial.js';
import { inp } from '../race/session.js';
import { laneMove } from '../rider/physics.js';
import { secretCode } from '../rider/secretMoves.js';
import { anyPress } from '../ui/menu.js';

const pad = document.getElementById('pad');
const padBtns = {};
pad.querySelectorAll('[data-btn]').forEach(b => { padBtns[b.dataset.btn] = b; });
const ptrs = new Map();
const keys = { left: false, right: false, up: false, down: false };
let padDown = new Set();
function btnAt(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const b = el && el.closest ? el.closest('[data-btn]') : null;
  return b ? b.dataset.btn : null;
}
// One thumb can press two buttons at once: anywhere between two arms of the cross (e.g. up and right, for a superman
// while flipping) holds both. Worked out from the angle around the pad's centre, so the empty corners count too.
const PAD_SECT = [['right'], ['right', 'down'], ['down'], ['down', 'left'], ['left'], ['left', 'up'], ['up'], ['up', 'right']];
function btnsAt(e) {
  const r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  if (Math.hypot(dx, dy) < r.width * 0.1) return [];
  const a = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;      // 0 = right, 90 = down
  const k = Math.floor(((a + 22.5) % 360) / 45);
  return PAD_SECT[k];
}
// SECRET CODES: classic d-pad codes for secret stunts. Every change in what's held down is a step (so DOWN then
// DOWN-RIGHT then RIGHT is three steps, and UP, UP is two separate presses); steps more than 0.75 s apart start over.
const CODES = { redeemer: ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right'], hadouken: ['down', 'down+right', 'right'], headstand: ['down', 'down+left', 'left'], mario: ['right', 'down', 'down+right'] };
let codeToks = [], codePrev = '';
function codeTick() {
  const d = ['up', 'down', 'left', 'right'].filter(k => padDown.has(k) || keys[k]).join('+');
  if (d === codePrev) return; codePrev = d;
  if (!d) return;
  if (codeToks.length && game.tNow - codeToks[codeToks.length - 1].t > 0.75) codeToks = [];
  codeToks.push({ k: d, t: game.tNow }); if (codeToks.length > 12) codeToks.shift();
  for (const name in CODES) {
    const c = CODES[name], n = c.length;
    if (codeToks.length >= n && c.every((k, i) => codeToks[codeToks.length - n + i].k === k)) { codeToks = []; secretCode(name); return; }
  }
}
export function syncPad() {
  if (ATT.on) return;
  const now = new Set([].concat(...ptrs.values())); now.delete(null);
  for (const k of ['up', 'down']) if (now.has(k) && !padDown.has(k)) laneMove(k === 'up' ? -1 : 1);
  padDown = now;
  inp.padL = now.has('left') || !!keys.left; inp.padR = now.has('right') || !!keys.right; inp.fromPad = true;
  inp.up = now.has('up') || keys.up; inp.down = now.has('down') || keys.down;     // held up/down = air stunts
  if (game.tut) {                                                      // how to play: only the buttons in play do anything
    const A = tutAllow(); if (!A.left) inp.padL = false; if (!A.right) inp.padR = false; if (!A.up) inp.up = false; if (!A.down) inp.down = false;
  }
  mapTilt(); codeTick();
  const lit = game.tut ? tutLit() : {}, al = game.tut ? tutAllow() : null;
  for (const k in padBtns) { padBtns[k].classList.toggle('is-down', now.has(k) || !!keys[k]); padBtns[k].classList.toggle('lit', !!lit[k]); padBtns[k].classList.toggle('off', !!al && !al[k]); }
}
pad.addEventListener('pointerdown', e => {
  e.preventDefault();
  try { pad.setPointerCapture(e.pointerId); } catch (_) {}
  const bs = btnsAt(e), b0 = btnAt(e) || bs[0] || null;
  ptrs.set(e.pointerId, (game.state === 'play' || game.state === 'replay') && bs.length ? bs : [b0]); anyPress(b0); syncPad();   // menus take one button; riding can take two
});
pad.addEventListener('pointermove', e => { if (ptrs.has(e.pointerId)) { const bs = btnsAt(e); ptrs.set(e.pointerId, game.state === 'play' && bs.length ? bs : [btnAt(e)]); syncPad(); } });
const release = e => { ptrs.delete(e.pointerId); syncPad(); };
pad.addEventListener('pointerup', release);
pad.addEventListener('pointercancel', release);
pad.addEventListener('lostpointercapture', release);
pad.addEventListener('contextmenu', e => e.preventDefault());

const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
window.addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (!k && e.code !== 'Space' && e.code !== 'Enter') return;
  e.preventDefault(); if (!e.repeat) anyPress(k || 'ok');
  if (e.repeat) return;
  if (k === 'up') laneMove(-1); else if (k === 'down') laneMove(1);
  if (k === 'up') keys.up = true; else if (k === 'down') keys.down = true;
  if (k === 'left') keys.left = true; else if (k === 'right') keys.right = true;
  syncPad();
});
window.addEventListener('keyup', e => {
  const k = KEYMAP[e.code];
  if (k === 'left') keys.left = false; if (k === 'right') keys.right = false; if (k === 'up') keys.up = false; if (k === 'down') keys.down = false;
  syncPad();
});
window.addEventListener('blur', () => { keys.left = keys.right = keys.up = keys.down = false; ptrs.clear(); syncPad(); });
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  const r = cv.getBoundingClientRect();
  anyPress('ok', { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * cv.height / r.height - EXTRA });
});
