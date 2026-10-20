// The heads-up display while racing.

import { EXTRA, ctx } from '../core/canvas.js';
import { CRUISE0, VMAX, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { ATT, game, race } from '../core/state.js';
import { clamp } from '../core/util.js';
import { rect, text } from '../gfx/pixel.js';
import { stuntBest } from '../modes/stunt.js';
import { drawProfBox, drawProfFade, drawTutBox } from '../modes/tutorial.js';
import { playerPlace } from '../race/finish.js';
import { fmtTime, ordinal } from '../race/play.js';
import { THEME_SUIT, bots } from '../race/rivals.js';
import { bike, finishX, kph } from '../race/session.js';

/* ---------- HUD + overlays ---------- */
function segBar(x, y, n, fill, colorOf) {
  for (let i = 0; i < n; i++) rect(x + i * 6, y, 5, 4, i < fill ? colorOf(i) : '#3c3c3c');
}
export function drawHud() {
  if (ATT.on) return;                                               // (no readouts in the intro video)
  if (game.tut && game.tut.stage === 'intro') { drawProfBox(); drawProfFade(); return; }
  if (game.tut) drawProfFade();
  const b = bike, cruise = CRUISE0 + 70 * clamp(race.maxMeters / 2500, 0, 1);
  if (game.state !== 'title' && !(game.state === 'finish' && game.stateT > (game.mode === 'stunt' ? 0.9 : 2))) {           // the results card replaces the top HUD
    ctx.save(); ctx.translate(0, -EXTRA);
    if (game.tut) { drawTutBox(); ctx.restore(); }
    else if (game.mode === 'stunt') {
      text('SCORE', 4, 3, P.muted); text(Math.floor(game.stuntScore), 4, 12, P.white, 2);
      if (b.airPts > 0 && !b.grounded && (game.state === 'play' || game.state === 'replay')) text('+' + Math.floor(b.airPts), 4, 29, P.cyan, 2);   // climbing live while you trick
      text('SPEED KPH', W / 2, 3, P.muted, 1, 'center'); text(kph(b.v), W / 2, 12, b.turbo > 0 ? P.turbo : P.white, 2, 'center');
      text('BEST', W - 4, 3, P.muted, 1, 'right'); text(Math.floor(stuntBest), W - 4, 12, P.turbo, 2, 'right');
      ctx.restore();
    } else {
    const place = playerPlace();
    text('POS', 4, 3, P.muted); text(ordinal(place), 4, 12, place === 1 ? P.turbo : P.white, 2);
    text('SPEED KPH', W / 2, 3, P.muted, 1, 'center'); text(kph(b.v), W / 2, 12, b.turbo > 0 || b.wBoost > 5 ? P.turbo : P.white, 2, 'center');
    text('TIME', W - 4, 3, P.muted, 1, 'right'); text(fmtTime(game.state === 'finish' ? race.finishT : race.raceT), W - 4, 12, P.white, 2, 'right');
    // race progress strip: every rider's position between start and finish
    const px = (x) => 4 + Math.round(clamp((x - race.startX) / (finishX() - race.startX), 0, 1) * (W - 14));
    rect(4, 28, W - 10, 1, P.dgray);
    for (let k = 0; k < 4; k++) rect(W - 8 + (k & 1) * 2, 26 + (k >> 1) * 2, 2, 2, ((k + (k >> 1)) & 1) ? P.black : P.white);
    for (const o of bots) rect(px(o.x), 27, 2, 3, THEME_SUIT[o.theme]);
    rect(px(b.x) - 1, 26, 4, 5, P.black); rect(px(b.x), 27, 2, 3, P.white);
    ctx.restore();
    }
  }
  rect(0, 133, W, 17, P.black); rect(0, 133, W, 1, P.dgray);
  text('SPEED', 4, 136, P.muted);
  const segV = (i) => VMAX * Math.pow((i + 0.5) / 18, 2);                // bar is on a square-root scale so normal speeds stay readable
  segBar(4, 145, 18, Math.round(Math.sqrt(clamp(b.v / VMAX, 0, 1)) * 18), i => segV(i) > cruise * 1.02 ? (segV(i) > cruise + 150 ? P.flag : P.turbo) : P.green);
  // balance meter: full when level, drains as you tilt either way toward going over.
  // Level -> tip point uses 14 squares (green, then yellow from the danger zone); past the tip point the last 4 run out in red.
  const tx = W - 4 - 107;
  text('BALANCE', tx, 136, P.muted);
  if (game.state === 'play' && b.grounded) {
    const rel = b.rel, a = Math.abs(rel), lim = rel >= 0 ? b.thr : b.thrF, over = rel >= 0 ? 1.3 : 1.0;
    const bal = a <= lim ? 18 - 14 * a / lim : 4 * clamp((over - a) / Math.max(0.01, over - lim), 0, 1);
    const n = Math.ceil(clamp(bal, 0, 18) - 0.01), col = a < lim * 0.8 ? P.green : a < lim ? P.turbo : P.flag;
    segBar(tx, 145, 18, n, () => col);
  } else {
    segBar(tx, 145, 18, 0, () => P.green);
    if (game.state === 'play') text('AIR', W - 4, 136, P.cyan, 1, 'right');
  }
}
