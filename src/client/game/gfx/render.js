// One frame of drawing, back to front.

import { CAR_SPRITES } from '../art/vehicles.js';
import { EXTRA, ctx, cv, setCtx } from '../core/canvas.js';
import { LANES, LANE_SY, SC, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, menu, race, view } from '../core/state.js';
import { clamp, rnd, seededRand } from '../core/util.js';
import { drawBackdrop, tintMain } from './backdrop.js';
import { drawBikeShifted, drawBikeSprite } from './bike.js';
import { LIGHT, drawBeams, fgC, fgCtx, maskC, tintLayer } from './lighting.js';
import { rect, wsx } from './pixel.js';
import { drawBand, drawCurb, drawExitSign, drawLaneGround, drawLaneSolids, loopKey } from './road.js';
import { drawBarricade, drawLine, drawParts, drawPopups, drawRival, drawVehicle } from './vehicles.js';
import { viewLift } from '../modes/builder.js';
import { drawBuilderOverlay, drawBuilderUI } from '../modes/builderDraw.js';
import { bots } from '../race/rivals.js';
import { bike, finishX, fx, laneYAt, laneYNow } from '../race/session.js';
import { drawHud } from '../ui/hud.js';
import { drawOverlay } from '../ui/overlay.js';
import { menuOff, splashOk } from '../ui/title.js';
import { world } from '../world/track.js';
import { traffic } from '../world/traffic.js';

/* ---------- frame ---------- */
export function render() {
  const menuish = game.state === 'title' || game.state === 'slots' || game.state === 'raceset' || game.state === 'player';
  if (menuish && game.state !== 'title' && splashOk()) {               // the other menu pages sit over the finished splash, unchanged
    menu.titleSeen = true;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const Hc = cv.height;
    rect(0, 0, W, Hc, '#1d2fb8');                                  // every menu page is the same blue box with a white outline
    rect(3, 3, W - 6, 2, P.white); rect(3, Hc - 5, W - 6, 2, P.white); rect(3, 3, 2, Hc - 6, P.white); rect(W - 5, 3, 2, Hc - 6, P.white);
    ctx.restore();
    ctx.save(); ctx.translate(0, EXTRA);
    const mo = menuOff();
    view.noDim = true; ctx.save(); ctx.translate(0, -mo);
    drawOverlay(); drawBuilderOverlay(); ctx.restore(); view.noDim = false;
    ctx.restore();
    return;
  }
  const L = LIGHT[race.trk.tod], cx = menuish ? view.titleScroll : (game.state === 'finish' && game.stateT > 2 && race.podium) ? race.podium.cx : view.camX;   // (the podium scene stands still)
  const editing = game.state === 'build' || game.state === 'buildset';
  const shx = fx.shake > 0.1 ? Math.round(rnd(-1, 1) * fx.shake * 0.25) : 0, shy = fx.shake > 0.1 ? Math.round(rnd(-1, 1) * fx.shake * 0.25) : 0;
  view.emits = []; view.lamps = []; view.glows = []; view.fires = [];
  // 1) backdrop, tinted, with its lights re-lit
  const podScene = game.state === 'finish' && game.stateT > 2 && race.podium;
  const cl = podScene ? (EXTRA >= 100 ? -99 : 0) : viewLift();
  view.lightOff = [shx, EXTRA + shy + cl];
  ctx.save(); ctx.translate(shx, EXTRA + shy + cl);
  drawBackdrop(cx); tintMain(L, cx);
  ctx.restore();
  // 2) track, riders and effects on their own layer
  if (fgC.width !== cv.width || fgC.height !== cv.height) { fgC.width = maskC.width = cv.width; fgC.height = maskC.height = cv.height; fgCtx.imageSmoothingEnabled = false; }
  const main = ctx; setCtx(fgCtx);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, fgC.width, fgC.height);
  ctx.save(); ctx.translate(shx, EXTRA + shy + cl);
  for (let i = 0; i < LANES; i++) drawBand(i, cx);
  if (podScene) { for (let i = 0; i < LANES; i++) drawLaneGround(i, cx); drawCurb(cx); }   // the track itself, bare: no ramps, lines or riders
  else if (editing) {
    drawLine(finishX(), cx, true, -1);                            // drawn like a race (loops, barricades and parked cars too), minus the riders
    const bars = new Set(); for (let l = 0; l < LANES; l++) for (const d of world.decals[l]) if (d.type === 'box') bars.add(d);
    const cars = (world.carSpots || []).map(c => ({ spr: Math.floor(seededRand((Math.round(c.x) * 31 + c.l * 7 + 1) >>> 0)() * CAR_SPRITES.length), x: c.x, lane: c.l, laneF: c.l, v: 0, roll: 0, bph: 0, bper: 2 }));
    view.loopRiders = new Map();
    for (let i = 0; i < LANES; i++) drawLaneGround(i, cx);
    for (let i = 0; i < LANES; i++) {
      drawLaneSolids(i, cx); drawLine(finishX(), cx, true, i);
      for (const d of bars) if (d.b === i) drawBarricade(d);
      for (const c of cars) if (c.lane === i) drawVehicle(c);
    }
  } else if (menuish) {                                       // idle wheelie demo behind the title
    const a = Math.max(0, 0.32 + 0.3 * Math.sin(game.tNow * 1.8));
    drawBikeSprite(LANE_SY[1], a, a > 0.03 ? 1 : 0, a > 0.4 ? -2 : a > 0.05 ? -1 : 0, 0, Math.floor(game.tNow * 8) & 1, Math.floor(view.titleScroll / 7 / 2.2) & 1);
  } else {
    // Back lane to front: each lane's ground and obstacles, then the riders in it, so a ramp or
    // hill in a nearer lane correctly hides a rider behind it.
    drawLine(finishX(), cx, true, -1);
    const ents = bots.map(o => ({ lf: o.crash ? o.lane : o.laneF, f: () => { if (o.ghost) ctx.globalAlpha = 0.5; drawRival(o); ctx.globalAlpha = 1; }, lp: o.loop ? loopKey(o.loop.o) : null, rd: o.laneF, th: o.loop ? o.loop.th : 0, ax: wsx(o.x + (o.loopDX || 0), view.camX), ay: laneYAt(o.laneF) - o.hv * SC }));
    for (const q of traffic) ents.push({ lf: q.laneF - 0.01, f: () => drawVehicle(q), lp: null });
    { const seen = new Set(); for (let l = 0; l < LANES; l++) for (const d of world.decals[l]) if (d.type === 'box' && !seen.has(d)) { seen.add(d); ents.push({ lf: d.b - 0.02, f: () => drawBarricade(d), lp: null }); } }
    ents.push({ lf: bike.laneF + 0.01, f: drawBikeShifted, lp: bike.loop && !bike.crash ? loopKey(bike.loop.o) : null, rd: bike.laneF, th: bike.loop ? bike.loop.th || 0 : 0, ax: wsx(bike.x + (bike.loopDX || 0), view.camX), ay: laneYNow() - bike.hv * SC });
    view.loopRiders = new Map();
    for (const e of ents) if (e.lp) { const f = e.f; e.f = () => { if (!e.drawn) { e.drawn = true; f(); } }; if (!view.loopRiders.has(e.lp)) view.loopRiders.set(e.lp, []); view.loopRiders.get(e.lp).push({ f: e.f, d: e.rd, th: e.th, ax: e.ax, ay: e.ay }); }
    ents.sort((a, b) => a.lf - b.lf);
    for (let i = 0; i < LANES; i++) drawLaneGround(i, cx);
    drawCurb(cx);                                                  // riders and wreckage go over the kerb
    for (let i = 0; i < LANES; i++) {
      drawLaneSolids(i, cx); drawLine(race.startX, cx, false, i); drawLine(finishX(), cx, true, i);
      for (const e of ents) if (!e.lp && clamp(Math.round(e.lf), 0, LANES - 1) === i) e.f();
    }
    for (const e of ents) if (e.lp && !e.drawn) e.f();             // (riders on a loop are normally drawn with the loop itself)
    if (game.tut) for (const o of world.decals[2]) if (o.type === 'exitsign') drawExitSign(o, cx);   // how to play: the EXIT sign stands at the front, over everything
  }
  if (editing || menuish) drawCurb(cx);
  if (!menuish && !editing && !podScene) drawParts(cx);
  ctx.restore();
  tintLayer(L);
  setCtx(main);
  ctx.drawImage(fgC, 0, 0);
  // 3) beams, then everything that sits on the glass
  ctx.save(); ctx.translate(shx, EXTRA + shy + cl); drawBeams(L); if (!menuish && !editing) drawPopups(); ctx.restore();
  ctx.save(); ctx.translate(0, EXTRA);
  if (game.state === 'build') drawBuilderUI(); else if (!editing && game.state !== 'slots' && game.state !== 'raceset' && game.state !== 'player' && !(game.state === 'finish' && game.stateT > 2 && race.podium)) drawHud();
  const mo = menuOff();                                            // even, so the dither checkerboard stays aligned
  if (mo) {                                                        // menus sit in the middle of a tall screen
    ctx.save(); ctx.translate(0, -mo); drawOverlay(); drawBuilderOverlay(); ctx.restore();
  } else { drawOverlay(); drawBuilderOverlay(); }
  ctx.restore();
}
