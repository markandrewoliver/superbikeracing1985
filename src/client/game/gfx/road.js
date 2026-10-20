// Drawing the road: lanes, surfaces and seams, rivers, mud, turbos, terrain blocks, loops and the stunt course.

import { ctx, setCtx } from '../core/canvas.js';
import { BIKE_SX, LANES, LANE_SY, SC, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, race, view } from '../core/state.js';
import { clamp, hash } from '../core/util.js';
import { drawStr, rect, wsx } from './pixel.js';
import { stuntTrack } from '../modes/stunt.js';
import { baseAt, laneBase, loopAng, loopBase, loopDrift, loopPt, profile, stackUnder, terrain } from '../world/terrain.js';
import { surfAt, world } from '../world/track.js';

// ---- road surfaces: colours for the lanes and for the blocks built on them ----
export const SURF_PAL = {
  dirt: { band: [P.dirt, P.dirtD], speckA: P.orange, speckB: P.dirtDD, dash: P.orange, edge: P.dirtDD,
    top: P.orange, topLine: P.dust, rise: P.dirtD, riseLine: P.dirtDD, fall: P.dust, fallLine: P.orange, front: P.dirt, frontLine: P.dirtD, base: P.dirtDD, lip: P.dust, far: P.cream, mud: P.mud, mud2: P.mud2 },
  asphalt: { band: ['#585858', '#4c4c4c'], speckA: '#747474', speckB: '#2c2c2c', dash: '#fcfcfc', edge: '#202020',
    top: '#bcbcbc', topLine: '#d8d8d8', rise: '#747474', riseLine: '#545454', fall: '#d8d8d8', fallLine: '#bcbcbc', front: '#949494', frontLine: '#747474', base: '#3c3c3c', lip: '#fcfcfc', far: '#fcfcfc', mud: '#141414', mud2: '#3c3c6c' },
  ice: { band: ['#a4e4fc', '#88d0f0'], speckA: '#fcfcfc', speckB: '#3cbcfc', dash: '#fcfcfc', edge: '#3c8cd8',
    top: '#fcfcfc', topLine: '#d8f8fc', rise: '#3cbcfc', riseLine: '#0078f8', fall: '#d8f8fc', fallLine: '#a4e4fc', front: '#a4e4fc', frontLine: '#3cbcfc', base: '#0058f8', lip: '#fcfcfc', far: '#fcfcfc', mud: '#bcbcbc', mud2: '#fcfcfc' }
};
const palAt = (x) => SURF_PAL[surfAt(x)];
export const sxToWorld = (xs, cx) => cx + (xs - BIKE_SX) / SC;

// Where the road changes, it doesn't just switch: asphalt crumbles into potholes of dirt, and ice creeps in as
// patches that grow until they take over. TW world px either side of each change.
const SEAM_W = 200;
function drawSurfaceSeams(i, cx, y0) {
  for (const sct of race.trk.sections) {
    const base = race.trk.base, a = race.startX + sct.x0, b = race.startX + sct.x1;
    // entering: base → section over [a - W, a]; leaving: section → base over [b, b + W]
    seam(i, cx, y0, a - SEAM_W, a, base, sct.surf, false);
    seam(i, cx, y0, b, b + SEAM_W, base, sct.surf, true);
  }
}
function seam(i, cx, y0, za, zb, baseSurf, sectSurf, leaving) {
  const s0 = Math.max(0, Math.floor(wsx(za, cx))), s1 = Math.min(W, Math.ceil(wsx(zb, cx)));
  if (s1 <= 0 || s0 >= W) return;
  // which surface is "under" (fills the zone) and which shows up as patches
  const under = leaving ? baseSurf : baseSurf, over = sectSurf;
  const crumble = (under === 'asphalt' && over === 'dirt') || (under === 'dirt' && over === 'asphalt');
  const palO = SURF_PAL[over], palU = SURF_PAL[under];
  for (let xs = s0; xs < s1; xs += 2) {
    const wx = sxToWorld(xs, cx), f = clamp((wx - za) / (zb - za), 0, 1), t = leaving ? 1 - f : f;   // share of the new surface
    const cxI = Math.floor(wx / 8);
    const h2 = hash(cxI * 17 + 3) * 0.25;                         // neighbouring cells clump together into patches
    const patch = (y) => y >= 1 && y < 17 && hash(cxI * 131 + Math.floor((y0 + y) / 3) * 977 + i * 7 + (crumble ? 0 : 5003)) * 0.75 + h2 < t;
    for (let y = 1; y < 17; y += 3) {
      if (patch(y)) {
        rect(xs, y0 + y - 1, 2, 3, palO.band[i & 1]);
        if (crumble && !patch(y - 3)) rect(xs, y0 + y - 1, 2, 1, under === 'asphalt' ? palU.edge : palO.edge);   // broken lip of the old pavement
        else if (((cxI + y) & 3) === 0) rect(xs, y0 + y, 1, 1, palO.speckA);                    // a glint on the ice
      }
    }
  }
}
export function drawBand(i, cx) {
  const y0 = LANE_SY[i] - 15;
  // split the screen where the surface changes
  let xs = 0;
  while (xs < W) {
    const s0 = surfAt(sxToWorld(xs, cx)); let xe = xs + 1;
    while (xe < W && surfAt(sxToWorld(xe, cx)) === s0) xe++;
    const pal = SURF_PAL[s0];
    rect(xs, y0, xe - xs, 18, pal.band[i & 1]); rect(xs, y0 + 17, xe - xs, 1, pal.edge);
    xs = xe;
  }
  drawSurfaceSeams(i, cx, y0);
  const left = cx - BIKE_SX / SC, base = Math.floor(left / 24);          // start at the left edge of the screen, not at the bike
  for (let k = base - 1; k < base + 24; k++) {                            // grain specks scroll with the ground
    const wx = k * 24 + hash(k * 13 + i * 977) * 20, r = hash(k * 13 + i * 977), pal = palAt(wx);
    rect(Math.round(wsx(wx, cx)), y0 + 3 + Math.floor(hash(k + i * 31) * 12), r > 0.5 ? 2 : 1, 1, r > 0.5 ? pal.speckA : pal.speckB);
  }
  for (let k = Math.floor(left / 40) - 1; k < Math.floor(left / 40) + 15; k++) rect(Math.round(wsx(k * 40, cx)), y0, 12, 1, palAt(k * 40).dash);   // dashed lane line
}

// rivers cut across every lane
function drawRiverLane(i, cx) {
  for (const r of world.rivers) {
    if (r.a !== undefined && (i < r.a || i > r.b)) continue;
    const s0 = Math.round(wsx(r.x, cx)), s1 = Math.round(wsx(r.x + r.w, cx));
    if (s1 < 0 || s0 > W) continue;
    const yAt = (xs) => LANE_SY[i] - 15 - Math.round(laneBase(i, sxToWorld(xs, cx)) * SC);   // the water follows the lie of the land
    for (let xs = Math.max(0, s0); xs < Math.min(W, s1); xs++) rect(xs, yAt(xs), 1, 18, i & 1 ? '#0050e0' : '#0058f8');
    for (let k = 0; k < 6; k++) {                                         // drifting wave crests
      const wx = s0 + 3 + Math.floor(((hash(i * 17 + k) * (s1 - s0 - 8)) + game.tNow * 9) % Math.max(1, s1 - s0 - 8));
      for (let d = 0; d < 4; d++) rect(wx + d, yAt(wx + d) + 2 + k * 3, 1, 1, k & 1 ? '#3cbcfc' : '#a4e4fc');
    }
    for (const [x, c] of [[s0, '#503000'], [s0 + 1, '#503000'], [s1 - 2, '#7c4800'], [s1 - 1, '#7c4800'], [s0 + 2, '#a4e4fc'], [s0 + 3, '#a4e4fc']]) rect(x, yAt(x), 1, 18, c);   // banks
  }
}

export function drawCurb(cx) {
  const co2 = cx * SC;
  for (let k = Math.floor((co2 - BIKE_SX) / 10); k <= Math.floor((co2 - BIKE_SX + W) / 10); k++) {
    const sx = Math.round(BIKE_SX + k * 10 - co2);
    rect(sx, 127, 10, 6, (k & 1) ? P.white : P.flag); rect(sx, 132, 10, 1, P.dgray);
  }
  rect(0, 133, W, 17, P.black); rect(0, 133, W, 1, P.dgray);
}

// Decals lie on the ground under them column by column, so on a slope or a hill they tilt with it.
const liftAt = (i, xs, cx) => Math.round(terrain(i, sxToWorld(xs, cx)) * SC);
function drawMud(o, i, cx) {
  const sx0 = Math.round(wsx(o.x, cx)), sx1 = Math.round(wsx(o.x + o.w, cx)), pal = palAt(o.x);
  for (let xs = Math.max(0, sx0); xs < Math.min(W, sx1); xs++) {
    const n = xs - sx0, edge = Math.min(n, sx1 - xs), L = liftAt(i, xs, cx), base = LANE_SY[i] + 2 - L;
    const top = LANE_SY[i] - 11 - L + (edge < 3 ? 3 - edge : 0) + (hash(o.seed + n) < 0.25 ? 1 : 0);
    rect(xs, top, 1, base - top, pal.mud);
    if (hash(o.seed + n * 3) > 0.82) rect(xs, top + 3 + Math.floor(hash(o.seed + n) * 5), 2, 1, pal.mud2);
  }
}
function drawExitArrow(o, i, cx) {                                 // painted on the road: an arrow bending off and down, the way out
  const sx = Math.round(wsx(o.x, cx)), cy = LANE_SY[i] - 7, L = liftAt(i, sx + 8, cx);
  const px = (x, y) => { rect(sx + x + 1, cy + y + 1 - L, 1, 1, P.black); rect(sx + x, cy + y - L, 1, 1, P.white); };
  for (let x = 0; x < 8; x++) { px(x, 0); px(x, 1); }                                   // the shaft
  for (let d = 1; d < 5; d++) { px(7 + d, d); px(8 + d, d); }                            // bending down
  for (let k = 0; k < 5; k++) { px(12 - k, 6); px(13, 6 - k); }                         // the head, pointing down and on
}
export function drawExitSign(o, cx) {                                     // a green highway sign on two posts, at the roadside in front of the EXIT lanes
  const sx = Math.round(wsx(o.x, cx)), base = LANE_SY[3] + 5 - liftAt(3, sx + 12, cx), w = 34, h = 15, top = base - 16 - h;
  const G = '#1f7a3a', Gd = '#14522a', post = (x) => { rect(x, top + h, 2, 16, '#9aa0a8'); rect(x + 1, top + h, 1, 16, '#5c6066'); };
  post(sx + 5); post(sx + w - 7);
  rect(sx + 1, top + 1, w, h, P.black);
  rect(sx, top, w, h, G); rect(sx, top + h - 1, w, 1, Gd);
  rect(sx + 1, top + 1, w - 2, 1, P.white); rect(sx + 1, top + h - 2, w - 2, 1, P.white); rect(sx + 1, top + 1, 1, h - 2, P.white); rect(sx + w - 2, top + 1, 1, h - 2, P.white);
  drawStr('EXIT', sx + 6, top + 4, P.white, 1);
}
function drawTurbo(o, i, cx) {
  const sx = Math.round(wsx(o.x, cx)), cy = LANE_SY[i] - 5, lit = Math.floor(game.tNow * 8) % 3;
  for (let k = 0; k < 3; k++) {
    const bx = sx + 2 + k * 8, col = o.hit ? P.hayL : (k === lit ? P.white : P.turbo);
    for (let r = 0; r < 11; r++) {
      const dx = r <= 5 ? r : 10 - r;
      const L = liftAt(i, bx + dx, cx);
      rect(bx + dx + 1, cy - 5 + r + 1 - L, 2, 1, P.black); rect(bx + dx, cy - 5 + r - L, 2, 1, col);
    }
  }
}

function drawLaneObjs(i, cx) {
  drawTerrain(i, cx, true);
  drawRiverLane(i, cx);
  for (const o of world.decals[i]) {
    const sx = wsx(o.x, cx);
    if (sx > W + 4 || sx + o.w * SC < -4) continue;
    if (o.type === 'mud') drawMud(o, i, cx); else if (o.type === 'turbo') drawTurbo(o, i, cx);   // they ride on whatever's under them: slopes, hills
  }
  drawTerrain(i, cx, false);
}
// Race view, split in two so riders sit right: first every lane's ground (mountain, rivers, decals)...
export function drawLaneGround(i, cx) {
  drawTerrain(i, cx, true);
  drawRiverLane(i, cx);
  for (const o of world.decals[i]) {
    const sx = wsx(o.x, cx);
    if (sx > W + 4 || sx + o.w * SC < -4) continue;
    if (o.type === 'mud') drawMud(o, i, cx); else if (o.type === 'turbo') drawTurbo(o, i, cx);   // they ride on whatever's under them: slopes, hills
    else if (o.type === 'exitarrow') drawExitArrow(o, i, cx);

  }
  if (game.mode === 'stunt' && stuntTrack.length) drawStuntGrass(i, cx);
  if (i === LANES - 1) for (let l = 0; l < LANES; l++) for (const o of world.lanes[l]) if (o.type === 'loop' && l === o.a) drawLoopJoin(o, cx);
}
// ...then, lane by lane, each obstacle drawn whole (all its lanes) in the lane where it starts. Riders drawn after
// this lane are on top of anything that reaches their lane, and only things starting in a nearer lane cover them.
export function drawLaneSolids(i, cx) {
  for (const o of world.lanes[i]) if (o.type === 'shelf' && o.a === i) for (let j = i; j <= o.b; j++) drawTerrain(j, cx, false, [o]);   // raised lanes first: a loop on them stands on top
  for (let l = 0; l < LANES; l++) for (const o of world.lanes[l]) if (o.type === 'loop' && l === o.a && Math.min(o.a, o.a - o.shift) === i) drawLoop(o, cx);   // drawn whole, before anything on its nearest lanes
  for (const o of world.lanes[i]) {
    if (o.type === 'base' || o.type === 'loop' || o.type === 'shelf' || (o.a === undefined ? i : o.a) !== i) continue;
    const b = o.b === undefined ? i : o.b;
    for (let j = i; j <= b; j++) drawTerrain(j, cx, false, [o]);
  }
}
// The loop is one piece of track as wide as the course: a ramp whose deck keeps curling up and over into a ring.
// Each lane draws its own slice of the band (back lanes first), in the same oblique style as the ramps.
view.loopRiders = new Map();                                          // loop -> the riders going round it this frame (drawn with the loop)
// A loop is one piece per lane it spans; it's drawn (with its riders) from the piece on its back lane, so a rider who
// went in on another of its lanes is filed under that one.
export const loopKey = (o) => world.lanes[o.a].find(q => q.type === 'loop' && q.x === o.x) || o;
// The loop is drawn through a depth buffer. In this slanted view a point's nearness to the camera is
// (lane depth * lane spacing) + (height on screen), so for every pixel the loop deck and the rider are compared by
// where they really are, and the nearer one wins. No special cases: the top of the ring, the crossing near the
// bottom and the far side all fall out of the geometry, and a headlight only shines if the lamp itself is visible.
const loopCv = document.createElement('canvas'), loopCx = loopCv.getContext('2d');
const riderCv = document.createElement('canvas'), riderCx = riderCv.getContext('2d', { willReadFrequently: true });
const rgbCache = {};
const rgbOf = (c) => rgbCache[c] || (rgbCache[c] = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
function drawLoop(o, cx) {
  const riders = view.loopRiders.get(o) || [];
  const s0 = wsx(o.x - o.R, cx), s1 = wsx(o.x + o.w + o.R, cx);
  if (s0 > W + 4 || s1 < -4) { for (const r of riders) r.f(); return; }
  const base = loopBase(o), pal = palAt(o.x), N = 300, wo = Math.floor(cx * SC), LS = LANE_SY[1] - LANE_SY[0], L0 = LANE_SY[0];
  const strips = [];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let k = 0; k <= N; k++) {
    const th = k / N * 2 * Math.PI, p = loopPt(o, th), f = loopDrift(th), up = Math.cos(loopAng(o, th));
    for (let i = o.a; i <= o.b; i++) {
      const d = i - o.shift * f, far = i === o.a, sx = Math.round(wsx(p.x, cx)), sy = Math.round(L0 + LS * d - (base + p.h) * SC);
      const y0 = sy + (far && !o.full ? -6 : -15), y1 = sy + 3;
      strips.push({ k, sx, y0, y1, zb: 2 * (base + p.h) * SC - L0, up, far, near: i === o.b, wpx: wo + sx });
      minX = Math.min(minX, sx - 1); maxX = Math.max(maxX, sx + 1); minY = Math.min(minY, y0); maxY = Math.max(maxY, y1);
    }
  }
  const PAD = 40;                                                      // room for a rider sticking out of the ring
  const x0 = Math.max(0, minX - PAD), x1 = Math.min(W - 1, maxX + PAD), y0 = minY - PAD, y1 = maxY + PAD;
  const RW = x1 - x0 + 1, RH = y1 - y0 + 1;
  if (RW <= 0) { for (const r of riders) r.f(); return; }
  if (loopCv.width !== RW || loopCv.height !== RH) { loopCv.width = riderCv.width = RW; loopCv.height = riderCv.height = RH; }
  const img = loopCx.createImageData(RW, RH), px = img.data, zb = new Float32Array(RW * RH).fill(-1e9);
  const put = (x, y, z, col) => {
    const ix = x - x0, iy = y - y0; if (ix < 0 || iy < 0 || ix >= RW || iy >= RH) return;
    const n = iy * RW + ix; if (z <= zb[n]) return;
    zb[n] = z; const c = rgbOf(col); px[n * 4] = c[0]; px[n * 4 + 1] = c[1]; px[n * 4 + 2] = c[2]; px[n * 4 + 3] = 255;
  };
  for (const q of strips) {                                            // the deck, pixel by pixel
    const body = q.up > 0.35 ? P.peach : q.up < -0.35 ? pal.front : q.up > 0 ? pal.rise : pal.fall;
    for (let y = q.y0; y < q.y1; y++) {
      let col = body;
      if (y === q.y0) col = q.far ? pal.far : (!((q.wpx >> 2) & 1) ? pal.topLine : body);   // far edge catches the light / lane seam
      else if (q.near && y >= q.y1 - 2) col = ((q.k >> 3) & 1) ? P.flag : P.white;       // striped near rim
      for (let x = q.sx - 1; x <= q.sx + 1; x++) {
        const c2 = (col === P.peach && x === q.sx && (((q.wpx + y) % 6) + 6) % 6 === 0) ? P.flag : col;   // hatching on the ramp face
        put(x, y, y + q.zb, c2);
      }
    }
  }
  for (const r of riders) {                                            // each rider: drawn on its own, then merged in by depth
    riderCx.setTransform(1, 0, 0, 1, 0, 0); riderCx.clearRect(0, 0, RW, RH); riderCx.setTransform(1, 0, 0, 1, -x0, -y0);
    const n0 = view.lamps.length, main = ctx; setCtx(riderCx); r.f(); setCtx(main);
    // a rider pixel's nearness (a hair in front of the deck it rides on). Riders are drawn near the front of their
    // lane; where the track faces down (over the top) they're treated as sitting mid-lane, so the deck hides them fully.
    const dEff = r.d - 0.6 * Math.max(0, -Math.cos(loopAng(o, r.th || 0)));
    const zr = (y) => 2 * LS * dEff + L0 - y + 1.5;
    // anything of the rider's that reaches past the deck (the ends of a long machine laid along the curve) is inside the
    // track itself, so it isn't seen. The deck's own line on screen round the rider (in their lane) decides it: a pixel
    // further out than that line is hidden.
    const thr = r.th || 0, cs = [];
    for (let k = 0; k <= 40; k++) {
      const t = clamp(thr - 0.8 + k * 0.04, 0, 2 * Math.PI), p = loopPt(o, t), d = r.d - o.shift * (loopDrift(t) - loopDrift(thr));
      cs.push([wsx(p.x, cx) - x0, L0 + LS * d - (base + p.h) * SC - y0, -Math.sin(t), -Math.cos(t)]);   // where, and roughly which way is in
    }
    const nrm = cs.map((c, k) => {                                     // the true inward normal of the drawn line
      const a = cs[Math.max(0, k - 1)], b = cs[Math.min(40, k + 1)], tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1;
      let nx = -ty / L, ny = tx / L; if (nx * c[2] + ny * c[3] < 0) { nx = -nx; ny = -ny; } return [nx, ny];
    });
    const outside = (x, y) => {
      let best = 0, bd = 1e9;
      for (let k = 0; k <= 40; k++) { const dd = (x - cs[k][0]) ** 2 + (y - cs[k][1]) ** 2; if (dd < bd) { bd = dd; best = k; } }
      if (best === 0 || best === 40) return false;
      return (x - cs[best][0]) * nrm[best][0] + (y - cs[best][1]) * nrm[best][1] < -1.5;
    };
    for (let k = view.lamps.length - 1; k >= n0; k--) {                     // a hidden lamp throws no beam
      const lx = Math.round(view.lamps[k][0]) - x0, ly = Math.round(view.lamps[k][1]) - y0;
      if (lx >= 0 && ly >= 0 && lx < RW && ly < RH && zb[ly * RW + lx] > zr(view.lamps[k][1])) view.lamps.splice(k, 1);
    }
    const bx0 = clamp(Math.round(r.ax) - x0 - 48, 0, RW - 1), by0 = clamp(Math.round(r.ay) - y0 - 48, 0, RH - 1);   // only the patch round the rider
    const bw = Math.min(96, RW - bx0), bh = Math.min(96, RH - by0);
    const rd = riderCx.getImageData(bx0, by0, bw, bh).data;
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const m = (j * bw + i) * 4, al = rd[m + 3]; if (!al) continue;
      if (outside(bx0 + i, by0 + j)) continue;
      const n = (by0 + j) * RW + bx0 + i, z = zr(by0 + j + y0); if (z <= zb[n]) continue;
      zb[n] = z;
      if (al === 255 || !px[n * 4 + 3]) { px[n * 4] = rd[m]; px[n * 4 + 1] = rd[m + 1]; px[n * 4 + 2] = rd[m + 2]; px[n * 4 + 3] = Math.max(al, px[n * 4 + 3]); }
      else { const t = al / 255; for (let c = 0; c < 3; c++) px[n * 4 + c] = Math.round(rd[m + c] * t + px[n * 4 + c] * (1 - t)); }
    }
  }
  loopCx.putImageData(img, 0, 0);
  ctx.drawImage(loopCv, x0, y0);
}
// Terrain is drawn in oblique 3D, Excitebike style: a block spanning lanes a..b shows its slanted top
// surface (one band per lane, lifted by the height) and a front face with dashed seams along the bottom.
function drawTerrain(i, cx, baseOnly, objs) {
  const laneY = LANE_SY[i], wo = Math.floor(cx * SC), hasBase = world.elev.length > 0;
  for (const o of (objs || world.lanes[i])) {
    if ((o.type === 'base') !== baseOnly) continue;
    const s0 = Math.floor(wsx(o.x, cx)), s1 = Math.floor(wsx(o.x + o.w, cx));
    if (s0 > W || s1 < 0) continue;
    const a = o.a === undefined ? i : o.a, b = o.b === undefined ? i : o.b, ramp = o.type === 'ramp', isBase = o.type === 'base', crate = o.type === 'crate', road = isBase || o.road;
    const H = (x) => isBase ? baseAt(x) : profile(o, x) + stackUnder(i, o, x) + (hasBase ? baseAt(x) : 0);
    for (let xs = Math.max(0, s0); xs <= Math.min(W - 1, s1); xs++) {
      const wx = cx + (xs - BIKE_SX) / SC;
      if (!isBase && profile(o, wx) <= 0) continue;
      const hp = Math.round(H(wx) * SC);
      if (hp <= 0) continue;
      const wpx = wo + xs, pal = crate ? CRATE_PAL : palAt(wx);
      const dh = ramp ? 1 : crate ? 0 : H(wx + 5) - H(wx - 5);
      const kind = dh > 0.9 ? 1 : dh < -0.9 ? -1 : 0;                  // 1 rising, -1 falling, 0 flat top
      const hb = isBase ? 0 : Math.round((H(wx) - profile(o, wx)) * SC);   // what it stands on (a mountain, a shelf, another piece): its face stops there
      const top = laneY - 15 - hp, mid = laneY + 3 - hp, bot = laneY + 3 - hb;   // every lane full depth, the back one too, so things on it sit where they do on the flat
      // the mountain itself keeps the lane look (band colour, lane dashes) so the track visibly carries on up it
      const base = road ? pal.band[i & 1] : kind > 0 ? (ramp ? P.peach : pal.rise) : kind < 0 ? pal.fall : pal.top;
      const line = road ? (kind > 0 ? pal.edge : pal.speckA) : kind > 0 ? (ramp ? P.flag : pal.riseLine) : kind < 0 ? pal.fallLine : pal.topLine;
      rect(xs, top, 1, mid - top, base);
      if (kind) {                                                      // diagonal hatching reads as a tilted plane
        const m = kind > 0 ? ((wpx + top) % 6 + 6) % 6 : ((top - wpx) % 6 + 6) % 6;
        for (let y = top + ((6 - m) % 6); y < mid; y += 6) rect(xs, y, 1, 1, line);
      } else if (!road && ((wpx * 7) & 15) === 3) rect(xs, top + 2 + (wpx & 3) * 2, 1, 1, line);
      if (i === a) rect(xs, top, 1, 1, pal.far);                       // far edge catches the light
      else if (road) { if ((((wpx - BIKE_SX) % 20) + 20) % 20 < 12) rect(xs, top, 1, 1, pal.dash); }   // lane dashes on the mountain
      else if (!((wpx >> 2) & 1)) rect(xs, top, 1, 1, kind > 0 ? line : pal.topLine);   // dashed seam where lane surfaces meet
      if (i === b) {                                                   // front face
        rect(xs, mid, 1, bot - mid, pal.front);
        for (let k = 1; k * 6 < hp - hb; k++) if (((wpx + k * 3) & 7) < 5) rect(xs, bot - 1 - k * 6, 1, 1, pal.frontLine);
        rect(xs, mid, 1, 1, kind < 0 ? pal.fallLine : pal.lip);        // lip
        rect(xs, bot - 1, 1, 1, pal.base);
      }
      if (xs === s1 && ramp) rect(xs, top, 1, bot - top, pal.base);    // the drop past the lip
      if (crate) {                                                     // planks: a seam between crates, and the boards' ends
        const u = xs - s0;
        if (u % 16 === 0 || xs === s1) { rect(xs, top, 1, bot - top, '#503000'); }
        else if (i === b && (u % 16 === 8)) rect(xs, mid + 2, 1, bot - mid - 4, '#7c4800');
      }
    }
  }
}

// where a loop slice comes out (one lane up) and runs into a kicker: keep the red deck going under the kicker's flat start
function drawLoopJoin(o, cx) {                                   // the red deck carries on under the kicker's flat start, on the lanes it comes out on
  if (!o.join) return;
  const base = baseAt(o.x + o.w), pal = palAt(o.x), wo = Math.floor(cx * SC);
  const a = o.a - o.shift, b = o.b - o.shift, xa = Math.round(wsx(o.x + o.w, cx)), xb = Math.round(wsx(o.x + o.w + o.join, cx));
  for (let i = a; i <= b; i++) {
    const y0 = LANE_SY[i] - Math.round(base * SC) + (i === a && !o.full ? -6 : -15), y1 = LANE_SY[i] - Math.round(base * SC) + 3;
    for (let sx = Math.max(0, xa); sx <= Math.min(W - 1, xb); sx++) {
      const wpx = wo + sx; rect(sx, y0, 1, y1 - y0, P.peach);
      const m = ((wpx + y0) % 6 + 6) % 6; for (let y = y0 + ((6 - m) % 6); y < y1; y += 6) rect(sx, y, 1, 1, P.flag);
      if (i === a) rect(sx, y0, 1, 1, pal.far); else if (!((wpx >> 2) & 1)) rect(sx, y0, 1, 1, pal.topLine);
      if (i === b) rect(sx, y1 - 1, 1, 2, ((sx + wo) >> 3) & 1 ? P.flag : P.white);
    }
  }
}
const CRATE_PAL = { top: '#fca044', topLine: '#e45c10', rise: '#e45c10', riseLine: '#7c4800', fall: '#e45c10', fallLine: '#7c4800', front: '#c84c0c', frontLine: '#7c4800', base: '#503000', lip: '#fcd8a8', far: '#fcd8a8' };
// stunt mode: the two lanes the course isn't using are grass
export function stuntOnTrack(i, wx) {
  for (const t of stuntTrack) if (wx >= t.x0 && wx < t.x1) return i === t.pair || i === t.pair + 1;
  return false;
}
function drawStuntGrass(i, cx) {
  const laneY = LANE_SY[i], wo = Math.floor(cx * SC);
  for (let xs = 0; xs < W; xs++) {
    const wx = sxToWorld(xs, cx); if (stuntOnTrack(i, wx)) continue;
    const hp = Math.round(baseAt(wx) * SC), y0 = laneY - hp - 15, y1 = laneY - hp + 3, wpx = wo + xs;
    rect(xs, y0, 1, y1 - y0, '#58d854');
    for (let y = y0 + 2 + ((wpx * 7 + i * 3) % 5); y < y1 - 1; y += 6) if (((wpx + y * 3) % 12) === 0) rect(xs, y, 1, 1, '#00a800');
    if (i === 0) rect(xs, y0, 1, 1, '#b8f818');
  }
}
