// Entry point: loads every module in the original's order, then runs the frame loop.

import './core/state.js';
import './core/config.js';
import './core/canvas.js';
import './core/util.js';
import './core/palette.js';
import './world/track.js';
import './world/settings.js';
import './world/terrain.js';
import './world/course.js';
import './world/traffic.js';
import './race/session.js';
import './audio/sound.js';
import './rider/physics.js';
import './rider/secretMoves.js';
import './gfx/bike.js';
import './race/crash.js';
import './rider/air.js';
import './race/play.js';
import './modes/tutorial.js';
import './art/professor.js';
import './modes/replay.js';
import './race/rivals.js';
import './race/finish.js';
import './race/loop.js';
import './art/splash.js';
import './ui/title.js';
import './ui/menu.js';
import './modes/stunt.js';
import './modes/builder.js';
import './modes/builderDraw.js';
import './input/pad.js';
import './gfx/pixel.js';
import './art/riders.js';
import './race/playerLook.js';
import './gfx/riderSprites.js';
import './gfx/scenery.js';
import './art/backdrops.js';
import './gfx/backdrop.js';
import './gfx/road.js';
import './art/vehicles.js';
import './gfx/vehicles.js';
import './ui/hud.js';
import './gfx/lighting.js';
import './art/podium.js';
import './ui/podium.js';
import './ui/overlay.js';
import './gfx/render.js';
import './debug.js';
import './attract/attract.js';
import './attract/scenes.js';

import { assetsReady } from './art/assets.js';
import { attStart, frameRender, frameTick } from './attract/attract.js';
import { engineUpdate } from './audio/sound.js';
import { fitScreen } from './core/canvas.js';
import { STEP } from './core/config.js';
import { presentSplash } from './attract/wide.js';
import { HOST } from './core/host.js';
import { game, menu } from './core/state.js';
import { mountCrt } from './ui/crt.js';
import { VIS_H_EVENT, trackVisibleHeight } from '../lib/visibleHeight';

if (HOST !== 'splash') mountCrt(document.querySelector('.screen'));   // (the splash is under the app's glass)
if (HOST !== 'splash') trackVisibleHeight();                         // (the splash is in the app, which tracks it already)
window.addEventListener('resize', fitScreen);
window.addEventListener(VIS_H_EVENT, fitScreen);
fitScreen(); setTimeout(fitScreen, 300);

let last = 0, accT = 0;
function frame(ts) {
  const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
  game.tNow += dt; accT += dt;
  while (accT >= STEP) { accT -= STEP; frameTick(STEP); }
  engineUpdate();
  frameRender();
  if (HOST === 'splash') presentSplash();                          // (a wide post composes the title's scenes: attract/wide.js)
  requestAnimationFrame(frame);
}
// The inline splash plays the intro video; the game page (opened from it) starts on the title menu, as a press
// during the video would. Either way, once all the art has arrived.
assetsReady().then(() => {
  if (HOST === 'splash') attStart(); else { menu.titleMenu = true; menu.titleSeen = true; }
  requestAnimationFrame(frame);
});
