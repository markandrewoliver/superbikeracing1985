// Overlays over the scene: the countdown, the title menu, settings screens and the results menu.

import { EXTRA, ctx, cv } from '../core/canvas.js';
import { H, W } from '../core/config.js';
import { P } from '../core/palette.js';
import { ATT, game, menu, race, view } from '../core/state.js';
import { drawStr, rect, text } from '../gfx/pixel.js';
import { ditherPat } from '../gfx/scenery.js';
import { stuntBest } from '../modes/stunt.js';
import { fmtTime } from '../race/play.js';
import { bike } from '../race/session.js';
import { drawPodium } from './podium.js';
import { MENU, MROW, SPLASH_T, drawTitleArt, menuTop, splashOk, titleLayout } from './title.js';

export const RES_DY = 11, resY = () => game.mode === 'stunt' ? 92 : EXTRA >= 100 ? 92 : 112;
export const resItems = () => game.mode === 'stunt' ? ['TRY AGAIN', 'REPLAY', 'BACK TO MENU'] : ['NEXT RACE', 'VS. GHOST', 'BACK TO MENU'];
export function drawResMenu() {
  if (game.stateT <= 2) return;
  const blink = Math.sin(game.tNow * 5) > -0.3, y0 = resY();
  resItems().forEach((m, i) => {
    const y = y0 + i * RES_DY, on = i === menu.resSel;
    if (on) { rect(W / 2 - 52, y - 2, 104, 11, P.black); rect(W / 2 - 52, y - 2, 104, 1, P.turbo); rect(W / 2 - 52, y + 8, 104, 1, P.turbo); }
    text((on && blink ? '> ' : '  ') + m + (on && blink ? ' <' : '  '), W / 2, y, on ? P.turbo : P.muted, 1, 'center');
  });
}
view.noDim = false; menu.titleSeen = false;
export function dim() { if (view.noDim) return; ctx.fillStyle = ditherPat; ctx.fillRect(0, -EXTRA - 200, W, H + EXTRA + 400); }
export function drawOverlay() {
  if (ATT.on && (ATT.noOverlay || game.state !== 'title')) return;      // (the intro video: no countdown, no WIPEOUT!; the title screen still draws itself here)
  const blink = Math.sin(game.tNow * 5) > -0.3;
  if (game.tut) {
    if (game.tut.slow && blink) text('SLOW MOTION', W / 2, 56, P.turbo, 2, 'center');
    if (game.tut.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, game.tut.fade) + ')'; ctx.fillRect(0, -EXTRA - 400, W, H + EXTRA + 800); }
    return;
  }
  if (game.state === 'title') {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);                 // the splash fills the whole screen, title art and all
    const Hc = cv.height, L = titleLayout(), S = L.big ? 2 : 1;
    rect(0, 0, W, Hc, '#140c3c');                                  // (the picture's own night colour, to the edges)
    if (!menu.titleMenu) {
      if (splashOk()) drawTitleArt(menu.titleSeen ? 99 : game.stateT);
      if (game.stateT > SPLASH_T.year[1] + 0.3) menu.titleSeen = true;
      if (blink) {                                                 // big yellow letters with a black outline
        const s = 'PRESS TO START', sz = 2, w = s.length * 6 * sz - sz, x = Math.round((W - w) / 2), y = Hc - 30;
        for (let dx = -2; dx <= 2; dx += 2) for (let dy = -2; dy <= 2; dy += 2) if (dx || dy) drawStr(s, x + dx, y + dy, P.black, sz);
        drawStr(s, x, y, P.turbo, sz);
      }
    } else {
      rect(0, 0, W, Hc, '#1d2fb8');                                // the menu: a blue box with a white outline, filling the screen
      rect(3, 3, W - 6, 2, P.white); rect(3, Hc - 5, W - 6, 2, P.white); rect(3, 3, 2, Hc - 6, P.white); rect(W - 5, 3, 2, Hc - 6, P.white);
      MENU.forEach((m, i) => {
        const y = menuTop() + i * MROW, on = i === menu.menuSel;
        text((on && blink ? '> ' : '  ') + m + (on && blink ? ' <' : '  '), W / 2, y, on ? P.turbo : P.white, 2, 'center');
      });
      if (race.best > 0) text('BEST TIME ' + fmtTime(race.best), W / 2, Hc - 22, P.white, 1, 'center');
    }
    ctx.restore();
  } else if (game.state === 'crash') {
    const hg = bike.crash && bike.crash.hinge;                     // (falling off a REDEEMER or HEADSTAND: not till he hits the road)
    if (bike.crash && (hg ? hg.landed && (bike.crash.t0 === undefined || game.stateT - bike.crash.t0 < 0.6) : bike.crash.t0 === undefined || game.stateT - bike.crash.t0 < 0.6)) text('WIPEOUT!', W / 2, 62, P.flag, 2, 'center');
  } else if (game.state === 'count') {
    const n = 3 - Math.floor(game.stateT / 0.8);
    text(n > 0 ? String(n) : 'GO', W / 2 + 34, 62, n > 0 ? P.white : P.turbo, 3, 'center');
  } else if (game.state === 'finish' && game.stateT > 0.9 && game.mode === 'stunt') {
    dim();
    text(bike.crash ? 'WIPEOUT' : 'STUNT SCORE', W / 2, 16, bike.crash ? P.flag : P.turbo, 2, 'center');
    text(Math.floor(game.stuntScore), W / 2, 42, P.white, 3, 'center');
    text(game.stuntScore && game.stuntScore >= stuntBest ? 'NEW BEST!' : 'BEST ' + Math.floor(stuntBest), W / 2, 76, P.turbo, 1, 'center');
    drawResMenu();
  } else if (game.state === 'finish' && game.stateT > 2 && race.podium) drawPodium();
}
