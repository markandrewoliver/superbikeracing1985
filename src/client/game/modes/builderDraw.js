// TRACK BUILDER drawing: tool icons, the toolbar, and the slot and settings screens.

import { K_BIKES, K_HEADS } from '../art/riders.js';
import { EXTRA, ctx } from '../core/canvas.js';
import { BIKE_SX, H, LANES, LANE_SY, PX_M, SC, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, menu, race, view } from '../core/state.js';
import { clamp } from '../core/util.js';
import { rect, text, wsx } from '../gfx/pixel.js';
import { bikeBase, kBikeGrid, kCol, kPaintHead } from '../gfx/riderSprites.js';
import { BROWS, CELL_M, MIN_LEN, PIECES, TB_COLS, TB_Y, TOOLS, TOOL_W, cellM, ed, editMax, lanesOf, loopSpan, slotSel, slots, tplFeat, viewLift } from './builder.js';
import { fmtTime } from '../race/play.js';
import { FRONT_BODY } from '../art/bodies.js';
import { LOOK_BODIES, LOOK_HEADS, LOOK_ROWS, LP_DY, LP_Y0, look, lookLabel } from '../race/playerLook.js';
import { dim } from '../ui/overlay.js';
import { drawPodFigure } from '../ui/podium.js';
import { RSROWS } from '../ui/title.js';
import { BGS, FEAT_NAME, LEN_NAME, SURF } from '../world/settings.js';
import { laneBase } from '../world/terrain.js';

const TOOL_ICON = {
  climb: (x, y) => { for (let i = 0; i < 4; i++) rect(x + 3 + i * 3, y + 10 - i * 2, 3, 2 + i * 2, P.dust); },
  drop: (x, y) => { for (let i = 0; i < 4; i++) rect(x + 3 + i * 3, y + 4 + i * 2, 3, 8 - i * 2, P.dirtD); },
  hill: (x, y) => { rect(x + 4, y + 7, 12, 4, P.orange); rect(x + 7, y + 5, 6, 2, P.orange); },
  mesa: (x, y) => { rect(x + 2, y + 7, 16, 4, P.orange); rect(x + 5, y + 4, 10, 3, P.orange); },
  kick: (x, y) => { for (let i = 0; i < 8; i++) rect(x + 5 + i, y + 10 - i, 1, i + 1, P.peach); },
  bigkick: (x, y) => { for (let i = 0; i < 12; i++) rect(x + 3 + i, y + 12 - i, 1, i + 1, P.peach); rect(x + 14, y + 1, 1, 12, P.flag); },
  whoops: (x, y) => { for (let i = 0; i < 3; i++) { rect(x + 2 + i * 6, y + 8, 5, 3, P.orange); rect(x + 3 + i * 6, y + 7, 3, 1, P.orange); } },
  mud: (x, y) => { rect(x + 2, y + 6, 16, 5, P.mud); rect(x + 5, y + 7, 3, 1, P.mud2); rect(x + 12, y + 9, 3, 1, P.mud2); },
  turbo: (x, y) => { for (let k = 0; k < 2; k++) for (let r = 0; r < 7; r++) { const dx = r <= 3 ? r : 6 - r; rect(x + 4 + k * 6 + dx, y + 3 + r, 2, 1, P.turbo); } },
  river: (x, y) => { rect(x + 2, y + 4, 16, 8, '#0058f8'); rect(x + 4, y + 6, 4, 1, '#a4e4fc'); rect(x + 10, y + 9, 5, 1, '#a4e4fc'); },
  car: (x, y) => { rect(x + 6, y + 4, 7, 3, '#3cbcfc'); rect(x + 2, y + 7, 16, 4, P.flag); rect(x + 4, y + 11, 3, 2, '#3c3c3c'); rect(x + 13, y + 11, 3, 2, '#3c3c3c'); rect(x + 17, y + 8, 1, 1, P.turbo); },
  bar: (x, y) => { for (let i = 0; i < 4; i++) rect(x + 3 + i * 4, y + 4, 4, 4, i & 1 ? P.flag : P.white); rect(x + 4, y + 8, 1, 5, P.white); rect(x + 15, y + 8, 1, 5, P.white); },
  loop: (x, y) => { for (let k = 0; k < 40; k++) { const a = k / 40 * 2 * Math.PI; rect(x + 10 + Math.round(5.5 * Math.sin(a)), y + 7 - Math.round(5.5 * Math.cos(a)), 1, 1, P.peach); } rect(x + 2, y + 12, 16, 1, P.peach); },
  lanes: (x, y) => { for (let i = 0; i < LANES; i++) rect(x + 4, y + 2 + i * 3, 12, 2, i < ed.n ? P.turbo : '#3c3c3c'); },
  erase: (x, y) => { for (let i = 0; i < 7; i++) { rect(x + 6 + i, y + 4 + i, 2, 1, P.flag); rect(x + 12 - i, y + 4 + i, 2, 1, P.flag); } },
  done: (x, y) => { text('OK', x + 4, y + 4, P.green); }
};
function drawTooShort(y) {                                        // the 'too short' message, shown for a couple of seconds
  if (!(ed.err > 0)) return;
  rect(10, y - 4, W - 20, 26, P.black); rect(10, y - 4, W - 20, 1, P.flag); rect(10, y + 21, W - 20, 1, P.flag);
  text('NEEDS TO BE A LITTLE BIT LONGER', W / 2, y, P.flag, 1, 'center');
  text('BUILD AT LEAST ' + MIN_LEN + 'M  (NOW ' + ed.t.len + 'M)', W / 2, y + 11, P.white, 1, 'center');
}
export function drawBuilderUI() {
  const blink = Math.sin(game.tNow * 8) > -0.2, t = ed.t;
  // footprint of the current tool at the cursor, on every lane the brush covers
  const tool = TOOLS[ed.tool], len = PIECES[tool] ? PIECES[tool].span : 24;
  const cm = cellM(), wx0 = race.startX + cm * PX_M, x0 = Math.round(wsx(wx0, view.camX)), x1 = Math.round(x0 + len * SC);
  const span = tool === 'loop' ? loopSpan(ed.lane, ed.n) : [ed.lane, Math.min(LANES, ed.lane + ed.n) - 1];
  const lanes = []; for (let l = span[0]; l <= span[1]; l++) lanes.push(l);
  // the grid: one cell per 10 m per lane, always visible, riding on each lane's ground
  ctx.save(); ctx.translate(0, viewLift());
  const c0 = Math.floor((view.camX - race.startX - BIKE_SX / SC) / PX_M / CELL_M) - 1;
  for (let c = c0; c < c0 + 10; c++) {
    if (c < 0 || c * CELL_M > editMax()) continue;
    const wx = race.startX + c * CELL_M * PX_M, gx = Math.round(wsx(wx, view.camX));
    if (gx < -1 || gx > W) continue;
    for (let l = 0; l < LANES; l++) { const y0 = LANE_SY[l] - 15 - Math.round(laneBase(l, wx) * SC); for (let y = y0 + 1; y < y0 + 17; y += 3) rect(gx, y, 1, 1, 'rgba(252,252,252,0.55)'); }
    if ((c * CELL_M) % 50 === 0) text(String(c * CELL_M), gx + 2, LANE_SY[0] - 25 - Math.round(laneBase(0, wx) * SC), P.white);
  }
  if (ed.focus === 'lanes') for (const l of lanes) {
    const lift = Math.round(laneBase(l, wx0) * SC), y0 = LANE_SY[l] - 15 - lift, cx1 = Math.round(x0 + CELL_M * PX_M * SC);
    rect(x0 + 1, y0 + 1, cx1 - x0 - 1, 16, 'rgba(255,207,58,0.28)');
    if (blink) { rect(x0, y0, x1 - x0, 1, P.turbo); rect(x0, y0 + 17, x1 - x0, 1, P.turbo); rect(x0, y0, 1, 18, P.turbo); rect(x1, y0, 1, 18, P.turbo); }
    rect(x0, y0 - 3, 1, 22, P.white);
  }
  ctx.restore();
  // top bar: where you are and what you're holding
  ctx.save(); ctx.translate(0, -EXTRA);
  rect(0, 0, W, 31, P.black);
  text('SLOT ' + (ed.slot + 1), 4, 3, P.muted);
  text(cellM() + 'M  TRACK ' + t.len + 'M', W / 2, 3, t.len >= MIN_LEN ? P.white : P.muted, 1, 'center');
  if (tool !== 'lanes') text(tool === 'done' ? 'BACK' : tool === 'erase' ? 'ERASE' : PIECES[tool].name, W - 4, 3, P.turbo, 1, 'right');   // (the lane-count tool shows only its icon)
  const mapM = Math.max(t.len, MIN_LEN, cellM() + 60), mx = (m) => 4 + Math.round(clamp(m / mapM, 0, 1) * (W - 8));
  if (t.len < MIN_LEN) rect(mx(MIN_LEN), 12, 1, 10, P.flag);                   // where the track needs to reach
  rect(4, 18, W - 8, 1, P.dgray);
  const MAPC = { river: '#3cbcfc', climb: P.green, drop: P.flag, mud: P.mud2, turbo: P.turbo, car: P.white, bar: P.flag, loop: P.peach };
  for (const p of t.pieces) { const [a, b] = lanesOf(p); rect(mx(p.x), 14 + a, p.t === 'climb' || p.t === 'drop' ? 3 : 1, b - a + 1, MAPC[p.t] || P.orange); }
  rect(mx(cellM()), 11, 1, 12, P.white);
  text('TAP OR PRESS TO PLACE', W / 2, 24, P.muted, 1, 'center');
  ctx.restore();
  // toolbar in place of the bottom HUD: two rows of eight
  rect(0, TB_Y - 1, W, H - TB_Y + 1, P.black); rect(0, TB_Y - 1, W, 1, P.dgray);
  TOOLS.forEach((key, i) => {
    const x = (i % TB_COLS) * TOOL_W, y = TB_Y + (i >= TB_COLS ? 16 : 0), on = i === ed.tool;
    if (on) { rect(x, y, TOOL_W, 16, ed.focus === 'tools' && blink ? P.turbo : '#3c3c3c'); rect(x + 1, y + 1, TOOL_W - 2, 14, P.black); }
    TOOL_ICON[key](x + 5, y + 1);
  });
  drawTooShort(80);
}
export function drawBuilderOverlay() {
  const blink = Math.sin(game.tNow * 5) > -0.3;
  if (game.state === 'slots') {
    dim();
    text('TRACK BUILDER', W / 2, 14, P.turbo, 2, 'center');
    rect(12, 36, W - 24, 72, '#14208a'); rect(12, 36, W - 24, 1, P.white); rect(12, 107, W - 24, 1, P.white);
    for (let i = 0; i < 4; i++) {
      const y = 44 + i * 18, on = i === slotSel, s = slots[i];
      if (on) { rect(16, y - 4, W - 32, 15, '#2d46d6'); rect(16, y - 4, W - 32, 1, P.turbo); rect(16, y + 10, W - 32, 1, P.turbo); }
      const label = i === 3 ? 'BACK' : 'SLOT ' + (i + 1) + '  ' + (s ? (s.tod + ' ' + BGS[s.bg].name + ' ' + s.len + 'M ' + s.pieces.length + ' PCS').toUpperCase() : 'EMPTY - NEW TRACK');
      text(label, 22, y, on ? P.turbo : P.muted);
    }
    if (blink) text('PRESS RIGHT OR TAP TO OPEN', W / 2, 124, P.turbo, 1, 'center');
  } else if (game.state === 'raceset') {
    dim();
    text('RANDOM TRACK', W / 2, 14, P.turbo, 2, 'center');
    rect(16, 44, W - 32, 64, '#14208a'); rect(16, 44, W - 32, 1, P.white); rect(16, 107, W - 32, 1, P.white);
    RSROWS.forEach((r, i) => {
      const y = 52 + i * 14, on = i === menu.rsRow;
      if (on) { rect(20, y - 3, W - 40, 12, '#2d46d6'); rect(20, y - 3, 2, 12, P.turbo); }
      const val = r === 'FEATURES' ? FEAT_NAME[race.raceFeat] : r === 'LENGTH' ? LEN_NAME[race.raceLen] : null;
      if (val) { text(r, 28, y, on ? P.turbo : P.muted); text((on ? '< ' : '') + val + (on ? ' >' : ''), W - 28, y, on ? P.white : P.muted, 1, 'right'); }
      else text(r, W / 2, y, on ? P.turbo : P.muted, 1, 'center');
    });
  } else if (game.state === 'player') {
    dim();
    text('EDIT PLAYER', W / 2, 3, P.turbo, 2, 'center');
    rect(16, 19, W - 32, 40, '#14208a'); rect(16, 56, W - 32, 3, '#5a78f0');          // a little stage: on the bike, and standing
    const bb = bikeBase(0, 0, 0, Math.floor(game.tNow * 6) & 1, true, 0, 0);
    ctx.drawImage(bb, W / 2 - 26 - bb.ax, 56 - bb.ay);
    drawPodFigure('stand', 0, LOOK_HEADS[look.head], 0, 0, W / 2 + 35, 36);   // standing, facing us (as on the podium)
    rect(16, 61, W - 32, 88, '#14208a'); rect(16, 61, W - 32, 1, P.white); rect(16, 148, W - 32, 1, P.white);
    const px1 = (x0, y0) => (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x0 + x, y0 + y, 1, 1); };   // thumbnails: one pixel per Kenney pixel
    [...LOOK_ROWS, ['BACK TO MENU']].forEach((r, i) => {
      const [, k, list, kind] = r, y = LP_Y0 + i * LP_DY | 0, on = i === menu.lpRow;
      if (on) { rect(20, y - 1, W - 40, 9, '#2d46d6'); rect(20, y - 1, 2, 9, P.turbo); }
      if (!k) { text(r[0], W / 2, y + 1, on ? P.turbo : P.muted, 1, 'center'); return; }
      text(lookLabel(r), 28, y + 1, on ? P.turbo : P.muted);
      const sx = W - 60, cy = y + 4;                                   // the choice, centred in a 20 x 8 box
      if (kind === 'col') {
        const c = list[look[k]];
        rect(sx - 1, y, 22, 9, on ? P.white : P.white); rect(sx, y + 1, 10, 7, c[0]); rect(sx + 10, y + 1, 10, 7, c[1]); }
      else if (kind === 'body') { FRONT_BODY[LOOK_BODIES[look.body]].rows.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) if (row[xx] !== '.') { ctx.fillStyle = kCol(row[xx], 0); ctx.fillRect(sx + 6 + xx, y + 1 + yy, 1, 1); } }); }   // the torso, facing us
      else if (kind === 'head') { const H = K_HEADS[LOOK_HEADS[look.head]], z = H.art.length > 6 ? 1 : 2, x0 = sx + 10 - Math.round(z * H.art[0].length / 2), y0 = y + 9 - z * H.art.length; kPaintHead((x, yy, c) => { ctx.fillStyle = c; ctx.fillRect(x0 + z * x, y0 + z * yy, z, z); }, LOOK_HEADS[look.head], 0, 0, 0); }   // heads at game size (the tall ones at half, to fit the row)
      else { const B = K_BIKES[look.bikeType], gr = kBikeGrid(0, 0, 0), w = gr[0].length; let top = 0; while (top < gr.length && gr[top].every(c => c === '.')) top++;
        const put = px1(sx + 10 - (w >> 1), y + 8 - gr.length + 1); gr.forEach((row, yy) => row.forEach((ch, xx) => { if (ch !== '.') put(xx, yy, kCol(ch, 0)); })); }
      if (on) for (let d = 0; d < 4; d++) { rect(sx - 10 + d, y + 4 - d, 1, 1 + 2 * d, P.white); rect(sx + 29 - d, y + 4 - d, 1, 1 + 2 * d, P.white); }   // arrows: left/right changes it
    });
  } else if (game.state === 'buildset') {
    dim();
    const t = ed.t;
    text('SLOT ' + (ed.slot + 1), W / 2, 6, P.turbo, 2, 'center');
    rect(16, 21, W - 32, 113, P.black); rect(16, 21, W - 32, 1, P.dgray); rect(16, 133, W - 32, 1, P.dgray);
    const val = { TIME: t.tod, SCENERY: BGS[t.bg].name, SURFACE: SURF[t.surf].name, CROWD: t.crowd ? 'ON' : 'OFF' };
    BROWS.forEach((r, i) => {
      const y = 26 + i * 11, on = i === ed.row;
      if (on) { rect(20, y - 2, W - 40, 11, '#2c2c2c'); rect(20, y - 2, 2, 11, P.turbo); }
      if (val[r] !== undefined) { text(r, 28, y, on ? P.turbo : P.muted); text((on ? '< ' : '') + String(val[r]).toUpperCase() + (on ? ' >' : ''), W - 28, y, on ? P.white : P.muted, 1, 'right'); }
      else if (r === 'BUILD FROM TEMPLATE') {                      // the type on the right, with arrows either side when it's picked
        if (on && ed.sureTpl) { text('REPLACE? PRESS AGAIN', W / 2, y, P.flag, 1, 'center'); return; }
        text(r, 24, y, on ? P.turbo : P.muted); const v = FEAT_NAME[tplFeat], vx = W - 30 - (v.length * 6 - 1);
        text(v, W - 30, y, on ? P.white : P.muted, 1, 'right');
        if (on) for (let d = 0; d < 3; d++) rect(vx - 6 + d, y + 3 - d, 1, 1 + 2 * d, P.white);   // left changes it
      }
      else text(r === 'CLEAR TRACK' && ed.sure ? 'CLEAR? PRESS AGAIN' : r, W / 2, y, on ? (r === 'CLEAR TRACK' ? P.flag : P.turbo) : P.muted, 1, 'center');
    });
    text(t.pieces.length + ' PIECES  ' + t.len + 'M' + (t.best ? '  BEST ' + fmtTime(t.best) : ''), W / 2, 139, t.len >= MIN_LEN ? P.muted : P.flag, 1, 'center');
    drawTooShort(70);
  }
}
