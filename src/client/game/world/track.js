// The world being raced on (lanes of terrain and decals, rivers) and the rolled settings of the current track.

import { PX_M } from '../core/config.js';
import { race } from '../core/state.js';
import { pick, rint, rnd } from '../core/util.js';
import { finishX } from '../race/session.js';
import { BGS, FEATS, LEN_MULT, TODS } from './settings.js';

/* ---------- world: terrain + decals ---------- */
// terrain objects (hill, ramp) change ground height; decals (mud, turbo) sit flat on the lane.
export const world = { lanes: [[], [], [], []], decals: [[], [], [], []], rivers: [], riverQ: [], elev: [], lastPeak: -1e9, cursor: 0, landZones: [] };
race.trk = { tod: 'evening', bg: 'dirt', crowd: true, base: 'dirt', sections: [], rivers: 0, riverAt: [] };
race.raceFeat = 'random';
race.raceLen = 'short';
export function rollTrack(feat) {
  race.raceM = 2000 * LEN_MULT[race.raceLen];                                 // short 2000 m, medium 4000, long 6000
  feat = feat || race.raceFeat;
  const f = feat === 'random' ? pick(FEATS.slice(1, 7)) : feat;
  // A medium or long RANDOM track runs through a new feature every 2000 m. Street races stay street races; ramp
  // courses and downhills never follow one another (or themselves); no feature follows itself.
  const n = LEN_MULT[race.raceLen], SEG = 2000 * PX_M, segs = [{ f, x0: 0, x1: SEG }];
  if (feat === 'random' && f !== 'street') {
    const big = (k) => k === 'ramps' || k === 'downhill';
    for (let i = 1; i < n; i++) {
      const prev = segs[i - 1].f, opts = ['normal', 'mountains', 'rivers', 'ramps', 'downhill'].filter(k => k !== prev && !(big(k) && big(prev)));
      segs.push({ f: pick(opts), x0: i * SEG, x1: (i + 1) * SEG });
    }
  } else segs[0].x1 = n * SEG;
  const bg = f === 'street' ? 'city' : pick(Object.keys(BGS)), info = BGS[bg], L = race.raceM * PX_M;   // street race: always the city, on asphalt, no crowd
  const t = { seed: (Math.random() * 4294967296) >>> 0, tod: pick(TODS), bg, crowd: info.crowd === false ? false : Math.random() < 0.6, base: f === 'street' ? 'asphalt' : pick(info.surf), sections: [], rivers: 0, riverAt: [], feature: f, segs, raceM: race.raceM };
  // one road surface per track: no mid-race patches of another surface
  for (const g of segs) if (g.f === 'rivers') {                             // rivers, spread out down that part of the course
    const SL = g.x1 - g.x0, k = rint(2, 4) * Math.round(SL / SEG);   // (2-4 per 2000 m)
    for (let i = 0; i < k; i++) { const rx = g.x0 + SL * (0.15 + 0.75 * (i + rnd(0.15, 0.85)) / k); if (!t.riverAt.length || rx - t.riverAt[t.riverAt.length - 1] > 1900) t.riverAt.push(rx); }   // far enough apart that one river's kicker can't drop you in the next
  }
  t.rivers = t.riverAt.length;
  race.trk = t;
}
// which feature the track is running at x (world coordinates), and where that stretch ends
export function segAt(x) { const sg = race.trk.segs; if (!sg || !sg.length) return { f: race.trk.feature || 'normal', x0: -Infinity, x1: Infinity }; for (const g of sg) if (x - race.startX < g.x1) return g; return sg[sg.length - 1]; }
export const featAt = (x) => segAt(x).f;
export const segEnd = (x) => Math.min(finishX(), race.startX + segAt(x).x1);
export function surfAt(x) {
  for (const sct of race.trk.sections) if (x >= race.startX + sct.x0 && x < race.startX + sct.x1) return sct.surf;
  return race.trk.base;
}
export const riverAt = (x, l) => { for (const r of world.rivers) if (x > r.x && x < r.x + r.w && (r.a === undefined || l === undefined || (l >= r.a && l <= r.b))) return r; return null; };   // (a river can run across only some lanes)
