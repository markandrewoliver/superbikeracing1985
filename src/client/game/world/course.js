// The course generator: rows of obstacles laid ahead of the camera, by feature (mountains, rivers, ramps, street, downhill), under the fairness rules.

import { LANES, PX_M } from '../core/config.js';
import { race } from '../core/state.js';
import { clamp, lerp, pick, rand, rint, rnd } from '../core/util.js';
import { CLIMB_H } from '../modes/builder.js';
import { finishX } from '../race/session.js';
import { featAt, segAt, segEnd, world } from './track.js';

/* ---------- course generator ---------- */
const difficulty = () => clamp(race.maxMeters / 2500, 0, 1);

function pickWeighted(list) {
  let t = 0; for (const e of list) t += e[1];
  let r = rand() * t;
  for (const e of list) { if ((r -= e[1]) <= 0) return e[0]; }
  return list[0][0];
}

/* ---------- fairness ----------
   The track should only ever punish a choice. So the generator keeps to a few rules:
   1. LANDINGS ARE SAFE. You can't steer in the air, so nothing that wrecks you (a loose crate, a river) is ever put
      where a jump comes down: from the lip out to where a rider doing about 240 kph would land (LAND_CLEAR). Go faster
      than that and where you land is on you. Traffic keeps out of landing zones too, when it can.
   2. THERE'S ALWAYS A WAY THROUGH. Every row leaves at least one lane with nothing bad in it at all.
   3. WARNING. A crash hazard always sits on the open road where you can see it coming; going faster gives you less
      time to react, which is the trade you're making. */
const LAND_CLEAR = 1200;
function noteLaunch(a, b, lip) { world.landZones.push({ a, b, x0: lip, x1: lip + LAND_CLEAR }); }
export const inLanding = (l, x0, x1) => world.landZones.some(z => l >= z.a && l <= z.b && x1 > z.x0 && x0 < z.x1);
function riverAhead(x0, x1) {                                       // a river (placed or still to come) between x0 and x1
  return world.rivers.some(r => r.x + r.w > x0 && r.x < x1) || world.riverQ.some(rx => race.startX + rx > x0 - 400 && race.startX + rx - 500 < x1);   // (a queued river can land up to 500 short of its mark)
}
// A row is one stretch of track. Lanes are split into groups of 1-4 neighbours; a group shares one
// obstacle, drawn as a single solid block that spans those lanes.
export function genRow() {
  const x0 = world.cursor, d = clamp((x0 - race.startX) / PX_M / 2500, 0, 1);   // by distance along the course, so a rebuilt track matches
  if (x0 > finishX() - 260) { world.cursor = Infinity; return; }   // flat run-in to the line and run-out after it
  if (world.riverQ.length && race.startX + world.riverQ[0] < x0 + 500) { world.riverQ.shift(); riverRow(x0); return; }
  const F = featAt(x0), SE = segEnd(x0);
  if (F === 'downhill') { applyDownhill(segAt(x0), x0); return; }
  if (SE < finishX() && x0 > SE - 250) { world.cursor = SE; return; }   // a breather where one feature hands over to the next
  if (F === 'mountains' && x0 > race.startX + 900 && x0 - world.lastPeak > 1400 && rand() < 0.4 && mountainRow(x0)) return;
  if (F === 'ramps' && x0 > race.startX + 300 && rand() < 0.85) { rampRow(x0); return; }
  if (F === 'street') { streetRow(x0, d); return; }
  const weights = [['none', 26], ['hill', 14], ['mesa', 10], ['jump', 18], ['mud', 11 + 8 * d], ['turbo', 11], ['whoops', 8]];
  const groups = [];
  for (let l = 0; l < LANES;) {
    const n = Math.min(LANES - l, pickWeighted([[1, 34], [2, 34], [3, 20], [4, 12]]));
    groups.push({ a: l, b: l + n - 1, kind: pickWeighted(weights) }); l += n;
  }
  if (groups.every(g => g.kind === 'mud')) groups[rint(0, groups.length - 1)].kind = 'none';
  if (groups.every(g => g.kind === 'none')) groups[rint(0, groups.length - 1)].kind = pick(['hill', 'jump', 'turbo', 'mesa']);
  // Like the track editor's grid: neighbours of the same kind join into one block, and everything in a row
  // starts on the same 10 m grid line with the same size, so side-by-side ramps and hills line up.
  for (let i = 0; i + 1 < groups.length;) {
    if (groups[i].kind === groups[i + 1].kind && groups[i].kind !== 'none') { groups[i].b = groups[i + 1].b; groups.splice(i + 1, 1); } else i++;
  }
  const rowJ = Math.round(rnd(0, 60) / 10) * 10, rowX = race.startX + Math.ceil((x0 + rowJ - race.startX) / 80) * 80;
  const dm = {
    hill: { w: Math.round(rnd(170, 250) / 10) * 10, h: rnd(24, 42) }, mesa: { w: Math.round(rnd(330, 520) / 10) * 10, h: rnd(22, 34), up: rnd(95, 130), dn: rnd(95, 130) },
    jump: { rw: rnd(62, 80), rh: rnd(32, 42), gap: rnd(165, 270), lw: rnd(130, 180), lh: rnd(24, 36) }, mud: { w: rnd(130, 220) },
    whoops: { w: rnd(100, 120), h: rnd(13, 19) },
  };
  const rowTK = rand() < 0.55;                                       // turbo-into-kicker row: every kicker in it sits just past the turbo line
  const kOff = rowTK ? 190 : 0;
  let end = 0;
  for (const g of groups) {
    const j = rowX - x0, x = rowX;
    const each = (fn) => { for (let l = g.a; l <= g.b; l++) fn(l); };
    const hill = (hx, w, h, up, dn) => each(l => world.lanes[l].push({ type: 'hill', x: hx, w, h, a: g.a, b: g.b, up, dn }));
    const ramp = (rx, w, h) => each(l => world.lanes[l].push({ type: 'ramp', x: rx, w, h, a: g.a, b: g.b }));
    switch (g.kind) {
      case 'hill': {
        const D = dm.hill; hill(x, D.w, D.h); end = Math.max(end, j + D.w); break;
      }
      case 'mesa': {                                // long plateau: climb, cruise along the top, drop away
        const D = dm.mesa; hill(x, D.w, D.h, D.up, D.dn); end = Math.max(end, j + D.w); break;
      }
      case 'jump': {
        const D = dm.jump, rx = x + kOff;
        if (riverAhead(rx, rx + D.rw + LAND_CLEAR)) { end = Math.max(end, j + kOff + D.rw); break; }   // no jumping into a river
        ramp(rx, D.rw, D.rh); hill(rx + D.rw + D.gap, D.lw, D.lh); noteLaunch(g.a, g.b, rx + D.rw);
        end = Math.max(end, j + kOff + D.rw + D.gap + D.lw); break;
      }
      case 'mud': {
        const w = dm.mud.w;
        each(l => world.decals[l].push({ type: 'mud', x, w, seed: rint(1, 999999) })); end = Math.max(end, j + w); break;
      }
      case 'turbo': {
        each(l => world.decals[l].push({ type: 'turbo', x, w: 48, hit: false }));
        end = Math.max(end, j + 48);
        const D = dm.jump;
        if (rowTK && !riverAhead(x, x + 270 + LAND_CLEAR)) {                     // turbo into a kicker: farther landing hill
          const rx = x + kOff;
          ramp(rx, D.rw, D.rh); hill(rx + D.rw + D.gap, D.lw, D.lh); noteLaunch(g.a, g.b, rx + D.rw);
          end = Math.max(end, j + kOff + D.rw + D.gap + D.lw);
        }
        break;
      }
      case 'whoops': {
        const n = 3, w = dm.whoops.w, h = dm.whoops.h;
        for (let i = 0; i < n; i++) hill(x + i * w, w, h);
        end = Math.max(end, j + n * w); break;
      }
    }
  }
  for (const type of ['ramp', 'hill']) {                             // identical blocks side by side (a jump beside a turbo-kicker, say) become one solid block
    const mine = []; for (let l = 0; l < LANES; l++) for (const o of world.lanes[l]) if (o.type === type && o.x >= x0 && !mine.includes(o)) mine.push(o);
    for (let l = 0; l < LANES - 1; l++) for (const o of mine) for (const q of mine) {
      if (o === q || o.b + 1 !== q.a || o.x !== q.x || o.w !== q.w || o.h !== q.h || o.up !== q.up) continue;
      const a2 = o.a, b2 = q.b;
      for (const m of mine) if (m.a >= a2 && m.b <= b2) { m.a = a2; m.b = b2; }
    }
  }
  world.cursor = x0 + end + lerp(280, 170, d) + rnd(0, 160);
  const fl = finishX() - 60;                                        // nothing straddles the finish line
  for (let l = 0; l < LANES; l++) { world.lanes[l] = world.lanes[l].filter(o => o.type === 'base' || o.x + o.w < fl); world.decals[l] = world.decals[l].filter(o => o.x + o.w < fl); }
}

// A river cuts across every lane. At least one group of lanes gets a kicker right at the bank; anywhere else you swim.
function riverRow(x0) {
  const rw = rnd(120, 170), kw = rnd(70, 80), rx = x0 + kw + 30;
  const n = pickWeighted([[1, 40], [2, 40], [3, 20]]), a = rint(0, LANES - n);
  for (let l = a; l < a + n; l++) world.lanes[l].push({ type: 'ramp', x: rx - 4 - kw, w: kw, h: rnd(34, 40), a, b: a + n - 1 });
  world.rivers.push({ x: rx, w: rw });
  noteLaunch(a, a + n - 1, rx + rw);                               // (it's built to clear its own river; past that, the landing's kept clear)
  world.cursor = rx + rw + rnd(200, 280);
}
// A mountain: climbs stacked up to a plateau, then drops back down, sometimes into a kicker for huge air.
function mountainRow(x0) {
  const n = rint(2, 5), plateau = rnd(160, 480);
  const kick = rand() < 0.6 && !riverAhead(x0, x0 + n * 480 + plateau + 200 + LAND_CLEAR);   // never a kicker that throws you into a river
  const len = n * 240 * 2 + plateau + (kick ? 160 : 0);
  if (x0 + len > Math.min(finishX() - 400, segEnd(x0) - 150)) return false;
  for (let l = 0; l < LANES; l++) if (!world.lanes[l].some(o => o.type === 'base')) world.lanes[l].unshift({ type: 'base', x: x0, w: 1e6, a: 0, b: LANES - 1 });
  let x = x0;
  for (let i = 0; i < n; i++, x += 240) world.elev.push({ x, w: 240, dh: CLIMB_H });
  if (rand() < 0.5) { const l = rint(0, LANES - 1); world.decals[l].push({ type: 'turbo', x: x + plateau * 0.4, w: 48, hit: false }); }   // a turbo on the summit
  x += plateau;
  for (let i = 0; i < n; i++, x += 240) world.elev.push({ x, w: 240, dh: -CLIMB_H });
  if (kick) {                                                    // kicker at the bottom of the descent
    const g = rint(1, LANES), a = rint(0, LANES - g);
    for (let l = a; l < a + g; l++) world.lanes[l].push({ type: 'ramp', x: x + 20, w: 72, h: rnd(34, 40), a, b: a + g - 1 });
    noteLaunch(a, a + g - 1, x + 92);
  }
  world.lastPeak = x; world.cursor = x + (kick ? 600 : 260) + rnd(0, 160);
  return true;
}
// RAMP COURSE: a chain of kickers, each with a turbo in front and a long landing hill that runs straight into
// the next one, so at a good clip you hop from jump to jump.
function rampRow(x0) {
  const n = rint(3, 6), all = (fn) => { for (let l = 0; l < LANES; l++) fn(l); };
  let x = x0;
  for (let i = 0; i < n; i++) {
    const rw = rnd(66, 76), rh = rnd(34, 40), gap = rnd(330, 400), lw = rnd(380, 440), lh = rnd(24, 32);
    if (x + 60 + rw + gap + lw > Math.min(finishX() - 320, segEnd(x0))) break;
    if (riverAhead(x, x + 60 + rw + LAND_CLEAR)) break;            // no hopping into a river in the next stretch
    const tl = rint(0, LANES - 1), tn = rint(2, LANES);               // turbos on two to four neighbouring lanes
    for (let l = Math.max(0, Math.min(tl, LANES - tn)); l < Math.max(0, Math.min(tl, LANES - tn)) + tn; l++) world.decals[l].push({ type: 'turbo', x, w: 48, hit: false });
    const rx = x + 60;
    all(l => world.lanes[l].push({ type: 'ramp', x: rx, w: rw, h: rh, a: 0, b: LANES - 1 })); noteLaunch(0, LANES - 1, rx + rw);
    const hx = rx + rw + gap;
    all(l => world.lanes[l].push({ type: 'hill', x: hx, w: lw, h: lh, a: 0, b: LANES - 1, up: lw * 0.35, dn: lw * 0.4 }));
    x = hx + lw + 10;
  }
  world.cursor = x + rnd(160, 260);
}
// STREET RACE: sparser obstacles (the traffic is the real hazard): oil, turbos, and ramps leaned against
// red-and-white barricades standing across a lane or two. Every row leaves at least one lane clear, and the traffic always steers into it.
function streetRow(x0, d) {
  const groups = [];
  for (let l = 0; l < LANES;) {
    const n = Math.min(LANES - l, pickWeighted([[1, 40], [2, 40], [3, 20]]));
    groups.push({ a: l, b: l + n - 1, kind: pickWeighted([['none', 40], ['jump', 20], ['box', 12], ['mud', 10], ['turbo', 14]]) }); l += n;
  }
  if (groups.every(g => g.kind === 'none')) groups[rint(0, groups.length - 1)].kind = pick(['jump', 'turbo', 'jump']);
  // rule 2: at least one lane with nothing bad in it (no barricade to smash, no oil) that the traffic can use too
  if (!groups.some(g => g.kind === 'none' || g.kind === 'turbo')) groups[rint(0, groups.length - 1)].kind = 'none';
  // ...and that lane can't be one a jump lands in (the traffic keeps out of those), so make sure one is free of both
  const zoned = (l) => inLanding(l, x0 - 60, x0 + 300);
  const roadFor = (g) => (g.kind === 'none' || g.kind === 'turbo' || g.kind === 'mud');
  if (!groups.some(g => roadFor(g) && [...Array(g.b - g.a + 1)].some((_, k) => !zoned(g.a + k)))) {
    const g = groups.find(g => [...Array(g.b - g.a + 1)].some((_, k) => !zoned(g.a + k))); if (g) g.kind = 'none';
  }
  let end = 0;
  for (const g of groups) {
    const j = rnd(0, 60), x = x0 + j;
    const each = (fn) => { for (let l = g.a; l <= g.b; l++) fn(l); };
    if (g.kind === 'box') {                                        // rule 1: never where a jump comes down
      let bad = false; for (let l = g.a; l <= g.b; l++) if (inLanding(l, x - 40, x + 100)) bad = true;
      if (bad) g.kind = 'none';
    }
    if (g.kind === 'jump') {                                       // never shut every lane with landing zones: the traffic needs one
      let free = 0; for (let l = 0; l < LANES; l++) if ((l < g.a || l > g.b) && !inLanding(l, x, x + 80 + LAND_CLEAR)) free++;
      if (!free) g.kind = 'none';
    }
    if (g.kind === 'jump' && riverAhead(x, x + 80 + LAND_CLEAR)) g.kind = 'none';   // no jumping into a river
    if (g.kind === 'jump') {                                       // a kicker and a landing hill, as on any other track
      const rw = rnd(62, 76), h = rnd(30, 38), gap = rnd(165, 260), lw = rnd(130, 180);
      each(l => world.lanes[l].push({ type: 'ramp', x, w: rw, h, a: g.a, b: g.b }));
      each(l => world.lanes[l].push({ type: 'hill', x: x + rw + gap, w: lw, h: rnd(22, 32), a: g.a, b: g.b }));
      noteLaunch(g.a, g.b, x + rw);
      end = Math.max(end, j + rw + gap + lw);
    } else if (g.kind === 'box') {                                 // a barricade standing across one or two lanes: it smashes, but it'll knock you sideways
      const o = { type: 'box', x: x + rnd(0, 30), w: 12, n: 1, hit: false, a: g.a, b: Math.min(g.b, g.a + 1) };
      for (let l = o.a; l <= o.b; l++) world.decals[l].push(o);     // (one barricade, listed in each lane it stands across)
      end = Math.max(end, j + 60);
    } else if (g.kind === 'mud') {
      const w = rnd(120, 190); each(l => world.decals[l].push({ type: 'mud', x, w, seed: rint(1, 999999) })); end = Math.max(end, j + w);
    } else if (g.kind === 'turbo') {
      each(l => world.decals[l].push({ type: 'turbo', x, w: 48, hit: false })); end = Math.max(end, j + 48);
    }
  }
  world.cursor = x0 + end + lerp(420, 300, d) + rnd(0, 220);
  const fl = finishX() - 60;
  for (let l = 0; l < LANES; l++) { world.lanes[l] = world.lanes[l].filter(o => o.type === 'base' || o.x + o.w < fl); world.decals[l] = world.decals[l].filter(o => o.x + o.w < fl); }
}
// DOWNHILL: a long descent, broken by ledges with big kickers that throw you out over the next drop. Planned when the
// race is set up (the track has to start high enough to come all the way down), laid down when the course gets there.
function planDownhill(len) {
  const items = []; let x = 420, drops = 0;
  while (true) {
    const n = rint(4, 6), w = rnd(190, 230);
    if (x + n * w > len) break;
    items.push({ t: 'run', x, n, w }); drops += n;
    const runX = x; x += n * w;
    if (rand() < 0.55) { const l = rint(0, LANES - 1), m = rint(1, 2); items.push({ t: 'turbo', l, m, x: runX + rnd(0.2, 0.6) * n * w }); }
    if (rand() < 0.3) items.push({ t: 'mud', l: rint(0, LANES - 1), x: runX + rnd(0.1, 0.5) * n * w, w: rnd(120, 180), seed: rint(1, 999999) });
    if (x + 180 + 6 * 230 > len) break;                             // a kicker only where a whole run still fits after it
    const kw = rnd(108, 118); items.push({ t: 'kick', x: x + 50, w: kw, h: rnd(62, 72) }); x += 50 + kw + 10;   // a short ledge, then the kicker right off the lip
  }
  return { items, drops, end: x };
}
export function setupDownhills() {                                         // plan every downhill stretch; start the course high enough for all of them
  let D = 0;
  for (const g of race.trk.segs || []) if (g.f === 'downhill') {
    const last = g.x1 >= race.raceM * PX_M - 1;
    g.plan = planDownhill(g.x1 - g.x0 - (last ? 1000 : 450)); g.done = false; D += g.plan.drops;
  }
  if (!D) return;
  for (let l = 0; l < LANES; l++) world.lanes[l].push({ type: 'base', x: race.startX - 3000, w: 1e6, a: 0, b: LANES - 1 });
  world.elev.push({ x: race.startX - 3000, w: 10, dh: D * CLIMB_H });   // start at the top
}
function applyDownhill(g, x0) {
  if (g.done) { world.cursor = Math.max(x0 + 1, race.startX + g.x1); return; }
  g.done = true;
  const o = Math.max(x0, race.startX + g.x0) - 420 + (g.x0 > 0 ? 200 : 0);   // where this stretch's plan starts (a short flat lead-in when it follows another feature)
  for (const it of g.plan.items) {
    if (it.t === 'run') for (let i = 0; i < it.n; i++) world.elev.push({ x: o + it.x + i * it.w, w: it.w, dh: -CLIMB_H });
    else if (it.t === 'turbo') for (let k = it.l; k < Math.min(LANES, it.l + it.m); k++) world.decals[k].push({ type: 'turbo', x: o + it.x, w: 48, hit: false });
    else if (it.t === 'mud') world.decals[it.l].push({ type: 'mud', x: o + it.x, w: it.w, seed: it.seed });
    else if (it.t === 'kick') {
      const kx = o + it.x;
      if (riverAhead(kx, kx + it.w + LAND_CLEAR)) continue;          // never a kicker that throws you into a river
      for (let l = 0; l < LANES; l++) world.lanes[l].push({ type: 'ramp', x: kx, w: it.w, h: it.h, a: 0, b: LANES - 1 });
      noteLaunch(0, LANES - 1, kx + it.w);
    }
  }
  world.cursor = Math.max(o + g.plan.end + 260, race.startX + g.x1);
}
export function pruneWorld(cx) {
  world.rivers = world.rivers.filter(r => r.x + r.w > cx - 400);
  for (let l = 0; l < LANES; l++) {
    world.lanes[l] = world.lanes[l].filter(o => o.x + o.w > cx - 400);
    world.decals[l] = world.decals[l].filter(o => o.x + o.w > cx - 400);
  }
}
function clearZone(x0, x1) {
  for (let l = 0; l < LANES; l++) {
    world.lanes[l] = world.lanes[l].filter(o => o.x + o.w < x0 || o.x > x1);
    world.decals[l] = world.decals[l].filter(o => o.x + o.w < x0 || o.x > x1);
  }
}
