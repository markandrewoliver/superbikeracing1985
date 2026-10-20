// The painted parallax backdrops: choosing a set for the track, tiling and planting layers, and tinting for time of day.

import { loadImg } from '../art/assets.js';
import { BG_ART, BG_PIECES } from '../art/backdrops.js';
import { attTitleBackdrop } from '../attract/scenes.js';
import { EXTRA, ctx } from '../core/canvas.js';
import { SC, W } from '../core/config.js';
import { ATT, game, race, view } from '../core/state.js';
import { hash, seededRand } from '../core/util.js';
import { rect } from './pixel.js';
import { drawBarrier, drawMid } from './scenery.js';
import { splashOk } from '../ui/title.js';

// ---- backdrops: painted parallax layers from the CraftPix packs (no art of ours left behind the track) ----
// Outdoor tracks: a scenery set for the setting (its own sky swapped for a cloud sky for the time of day); the scenery
// is darkened for the time of day, the sky isn't (each sky is already painted for it). City: a city painted for the
// time of day, standing on our highway wall. Which set comes from the track's seed, so a track always looks the same.
const BG_IMG = {};
for (const g of ['scenery', 'sky', 'city']) for (const k in BG_ART[g]) BG_IMG[k] = BG_ART[g][k].map(u => loadImg(u));
const SCENES = { grass: ['mount2'], dirt: ['nature1'], desert: ['desert1'], arctic: ['winter1'], beach: ['nature3'] };
const SCENE_TODS = {};                                            // (sets painted in one light only: none in use)
const SCENE_NOTINT = {};                                          // (sets already painted at night: none in use)
const SKY_SETS = { day: ['sky1', 'sky5'], morning: ['sky2'], evening: ['sky7', 'sky6'], night: ['sky3'] };
const CITY_SETS = { day: ['city3', 'city5'], morning: ['city7', 'city6'], evening: ['city2', 'city4', 'city8'], night: ['city1'] };
function sceneFor() {
  const key = race.trk.bg + '|' + race.trk.tod + '|' + (race.trk.seed || 0);
  if (race.trk._scene && race.trk._scene.key === key) return race.trk._scene;
  const h = hash(((race.trk.seed || 7) >>> 0) * 7 + 3), h2 = hash(((race.trk.seed || 7) >>> 0) * 13 + 5), sc = { key };
  if (race.trk.bg === 'city') { const c = CITY_SETS[race.trk.tod] || CITY_SETS.day; sc.city = c[Math.floor(h * c.length)]; }
  else {
    const all = SCENES[race.trk.bg] || SCENES.grass, ok = all.filter(k => !SCENE_TODS[k] || SCENE_TODS[k].includes(race.trk.tod)), pool = ok.length ? ok : all;
    const sk = SKY_SETS[race.trk.tod] || SKY_SETS.day; sc.set = pool[Math.floor(h * pool.length)]; sc.sky = sk[Math.floor(h2 * sk.length)];
  }
  race.trk._scene = sc; return sc;
}
export const imgOk = (i) => i && i.complete && i.naturalWidth;
const topCols = new Map();
function topColor(im) {                                             // the colour along the top of a sky, to carry it on up a tall screen
  if (!imgOk(im)) return null; let c = topCols.get(im); if (c) return c;
  const t = document.createElement('canvas'); t.width = t.height = 1; const g = t.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, 1, 1).data; c = 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')'; topCols.set(im, c); return c;
}
// layers back (0) to front; sp(i, n): how fast layer i slides past (track = 1); drift: px/s it creeps on its own (clouds)
// Layers that are a single thing (the palm tree) aren't tiled like wallpaper: they're planted along the shore one at a
// time. Each is a lone tree (leaning either way) or a pair growing from one spot and leaning apart, and nothing else ever
// touches: every planting starts clear of the last one, then a small gap, now and then a long one. All from the track's seed.
const SKY_ONCE = { sky3: { 1: 'once' } };                          // sky layers holding one thing (the moon): drawn once, not tiled
const SCENE_PROPS = { nature3: { 2: { base: 13 } } };             // set: { layer index: { base: where the trunk meets the ground, in the cropped sprite } }
const propCache = new Map();
function propSprite(im) {                                           // the layer cropped to the thing in it, and where its foot sits
  let p = propCache.get(im); if (p) return p;
  const w = im.naturalWidth, h = im.naturalHeight, t = document.createElement('canvas'); t.width = w; t.height = h;
  const g = t.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, w, h).data;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) { p = { c: t, w: 0 }; propCache.set(im, p); return p; }
  const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1; c.getContext('2d').drawImage(im, -x0, -y0);
  p = { c, w: c.width, h: c.height, foot: h - 1 - y1 }; propCache.set(im, p); return p;
}
const plantings = new Map();
function plantAlong(w, base, seed) {                                // [x, flipped] for every tree, left to right, in layer px
  const key = w + '|' + base + '|' + seed; let L = plantings.get(key); if (L) return L;
  L = []; const r = seededRand(seed * 2654435761 >>> 0);
  for (let x = -200; x < 30000;) {
    if (r() < 0.3) {                                               // a pair from one spot, leaning apart: they meet only at the base
      const X = x + (w - 1 - base); L.push([X - (w - 1 - base), true], [X - base, false]); x = X - base + w;
    } else { L.push([x, r() < 0.5]); x += w; }
    const g = r(); x += g < 0.35 ? 2 + r() * 10 : g < 0.8 ? 20 + r() * 45 : 90 + r() * 110;   // then a gap: close, a little way, or a long stretch of open beach
  }
  plantings.set(key, L); return L;
}
function drawProps(im, cx, bottom, speed, cfg, seed) {
  const P2 = propSprite(im); if (!P2.w) return;
  const scroll = Math.round(cx * SC * speed), y = bottom - P2.foot - P2.h;
  for (const [x, flip] of plantAlong(P2.w, cfg.base, seed)) {
    const sx = x - scroll; if (sx > W + 4) break; if (sx + P2.w < -4) continue;
    if (flip) { ctx.save(); ctx.translate(sx + P2.w, y); ctx.scale(-1, 1); ctx.drawImage(P2.c, 0, 0); ctx.restore(); }
    else ctx.drawImage(P2.c, sx, y);
  }
}
// Breaking up the repeats. Every tiled layer has each tile randomly mirrored (still seamless: a tile's edge always
// meets itself or its usual neighbour). Behind a mountain layer, extra peaks line the skyline (from this pack and
// others, repainted in this scene's colours): uneven gaps, some mirrored, some sunk lower so they look further off.
// Loose things (a cloud) are dotted about, and the arctic gets a rare far-off mountain. All from the track's seed.
for (const k in BG_PIECES.skyline) for (const i in BG_PIECES.skyline[k]) { const c = BG_PIECES.skyline[k][i]; c.I = c.pieces.map(u => ({ im: loadImg(u), y: 0 })); }
for (const k in BG_PIECES.objects) for (const i in BG_PIECES.objects[k]) BG_PIECES.objects[k][i].I = BG_PIECES.objects[k][i].map(([u, y]) => ({ im: loadImg(u), y }));
const RARE_I = {}; for (const k in BG_PIECES.rare) RARE_I[k] = BG_PIECES.rare[k].map(u => ({ im: loadImg(u), y: 0 }));
const pieceLayouts = new Map();
function pieceLayout(key, kind, pool, sink, seed) {
  let L = pieceLayouts.get(key); if (L) return L;
  if (!pool.every(p => imgOk(p.im))) return null;
  const r = seededRand((seed * 2654435761) >>> 0); L = [];
  let x = kind === 'rare' ? 300 + r() * 700 : -160;
  while (x < 30000) {
    let P = pool[Math.floor(r() * pool.length)];
    if (L.length && P === L[L.length - 1][0] && pool.length > 1) P = pool[(pool.indexOf(P) + 1 + Math.floor(r() * (pool.length - 1))) % pool.length];   // never the same twice running
    const w = P.im.naturalWidth, flip = r() < 0.5, dy = kind === 'rare' ? 8 + Math.floor(r() * 20) : Math.floor(r() * (sink + 1));
    L.push([P, Math.round(x), flip, dy]);
    if (kind === 'skyline') x += w * (0.45 + r() * 0.9);            // peaks overlap or stand apart
    else if (kind === 'objects') x += w + 20 + r() * 160;
    else x += w + 700 + r() * 1500;                                  // rare: one every so often
  }
  pieceLayouts.set(key, L); return L;
}
function drawPieces(L, cx, bottom, speed) {
  const scroll = Math.round(cx * SC * speed);
  for (const [P, x, flip, dy] of L) {
    const im = P.im, w = im.naturalWidth, h = im.naturalHeight, sx = x - scroll;
    if (sx > W + 4) break; if (sx + w < -4) continue;
    const y = P.y !== undefined && P.y > 0 ? bottom - 65 + P.y + dy : bottom - h + dy;
    if (flip) { ctx.save(); ctx.translate(sx + w, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0); ctx.restore(); }
    else ctx.drawImage(im, sx, y);
  }
}
const layerSeed = (i) => ((race.trk.seed || 7) % 9973) * 31 + i * 7 + 1;
function skylineBehind(set, i, cx, bottom, speed) {                  // extra peaks standing behind layer i's ridge
  const c = BG_PIECES.skyline[set] && BG_PIECES.skyline[set][i]; if (!c) return;
  const L = pieceLayout(set + '|sky|' + i + '|' + layerSeed(i), 'skyline', c.I, 8, layerSeed(i) + 3); if (!L) return;
  drawPieces(L, cx, bottom - 65 + c.hide, speed * 0.85);
}
function objectsLayer(set, i, cx, bottom, speed) {                   // true if layer i is loose objects, drawn here
  const c = BG_PIECES.objects[set] && BG_PIECES.objects[set][i]; if (!c) return false;
  const L = pieceLayout(set + '|obj|' + i + '|' + layerSeed(i), 'objects', c.I, 0, layerSeed(i)); if (!L) return false;
  drawPieces(L, cx, bottom, speed); return true;
}
function rareLayer(set, cx, bottom) {
  const R = RARE_I[set]; if (!R) return;
  const seed = ((race.trk.seed || 7) % 9973) * 17 + 5, L = pieceLayout(set + '|rare|' + seed, 'rare', R, 0, seed);
  if (L) drawPieces(L, cx, bottom, 0.03);
}
function drawLayers(list, cx, bottom, sp, drift, frontFirst, props, set) {
  const n = list.length, idx = [...Array(n).keys()]; if (frontFirst) idx.reverse();
  for (const i of idx) {
    const im = list[i]; if (!imgOk(im)) continue;
    if (props && props[i] === 'once') { ctx.drawImage(im, Math.round(W * 0.68 - im.naturalWidth / 2), bottom - im.naturalHeight); continue; }   // (one moon, staying put)
    if (props && props[i]) { drawProps(im, cx, bottom, sp(i, n), props[i], (race.trk.seed || 7) % 9973); continue; }
    if (set) { skylineBehind(set, i, cx, bottom, sp(i, n)); if (objectsLayer(set, i, cx, bottom, sp(i, n))) continue; }
    const w = im.naturalWidth, h = im.naturalHeight, scroll = Math.floor(cx * SC * sp(i, n) + (drift ? game.tNow * drift * i : 0)), seed = (race.trk.seed || 7) % 9973 + i * 131;
    for (let k = Math.floor(scroll / w) - 1, x = k * w - scroll; x < W + 4; k++, x += w) {   // each tile mirrored or not, at random
      if (x + w < -4) continue;
      if (hash(k * 2654435 + seed) < 0.5) ctx.drawImage(im, x, bottom - h);
      else { ctx.save(); ctx.translate(x + w, bottom - h); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0); ctx.restore(); }
    }
  }
}
const scenerySp = (i, n) => 0.05 + 0.3 * (n > 1 ? i / (n - 1) : 0);
const skySp = (i) => 0.01 * i;
const citySp = (i, n) => i === 0 ? 0 : 0.05 + 0.2 * (n > 1 ? (i - 1) / Math.max(1, n - 2) : 0);
const bgMaskC = document.createElement('canvas');
export function drawBackdrop(cx) {
  if (ATT.on && ATT.titleBg && splashOk() && attTitleBackdrop(cx)) return;   // (the intro video's first race: the title's sun and city behind the track)
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
  const sc = sceneFor();
  if (sc.set && !SCENE_NOTINT[sc.set]) { rareLayer(sc.set, cx, 49); drawLayers(BG_IMG[sc.set], cx, 49, scenerySp, 0, false, SCENE_PROPS[sc.set], sc.set); }   // the scenery runs down behind the trackside barrier
  drawMid(cx); drawBarrier(cx);
}
// darken what's been drawn for the time of day (only where something's drawn), then slide the untinted art in behind it
export function tintMain(L, cx) {
  if (ATT.on && ATT.titleBg && splashOk()) return;
  const c = ctx.canvas, sc = sceneFor();
  if (L) {
    if (bgMaskC.width !== c.width || bgMaskC.height !== c.height) { bgMaskC.width = c.width; bgMaskC.height = c.height; }
    const m = bgMaskC.getContext('2d'); m.globalCompositeOperation = 'copy'; m.drawImage(c, 0, 0); m.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = L.tint; ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(bgMaskC, 0, 0);
    ctx.restore();
  }
  for (const e of view.emits) rect(e[0], e[1], e[2], e[3], e[4]);
  ctx.save(); ctx.globalCompositeOperation = 'destination-over';                // each of these goes behind everything so far
  let back;
  if (sc.city) { const L2 = BG_IMG[sc.city]; drawLayers(L2, cx, 31, citySp, 0, true); back = L2[0]; }   // the city stands on top of our wall
  else {
    if (SCENE_NOTINT[sc.set]) drawLayers(BG_IMG[sc.set], cx, 49, scenerySp, 0, true, SCENE_PROPS[sc.set]);
    const L2 = BG_IMG[sc.sky]; drawLayers(L2, cx, 46, skySp, 1.5, true, SKY_ONCE[sc.sky]); back = L2[0];
  }
  const col = topColor(back);
  ctx.fillStyle = col || '#3cbcfc'; ctx.fillRect(-10, -EXTRA - 4000, W + 20, 4000 + EXTRA + 60);   // (fills only what's still empty)
  ctx.restore();
}
