// Test hooks: window.__scramble drives the game directly (used by the equivalence and input tests).

import { attGo, attStart, attStop } from './attract/attract.js';
import { EXTRA } from './core/canvas.js';
import { ATT, game, race, view } from './core/state.js';
import { rotFrame } from './gfx/pixel.js';
import { render } from './gfx/render.js';
import { bikeBase, footBase } from './gfx/riderSprites.js';
import { ed, openBuilder, openEditor, placePiece, raceBuilt, slots } from './modes/builder.js';
import { startGhostRace, startReplay } from './modes/replay.js';
import { startStunt } from './modes/stunt.js';
import { startTutorial } from './modes/tutorial.js';
import { crash } from './race/crash.js';
import { playerPlace } from './race/finish.js';
import { INTRO_T, tick, tickIntro } from './race/loop.js';
import { bots } from './race/rivals.js';
import { bike, finishX, genWith, inp, newGame } from './race/session.js';
import { laneMove } from './rider/physics.js';
import { secretCode } from './rider/secretMoves.js';
import { anyPress } from './ui/menu.js';
import { genRow } from './world/course.js';
import { slopeAt, terrain } from './world/terrain.js';
import { rollTrack, world } from './world/track.js';
import { traffic, vehAlong, vehBlocked } from './world/traffic.js';

window.__scramble = { setLen: (l) => { race.raceLen = l; }, forceCrash: (w) => crash(w), traffic, landZones: () => world.landZones, genAll: () => { while (world.cursor < finishX()) genWith(genRow); }, vehBlocked: (...a) => vehBlocked(...a), vehAlong: (...a) => vehAlong(...a), bike, inp, world, tick, newGame, laneMove, terrain, slopeAt, render, getState: () => game.state, getLives: () => race.crashes, getMeters: () => race.maxMeters, getTop: () => race.topSpeed, sprites: { bikeBase, footBase, rotFrame }, bots, finishX, getRaceT: () => race.raceT, getFinishT: () => race.finishT, place: () => playerPlace(),
  rollTrack, getTrack: () => race.trk, cam: () => view.camLift, camX: () => view.camX, extra: () => EXTRA, setTrack: (o) => { race.trk = Object.assign({ tod: 'day', bg: 'dirt', crowd: true, base: 'asphalt', sections: [], rivers: 0, riverAt: [] }, o); },
  builder: { openBuilder, raceBuilt, openEditor, placePiece, ed: () => ed, slots: () => slots },
  startTutorial, tut: () => game.tut,
  startReplay, startGhostRace, rec: () => game.runRec, press: (b) => anyPress(b), code: (n) => secretCode(n),
  startStunt, getStuntLoops: () => game.stuntLoops, stuntScore: () => game.stuntScore, getMode: () => game.mode,
  skipCount: () => { if (game.state === 'intro') { game.stateT = INTRO_T; tickIntro(0); } if (game.state === 'count') { game.state = 'play'; game.stateT = 0; } } };
window.__attGo = (i) => { if (!ATT.on) attStart(); attGo(i); ATT.band = -1; };   // (for testing)
for (const k of ['newGame', 'startStunt', 'startTutorial', 'startGhostRace', 'startReplay', 'setTrack']) {   // (tests drive the game directly: the video gets out of the way)
  const f = window.__scramble[k]; if (f) window.__scramble[k] = (...a) => { if (ATT.on) attStop(); return f(...a); };
}
