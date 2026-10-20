// The fixed-step tick: the intro ride-in, then whichever state the game is in.

import { sfx } from '../audio/sound.js';
import { LANE_SY, PX_M, SC } from '../core/config.js';
import { game, race, view } from '../core/state.js';
import { clamp } from '../core/util.js';
import { ed, tickBuilder } from '../modes/builder.js';
import { snapBike, tickReplay } from '../modes/replay.js';
import { mapTilt, tutTick } from '../modes/tutorial.js';
import { tickCrash } from './crash.js';
import { tickFinish } from './finish.js';
import { tickPlay } from './play.js';
import { tickRivals } from './rivals.js';
import { bike, camAim, ensureWorld, fx, laneYNow } from './session.js';
import { startPodium } from '../ui/podium.js';
import { laneBase, terrain } from '../world/terrain.js';
import { traffic, trafficTick } from '../world/traffic.js';

// Before the countdown the rivals wait on the line and the player rides in from off the left of the screen,
// easing off the throttle to pull up beside them (so you can see which one is you).
export const INTRO_T = 1.8, INTRO_D = 260;
export function tickIntro(dt) {
  const b = bike, u = clamp(game.stateT / INTRO_T, 0, 1), e = 1 - Math.pow(1 - u, 3);
  b.x = race.startX - INTRO_D * (1 - e); b.v = 3 * INTRO_D * (1 - u) * (1 - u) / INTRO_T;
  b.h = b.hv = terrain(b.lane, b.x); b.spin += b.v * dt / 7;
  if (u >= 1) { b.x = race.startX; b.v = 0; b.h = b.hv = terrain(b.lane, b.x); game.state = 'count'; game.stateT = 0; }
}
export function tick(dt) {
  mapTilt();                                                         // the buttons switch roles as you take off and land
  if (game.tut && game.tut.slow) dt *= 0.25;                                   // how to play: slow motion for the landing
  game.stateT += dt;
  if (game.state === 'title' || game.state === 'slots' || game.state === 'raceset' || game.state === 'player') view.titleScroll += 70 * dt;
  else if (game.state === 'build' || game.state === 'buildset') tickBuilder(dt);
  else if (game.state === 'intro') tickIntro(dt);
  else if (game.state === 'count') { if (game.stateT > 2.4) { game.state = 'play'; game.stateT = 0; sfx('turbo'); } }
  else if (game.state === 'play') { if (!(game.tut && game.tut.stage === 'intro')) tickPlay(dt); if (game.state === 'play') view.camX = bike.x - view.camLag; ensureWorld(); }   // (parked through the professor's intro)
  else if (game.state === 'crash') { tickCrash(dt); ensureWorld(); }   // (the track keeps being laid ahead of the wreck, so nothing pops in when he gets back on)
  else if (game.state === 'finish') { tickFinish(dt); if (game.mode !== 'stunt' && !race.podium && game.stateT >= 2) startPodium(); }
  if (game.state === 'play' || game.state === 'crash' || game.state === 'finish') { race.raceT += dt; if (traffic.length) trafficTick(dt); tickRivals(dt); }
  if (game.runRec && !game.runRec.closed && (game.state === 'play' || game.state === 'crash' || game.state === 'finish') && (game.runRec.n++ & 1) === 0) game.runRec.samples.push(snapBike());
  if (game.runRec && game.state === 'finish' && (game.mode === 'stunt' || game.stateT > 4)) game.runRec.closed = true;   // a stunt run ends at the line; a race keeps rolling a few seconds
  if (game.state === 'replay') tickReplay(dt);
  if (game.tut) tutTick(dt);
  // the camera rises with the rider (or the editing cursor) instead of letting them leave the top of the screen
  let fy = null;
  if (game.state === 'play' || game.state === 'count' || game.state === 'intro' || game.state === 'finish') fy = laneYNow() - bike.hv * SC;
  else if (game.state === 'crash' && bike.crash) fy = laneYNow() - Math.max(terrain(bike.lane, view.camX), bike.crash.bodies[0].h) * SC;   // up and down with the bike, like left and right
  else if (game.state === 'build') fy = LANE_SY[ed.lane] - laneBase(ed.lane, race.startX + ed.curM * PX_M) * SC;
  else if (game.state === 'replay') fy = laneYNow() - (bike.crash ? Math.max(terrain(bike.lane, view.camX), bike.crash.bodies[0].h) : bike.hv) * SC;
  view.camLift += (camAim(fy) - view.camLift) * Math.min(1, dt * 5);

  fx.shake = Math.max(0, fx.shake - 20 * dt);
  for (let i = fx.popups.length - 1; i >= 0; i--) { const p = fx.popups[i]; p.t += dt; if (p.t > p.life) fx.popups.splice(i, 1); }
  for (let i = fx.parts.length - 1; i >= 0; i--) {
    const p = fx.parts[i]; p.t += dt; p.x += p.vx * dt; p.h += p.vy * dt; p.vy -= 200 * dt; if (p.h < 0) { p.h = 0; p.vy = 0; }
    if (p.t > p.life) fx.parts.splice(i, 1);
  }
}
