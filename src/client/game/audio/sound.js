// Sound: a tiny synth (switched off for now: SOUND_ON).

import { ATT, game } from '../core/state.js';
import { bike } from '../race/session.js';

/* ---------- audio (tiny synth, starts after first press) ---------- */
let ac = null, eng = null, engG = null, noiseBuf = null, muted = false;
const SOUND_ON = false;                     // sound is switched off for now; flip to true to bring it back
export function audioInit() {
  if (!SOUND_ON) return;
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    ac = new A();
    eng = ac.createOscillator(); engG = ac.createGain();
    eng.type = 'sawtooth'; eng.frequency.value = 60; engG.gain.value = 0;
    eng.connect(engG); engG.connect(ac.destination); eng.start();
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ac = null; }
}
function tone(f0, f1, dur, type, vol) {
  if (!ac || muted) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol) {
  if (!ac || muted || !noiseBuf) return;
  const s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = noiseBuf; g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  s.connect(g); g.connect(ac.destination); s.start(); s.stop(ac.currentTime + dur);
}
export function sfx(name) {
  if (ATT.on) return;                                               // (the intro video is silent)
  switch (name) {
    case 'lane': tone(300, 420, 0.06, 'square', 0.03); break;
    case 'land': tone(120, 50, 0.12, 'sine', 0.12); break;
    case 'perfect': tone(520, 880, 0.14, 'triangle', 0.08); break;
    case 'turbo': tone(200, 900, 0.35, 'sawtooth', 0.05); break;
    case 'mud': noise(0.25, 0.12); break;
    case 'bank': tone(660, 990, 0.12, 'square', 0.05); setTimeout(() => tone(990, 1320, 0.14, 'square', 0.05), 90); break;
    case 'flip': tone(400, 800, 0.12, 'triangle', 0.07); break;
    case 'crash': noise(0.5, 0.25); tone(160, 40, 0.5, 'sawtooth', 0.1); break;
  }
}
export function engineUpdate() {
  if (!ac || !engG) return;
  const on = game.state === 'play' && !muted && !ATT.on;
  engG.gain.setTargetAtTime(on ? (bike.grounded ? 0.035 : 0.02) : 0, ac.currentTime, 0.05);
  eng.frequency.setTargetAtTime(48 + Math.min(bike.v, 700) * 0.45 + (bike.grounded ? 0 : 30), ac.currentTime, 0.05);
}
