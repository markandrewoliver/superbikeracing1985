// Drawing the player's bike and rider: every pose, the secret moves, flames, the hadouken and getting up.

import { ctx } from '../core/canvas.js';
import { BIKE_SX, SC } from '../core/config.js';
import { P } from '../core/palette.js';
import { game, view } from '../core/state.js';
import { clamp, hash, lerp, rnd, wrapPi } from '../core/util.js';
import { drawSplash } from './lighting.js';
import { STEPS, rect, rotFrame, wsx } from './pixel.js';
import { bikeBase, bikeFrame, drawFrame, fireFrom, flipBase, footBase, kExhaust, kLamp, kRear, ragdollBase } from './riderSprites.js';
import { drawProf } from '../modes/tutorial.js';
import { CR, crashPhases } from '../race/crash.js';
import { INTRO_T } from '../race/loop.js';
import { bike, inp, laneYNow } from '../race/session.js';
import { FALL_KIND, HADO_CHARGE, moveLook, rdmBody, rdmNum, rdmStage, scrW } from '../rider/secretMoves.js';
import { slopeAt, terrain } from '../world/terrain.js';

export function drawMarioJump(sx, by, look, theme) {                       // the bike's drawn without him; he's up here on his own, leaning the way he jumped
  const k = stepK(look[4] || 0);
  drawFrame(rotFrame('mario_' + (theme || 0) + '_' + k, bikeBase(1, 7, 0, 0, 2, theme || 0), k), sx + Math.round((look[3] || 0) * SC), by - Math.round(look[2] * SC));
}
// him lying on his back after coming off a Redeemer: the Redeemer drawing itself, turned flat (and mirrored when he
// went over forwards), resting on the road; a is how far it's turned (pi/2 = flat)
function drawRdmLying(sx, gy, a, m, kind) {
  const FK = FALL_KIND[kind || 'rdm'], k = stepK(a), aa = k * 2 * Math.PI / STEPS, c = scrW(FK.com, aa);
  const nf = view.fires.length, ms = m < 0 ? -1 : 1;
  ctx.save(); ctx.translate(Math.round(sx), 0); ctx.scale(ms, 1);
  drawFrame(rotFrame('lie' + FK.mode, bikeBase(FK.lie, FK.mode, 0, 0, 2), k), -c[0], gy - 5 - c[1]);
  ctx.restore();
  for (let i = nf; i < view.fires.length; i++) view.fires[i][0] = Math.round(sx) + ms * view.fires[i][0];   // (a flaming skull's glow goes where he's drawn)
}

/* ---------- bike, effects ---------- */
const stepK = (ang) => ((Math.round(ang / (2 * Math.PI / STEPS)) % STEPS) + STEPS) % STEPS;

export function drawBikeSprite(by, angle, pivotT, body, mode, bob, wf, sx, theme, dz, noRider) {
  if (sx === undefined) sx = BIKE_SX; theme = theme || 0; dz = dz || 0;
  const k = stepK(angle), a = k * 2 * Math.PI / STEPS, px = kRear(theme) * pivotT;     // pivot swings the bike about the rear wheel
  wf = bikeFrame(wf, theme);
  const base = bikeBase(body, mode, bob, wf, !noRider, theme, dz);
  const ox = sx + (px - px * Math.cos(a)), oy = by + px * Math.sin(a);
  drawFrame(rotFrame('b' + body + '_' + mode + '_' + bob + '_' + wf + '_' + theme + '_' + dz + (noRider ? '_n' : ''), base, k), ox, oy);
  const ca = Math.cos(a), sa = Math.sin(a);
  const lamp = kLamp(theme);
  if (lamp) { const [lx, lh] = lamp; view.lamps.push([Math.round(ox) + lx * ca + lh * sa, Math.round(oy) - lx * sa + lh * ca, a]); }   // headlight (a horse has none)
}

// the rider on foot; sx/sy = feet, face < 0 mirrors him to face left
export function drawRunner(sx, sy, frame, face, theme) {
  const b = footBase(frame, theme); sx = Math.round(sx); sy = Math.round(sy);
  if (face >= 0) { ctx.drawImage(b, sx - b.ax, sy - b.ay); fireFrom(b, sx - b.ax, sy - b.ay, 1); return; }
  ctx.save(); ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(b, -b.ax, sy - b.ay); ctx.restore(); fireFrom(b, sx + b.ax, sy - b.ay, -1);
}

// A wrecked bike or rider is drawn turned about its anchor point, and the anchor never goes below the track; but on a hill
// (or lying at an angle) the rest of the picture could still dip into the ground. These raise the picture just enough
// that no part of it does. The outline of each picture is worked out once from its pixels.
function spriteHull(base) {
  if (base.hull) return base.hull;
  const w = base.width, h = base.height, d = base.getContext('2d').getImageData(0, 0, w, h).data, pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 100) for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) pts.push([cx - base.ax, base.ay - cy]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return (base.hull = lo.slice(0, -1).concat(up.slice(0, -1)));
}
function sinkLift(base, k, wx, hPx, lane, flip) {                    // px to raise it: turned by step k, anchor hPx above the lane's ground line at world x
  const a = k * 2 * Math.PI / STEPS, ca = Math.cos(a), sa = Math.sin(a); let m = 0;
  for (const [hx0, hy] of spriteHull(base)) { const hx = flip ? -hx0 : hx0, dx = hx * ca - hy * sa, dy = hx * sa + hy * ca; m = Math.max(m, terrain(lane, wx + dx / SC) * SC - (hPx + dy)); }
  return Math.ceil(m);
}
export function drawUnsunk(id, base, rot, wx, y, ly, lane) { const k = stepK(rot); drawFrame(rotFrame(id, base, k), wsx(wx, view.camX), y - sinkLift(base, k, wx, ly - y, lane)); }
function drawGetUp(c, ly) {
  const q0 = c.bodies[0], q1 = c.bodies[1], pt = game.stateT - c.t0, ph = crashPhases(c), lane = bike.lane;
  const gB = ly - Math.round(terrain(lane, q0.x) * SC);
  const bsx = wsx(q0.x, view.camX);
  const slope = slopeAt(lane, q0.x), toward = (xs, xt) => (xt < xs ? -1 : 1);
  let rx = c.rx0, frame = 'lie', face = toward(c.rx0, c.tx), rot = q0.rot, hop = 0;
  if (pt >= ph.tWalk) {
    const u = clamp((pt - ph.tWalk) / c.dw, 0, 1);
    rx = lerp(c.rx0, c.tx, u); frame = (Math.floor(pt * 9) & 1) ? 'walk1' : 'walk0'; if (u >= 1) { frame = 'stand'; face = 1; }
  }
  if (pt >= CR.lie + CR.sit) frame = pt >= ph.tWalk ? frame : 'stand';
  else if (pt >= CR.lie) frame = 'sit';
  if (pt >= ph.tLift) {                                        // haul the bike upright
    const u = clamp((pt - ph.tLift) / CR.lift, 0, 1), e = 1 - (1 - u) * (1 - u);
    rot = slope + wrapPi(c.rot0 - slope) * (1 - e); rx = c.tx; face = 1; frame = 'lift'; hop = Math.sin(u * Math.PI) * 4;
  }
  let mounted = false;
  if (pt >= ph.tMount) {
    const u = clamp((pt - ph.tMount) / CR.mount, 0, 1);
    rot = slope; rx = lerp(c.tx, q0.x - 3, u); hop = Math.sin(u * Math.PI) * 9; frame = 'jump'; face = 1; mounted = u > 0.6;
  }
  for (const q of [q0]) rect(Math.round(bsx) - 6, gB, 12, 1, P.dirtDD);
  const rsx = wsx(rx, view.camX), gR = ly - Math.round(terrain(lane, rx) * SC);
  if (mounted) { drawBikeSprite(gB, slope, 0, 0, 3, 0, 0); return; }
  const lift = pt >= ph.tLift ? 0 : 0;
  drawUnsunk('bc', bikeBase(0, 0, 0, 0, false), rot, q0.x, gB - hop * (pt >= ph.tLift && pt < ph.tMount ? 1 : 0), ly, lane);
  if (frame === 'lie') {
    const u = clamp(pt / 0.15, 0, 1), flat = Math.round(c.rrot0 / (Math.PI / 2)) * (Math.PI / 2), r2 = Math.abs(Math.sin(flat)) > 0.5 ? flat : (c.rrot0 >= 0 ? Math.PI / 2 : -Math.PI / 2);
    const fd = r2 > 0 ? 1 : -1;                                   // lying flat, head the way he rolled
    if (c.limp) drawRdmLying(rsx, gR, Math.PI / 2, c.lieM || 1, c.hinge && c.hinge.kind);     // (off a Redeemer: still the same drawing of him, flat on his back)
    else if (u < 1) drawUnsunk('rag', ragdollBase(), lerp(c.rrot0, r2, u), rx, gR - 12, ly, lane);
    else drawRunner(rsx, gR - sinkLift(footBase('down', 0), 0, rx, ly - gR, lane, fd < 0), 'down', fd);
    for (let k = 0; k < 3; k++) { const a = pt * 9 + k * 2.1; if (pt > 0.1) rect(Math.round(rsx - 10 * fd + Math.cos(a) * 6), Math.round(gR - 13 + Math.sin(a) * 2), 1, 1, P.turbo); }
  } else drawRunner(rsx, gR - (frame === 'jump' ? hop : 0), frame, face);
}

// bike-flip stunt: the bike rolls over the top of the rider's hands (we see the top of it on the way round) while he
// drops to hang under it. Eased, so it eases out of the ride, whips through the middle and settles upside down.
export function drawInvert(by, angle, p, wf, sx, theme) {
  theme = theme || 0;
  const k = stepK(angle), e = p * p * (3 - 2 * p), i = Math.round(e * 8);
  drawFrame(rotFrame('flip' + i + '_' + theme, flipBase(i, theme), k), sx === undefined ? BIKE_SX : sx, by);
}
// While a HADOUKEN fires the camera holds back, so you see him shoot forward across the screen like an arrow; it
// catches up again once the flame's out. (Normally the bike sits at the same spot on screen and the road moves.)
view.camLag = 0;
export function drawBikeShifted() {
  const L = Math.round((bike.x - view.camX) * SC);
  if (!L || bike.crash) { drawBikeEntity(); return; }
  const n = view.lamps.length, nf = view.fires.length;
  ctx.save(); ctx.translate(L, 0); drawBikeEntity(); ctx.restore();
  for (let k = n; k < view.lamps.length; k++) view.lamps[k][0] += L; for (let k = nf; k < view.fires.length; k++) view.fires[k][0] += L;
}
// HADOUKEN: a blue fireball round the bike that grows while it gathers, then streams out behind as it fires
export function drawHado(sx, by, a, t) {
  const ch = clamp(t / HADO_CHARGE, 0, 1), dash = t >= HADO_CHARGE, cx = sx - Math.sin(a) * 9, cy = by - Math.cos(a) * 9;
  const R = 5 + 11 * ch, dx = Math.cos(a), dy = -Math.sin(a);           // (dx, dy): the way it's pointing, on screen
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.7);
  gr.addColorStop(0, 'rgba(170,225,255,0.85)'); gr.addColorStop(0.45, 'rgba(60,150,255,0.5)'); gr.addColorStop(1, 'rgba(0,60,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(cx - R * 1.7, cy - R * 1.7, R * 3.4, R * 3.4);
  ctx.restore();
  const cols = ['#ffffff', '#a4e4fc', '#3cbcfc', '#0078f8'], fr = Math.floor(game.tNow * 24);
  for (let k = 0; k < 28; k++) {                                     // tongues of flame licking round it
    const an = k / 28 * 2 * Math.PI + game.tNow * 4, r = R * (0.55 + 0.55 * hash(k * 7 + fr * 131));
    let px = cx + Math.cos(an) * r, py = cy + Math.sin(an) * r - hash(k + fr * 17) * 3;
    if (dash) { const back = -(Math.cos(an) * dx + Math.sin(an) * dy); if (back > 0) { px -= dx * back * R * 0.8; py -= dy * back * R * 0.8; } }   // swept back as it flies
    rect(Math.round(px), Math.round(py), 2, 2, cols[(k + fr) % 4]);
  }
  if (dash) for (let i = 1; i <= 8; i++) {                            // and a trail behind
    const px = cx - dx * (R + i * 4), py = cy - dy * (R + i * 4), s = Math.max(1, 4 - (i >> 1));
    rect(Math.round(px + rnd(-1, 1)), Math.round(py + rnd(-1, 1)), s, s, cols[1 + (i & 1) + ((fr + i) & 1)]);
  }
  view.fires.push([cx, cy, '#3cbcfc']);                                   // (it lights things up after dark)
}
function drawFlame(by, angle, pivotT, size) {
  const k = stepK(angle), a = k * 2 * Math.PI / STEPS, px = kRear(0) * pivotT;
  const ox = BIKE_SX + (px - px * Math.cos(a)), oy = by + px * Math.sin(a), ca = Math.cos(a), sa = Math.sin(a);
  const at = (lx, ly) => [ox + lx * ca + ly * sa, oy - lx * sa + ly * ca];   // bike space -> screen
  const len = 4 + size * 9, fl = (Math.floor(game.tNow * 24) & 1);
  for (let d = 0; d < len; d += 2) {                                 // blobs trail back from the exhaust, hot near the pipe
    const u = d / len, r = Math.max(1, Math.round((1 - u) * (1.5 + size * 1.2))) + (fl && u < 0.5 ? 1 : 0);
    const [x, y] = at(kExhaust(0)[0] - d, kExhaust(0)[1] + (hash(Math.floor(game.tNow * 30) + d) - 0.5) * 2 * u * (1 + size));
    rect(Math.round(x - r / 2), Math.round(y - r / 2), r, r, u < 0.2 ? P.white : u < 0.45 ? P.turbo : u < 0.75 ? P.orange : P.flag);
  }
}
function drawBikeEntity() {
  const b = bike, ly = Math.round(laneYNow());
  if (game.state === 'intro') {                                                    // riding up to the line
    const sx = Math.round(wsx(b.x, view.camX)), gy = ly - Math.round(terrain(b.lane, b.x) * SC), u = game.stateT / INTRO_T;
    rect(sx - 10, gy, 20, 2, P.dirtDD);
    drawBikeSprite(gy, slopeAt(b.lane, b.x), 0, u > 0.7 ? -1 : 0, 0, b.v > 60 ? Math.floor(b.spin / 4.4) & 1 : 0, Math.floor(b.spin / 2.2), sx);   // sits back as he brakes
    return;
  }
  if (b.crash) {
    const c = b.crash;
    if (c.splash) { drawSplash(BIKE_SX + (b.x - view.camX) * SC, ly, c.t); return; }
    for (const q of c.bodies) rect(Math.round(wsx(q.x, view.camX)) - 6, ly - Math.round(terrain(b.lane, q.x) * SC), 12, 1, P.dirtDD);
    const q0 = c.bodies[0], q1 = c.bodies[1];
    if (c.slip > 0) { drawBikeSprite(ly - Math.round(q0.h * SC), q0.rot, 1, -2, 0, 0, Math.floor(b.spin / 2.2), Math.round(wsx(q0.x, view.camX))); return; }
    if (c.hinge && c.t0 === undefined) {                             // off a Redeemer: the bike, and him on his hinge, dropping, or lying there
      const H = c.hinge;
      drawUnsunk('bc', bikeBase(0, 0, 0, 0, false), q0.rot, q0.x, ly - q0.h * SC, ly, b.lane);
      if (!H.landed && H.cx !== undefined) { const a = stepK(H.pa) * 2 * Math.PI / STEPS, FK = FALL_KIND[H.kind], cr = scrW(FK.piv, a); drawFrame(rotFrame('fall' + FK.mode, bikeBase(FK.pose, FK.mode, 0, 0, 2), stepK(H.pa)), wsx(H.cx, view.camX) - cr[0], ly - H.ch * SC - cr[1]); }
      else if (H.landed) drawRdmLying(wsx(q1.x, view.camX), ly - Math.round(q1.h * SC), Math.abs(H.la), c.lieM, H.kind);
      return;
    }
    if (c.t0 === undefined) {
      drawUnsunk('bc', bikeBase(0, 0, 0, 0, false), q0.rot, q0.x, ly - q0.h * SC, ly, b.lane);
      if (c.rdmFall && !c.rdmDown && q1.h > terrain(b.lane, q1.x) + 1) drawFrame(rotFrame('rdmr', bikeBase(4, 5, 0, 0, 2), stepK(q1.rot)), wsx(q1.x, view.camX), ly - q1.h * SC);   // still in his Redeemer till he hits the ground
      else { c.rdmDown = true; drawUnsunk('rag', ragdollBase(), q1.rot, q1.x, ly - q1.h * SC - 15 + 3 * Math.abs(Math.sin(q1.rot)), ly, b.lane); }   // lying flat sits on the road, not floating
      return;
    }
    drawGetUp(c, ly);
    return;
  }
  if (b.loop) {                                                               // round the loop: drawn where the ring puts you
    const dx = Math.round(b.loopDX * SC), n = view.lamps.length, nf = view.fires.length, by = ly - Math.round(b.hv * SC);
    ctx.save(); ctx.translate(dx, 0);
    drawBikeSprite(by, b.angle, 0, b.rdm && rdmStage(b.rdm.p) ? rdmBody(rdmNum(b)) : b.turbo > 0 ? 3 : 0, b.rdm && rdmStage(b.rdm.p) ? 5 : 0, Math.floor(b.spin / 4.4) & 1, Math.floor(b.spin / 2.2));
    ctx.restore(); for (let k = n; k < view.lamps.length; k++) view.lamps[k][0] += dx; for (let k = nf; k < view.fires.length; k++) view.fires[k][0] += dx;
    return;
  }
  const gy = ly - Math.round(terrain(b.lane, b.x) * SC), by = ly - Math.round(b.hv * SC);
  const air = clamp((gy - by) / 24, 0, 1), sw = Math.round(20 - air * 10);
  rect(BIKE_SX - (sw >> 1), gy, sw, 2, P.dirtDD);                             // shadow shrinks as you climb
  let body = 0, mode = 0, bob = 0;
  if (b.grounded) {
    const r = b.rel;
    if (b.landT > 0) mode = 3;
    if (r > 0.42 || (inp.back && r > 0.25)) body = -2; else if (r > 0.1 || (b.lean < -0.5 && r > 0)) body = -1;
    else if (r < -0.25) body = 2; else if (r < -0.07 || b.lean > 0.5) body = 1;
    if (b.turbo > 0 && body >= 0) body = 3;                                   // duck down behind the bars when the turbo kicks (3: as 2 on a bike, but a drawn ride tucks rather than brakes)
    if (b.v > 60) bob = Math.floor(b.spin / (b.wasMud ? 2.2 : 4.4)) & 1;
  } else {
    mode = b.vy > 0 ? 1 : 2; body = inp.back ? -1 : inp.fwd ? 1 : 0;
    if (b.turbo > 0 && !inp.back && !inp.fwd) body = 1;
    if (b.trick === 'superman' && b.trickP > 0) { mode = 4; body = Math.max(1, Math.ceil(b.trickP * 3 - 0.01)); }
    if (b.trick === 'invert' && b.trickP > 0) { drawInvert(by, b.angle, b.trickP, Math.floor(b.spin / 2.2)); return; }
  }
  if (b.rdm && rdmStage(b.rdm.p)) { mode = 5; body = rdmBody(rdmNum(b)); }   // REDEEMER (or on the way up or down)
  const look = game.state === 'replay' ? b.mvRec : moveLook(b);              // HEADSTAND / SUPER MARIO
  if (look) { mode = look[0]; body = look[1]; }
  // exhaust flame while a boost is coming in: small for a wheelie boost, bigger with every stacked trick/turbo boost
  const live = game.state === 'play' || game.state === 'replay';
  const wheelieBoost = live && b.grounded && b.manualT > 0 && b.rel > 0.15 && b.wBoost < 130;
  const flame = (wheelieBoost ? 0.6 : 0) + (live ? (b.tb || 0) / 140 : 0);
  if (flame > 0.05) drawFlame(by, b.angle, b.pivotT, Math.min(flame, 3.5));
  // danger zone (the tilt gauge's yellow-to-red, just short of going over backwards): the front wheel shimmies and a hand flails
  const dz = (game.state === 'play' || game.state === 'replay') && b.grounded && !b.loop && b.rel > 0 && b.rel > (b.thr || 0.66) * 0.8 ? 1 + (Math.floor(game.tNow * 12) & 1) : 0;
  drawProf();
  drawBikeSprite(by, b.angle, b.pivotT, body, mode, bob, Math.floor(b.spin / 2.2), undefined, 0, dz, (look && look[0] === 7) || (game.tut && game.tut.stage === 'intro'));
  if (look && look[0] === 7) drawMarioJump(BIKE_SX, by, look, 0);
  if (b.hado) drawHado(BIKE_SX, by, b.angle, b.hado.t);
}
