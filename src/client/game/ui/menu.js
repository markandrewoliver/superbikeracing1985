// What a press does on each screen: the title menu, RANDOM TRACK settings, EDIT PLAYER and the results menu.

import { attStart, attStop } from '../attract/attract.js';
import { audioInit, sfx } from '../audio/sound.js';
import { EXTRA } from '../core/canvas.js';
import { W } from '../core/config.js';
import { ATT, game, menu, race } from '../core/state.js';
import { builderPress, cycle, ed, openBuilder, openSlots, raceBuilt } from '../modes/builder.js';
import { endReplay, startGhostRace, startReplay } from '../modes/replay.js';
import { startStunt } from '../modes/stunt.js';
import { startTutorial, tutPress } from '../modes/tutorial.js';
import { LOOK_ROWS, look, lookChanged } from '../race/playerLook.js';
import { newGame } from '../race/session.js';
import { RES_DY, resItems, resY } from './overlay.js';
import { MENU, MROW, RSROWS, menuOff, menuTop } from './title.js';
import { FEATS, LENS } from '../world/settings.js';
import { rollTrack } from '../world/track.js';

export function anyPress(btn, tap) {
  audioInit();
  if (ATT.on) { if (btn === 'left') return; attStop(); menu.titleMenu = true; menu.titleSeen = true; sfx('lane'); return; }   // the intro video: a press stops it and opens the menu
  if (game.tut && game.state !== 'title') { tutPress(btn); return; }
  if (tap) tap = { x: tap.x, y: tap.y + menuOff() };
  if (game.state === 'title' && !menu.titleMenu) {                          // the splash: any press opens the menu
    if (btn === 'left' || game.stateT < 0.3) return;
    menu.titleMenu = true; menu.titleSeen = true; sfx('lane'); return;
  }
  if (game.state === 'title') {
    if (btn === 'left') { menu.titleMenu = false; sfx('lane'); attStart(); return; }   // back to the splash: the intro video again
    if (btn === 'up' || btn === 'down') { menu.menuSel = (menu.menuSel + (btn === 'up' ? MENU.length - 1 : 1)) % MENU.length; sfx('lane'); return; }
    if (btn === 'left' || game.stateT < 0.3) return;
    if (tap) { const cy = tap.y - menuOff() + EXTRA, i = Math.floor((cy - menuTop() + 4) / MROW); if (i >= 0 && i < MENU.length && i !== menu.menuSel) { menu.menuSel = i; sfx('lane'); return; } }
    if (MENU[menu.menuSel] === 'TRACK BUILDER') openSlots(); else if (MENU[menu.menuSel] === 'HOW TO PLAY') startTutorial(); else if (MENU[menu.menuSel] === 'EDIT PLAYER') { game.state = 'player'; game.stateT = 0; menu.lpRow = 0; } else { game.state = 'raceset'; game.stateT = 0; menu.rsRow = 0; }
  } else if (game.state === 'raceset') {                               // RANDOM TRACK: pick the features, then race
    if (tap) { const i = Math.floor((tap.y - 50) / 14); if (i < 0 || i >= RSROWS.length) return; if (i !== menu.rsRow) { menu.rsRow = i; sfx('lane'); if (i > 1) return; } if (i <= 1) btn = tap.x < W / 2 ? 'left' : 'right'; else btn = 'ok'; }
    if (btn === 'up' || btn === 'down') { menu.rsRow = (menu.rsRow + (btn === 'up' ? RSROWS.length - 1 : 1)) % RSROWS.length; sfx('lane'); return; }
    if (game.stateT < 0.15) return;
    const r = RSROWS[menu.rsRow];
    if (r === 'FEATURES') { if (btn !== 'up' && btn !== 'down') { race.raceFeat = cycle(FEATS, race.raceFeat, btn === 'left' ? -1 : 1); sfx('lane'); } return; }
    if (r === 'LENGTH') { if (btn !== 'up' && btn !== 'down') { race.raceLen = cycle(LENS, race.raceLen, btn === 'left' ? -1 : 1); sfx('lane'); } return; }
    if (btn === 'left') return;
    if (r === 'RACE IT') { if (race.raceFeat === 'stunt') startStunt(); else startRace(); } else { game.state = 'title'; game.stateT = 0; }
  } else if (game.state === 'player') {                                // EDIT PLAYER: left/right changes the colour on the row
    const n = LOOK_ROWS.length + 1;
    if (tap) { const i = Math.floor((tap.y - 63) / 10.5); if (i < 0 || i >= n) return; if (i !== menu.lpRow) { menu.lpRow = i; sfx('lane'); if (i === n - 1) return; } if (i < n - 1) btn = tap.x < W / 2 ? 'left' : 'right'; else btn = 'ok'; }
    if (btn === 'up' || btn === 'down') { menu.lpRow = (menu.lpRow + (btn === 'up' ? n - 1 : 1)) % n; sfx('lane'); return; }
    if (game.stateT < 0.15) return;
    if (menu.lpRow < LOOK_ROWS.length) { const [, k, list] = LOOK_ROWS[menu.lpRow]; look[k] = (look[k] + (btn === 'left' ? list.length - 1 : 1)) % list.length; lookChanged(); sfx('lane'); return; }
    if (btn === 'left') return;
    game.state = 'title'; game.stateT = 0;
  } else if (game.state === 'finish' && game.stateT > 2) {                  // results: REPLAY / VS. GHOST, or back to the menu
    const n = resItems().length;
    if (btn === 'up' || btn === 'down') { menu.resSel = (menu.resSel + (btn === 'up' ? n - 1 : 1)) % n; sfx('lane'); return; }
    if (btn === 'left') return;
    if (tap) { const i = Math.floor((tap.y - (resY() - 2)) / RES_DY); if (i < 0 || i >= n) return; if (i !== menu.resSel) { menu.resSel = i; sfx('lane'); return; } }
    if (menu.resSel === 0) {                                              // TRY AGAIN / NEXT RACE
      if (game.mode === 'stunt') startStunt();
      else if (ed.fromBuilder) raceBuilt();                          // a built track: race it again
      else startRace();
      return;
    }
    if (menu.resSel === 1) { if (game.mode === 'stunt') startReplay(); else startGhostRace(); return; }
    if (ed.fromBuilder) openBuilder(ed.slot); else { game.state = 'title'; game.stateT = 0; }
  } else if (game.state === 'replay') { if (game.stateT > 0.3) endReplay(); } else if (game.stateT > 0.15 || game.state === 'build') builderPress(btn, tap);
}
function startRace() {
  game.tut = null; game.mode = 'race'; rollTrack();
  newGame();
}
