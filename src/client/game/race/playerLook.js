// EDIT PLAYER: the choices and the saved look, applied to the player's colours.

import { KTHEMES, K_BIKES } from '../art/riders.js';
import { frameCache } from '../gfx/pixel.js';
import { bikeBases, flipBases, footBases } from '../gfx/riderSprites.js';

// EDIT PLAYER: colours to pick from, [main, shade]
export const LOOK_COLS = [['#fcfcfc', '#c4ccd8'], ['#bcbcbc', '#7c7c7c'], ['#3c3c3c', '#1c1c1c'], ['#d82800', '#881400'], ['#e45c10', '#a81000'], ['#f8b800', '#ac7c00'],
  ['#00a800', '#006800'], ['#00a8a8', '#006868'], ['#3cbcfc', '#0078f8'], ['#0058f8', '#0038a8'], ['#0038a8', '#002070'], ['#6844fc', '#4428bc'], ['#f878f8', '#b83cb8'], ['#ac7c00', '#7c4800']];
export const LOOK_SKIN = [['#ffe0bb', '#e3ae79'], ['#f0c090', '#c88850'], ['#d89060', '#a86030'], ['#a86030', '#7c4018'], ['#7c4818', '#542c0c'], ['#fcd8c8', '#e8a890']];
export const LOOK_HEADS = ['helmet', 'short', 'long', 'bald', 'clown', 'skull', 'goggles', 'mx', 'bobby', 'cap', 'brodie', 'prof', 'stache3', 'flag_us', 'prof2'];
const HAIR_HEADS = new Set(['short', 'long', 'bald', 'clown', 'skull', 'prof', 'stache3', 'prof2']);   // these read HAIR COLOR (on the skull it colours the flames)
// [label, key, choices, how the choice is shown]; HELMET COLOR reads HAIR COLOR without a helmet
export const LOOK_ROWS = [['HEAD', 'head', LOOK_HEADS, 'head'], ['HELMET COLOR', 'helmet', LOOK_COLS, 'col'], ['SKIN COLOR', 'skin', LOOK_SKIN, 'col'], ['SHIRT COLOR', 'shirt', LOOK_COLS, 'col'],
  ['PANTS COLOR', 'pants', LOOK_COLS, 'col'], ['BIKE', 'bikeType', K_BIKES.map((_, i) => i), 'bike'], ['BIKE COLOR', 'bike', LOOK_COLS, 'col']];
export const lookLabel = (r) => r[1] === 'helmet' && HAIR_HEADS.has(LOOK_HEADS[look.head]) ? 'HAIR COLOR' : r[0];
export const look = { head: 0, helmet: 0, skin: 0, shirt: 9, pants: 10, bikeType: 0, bike: 3 };
try { const v = JSON.parse(localStorage.getItem('super-bike-player') || 'null'); if (v) for (const [, k, list] of LOOK_ROWS) if (Number.isInteger(v[k]) && v[k] >= 0 && v[k] < list.length) look[k] = v[k]; } catch (e) {}
export function applyLook() {                                                // rebuild the player's colours (and drop any sprites drawn in the old ones)
  const h = LOOK_COLS[look.helmet], k = LOOK_SKIN[look.skin], sh = LOOK_COLS[look.shirt], pa = LOOK_COLS[look.pants], bk = LOOK_COLS[look.bike];
  KTHEMES[0] = { s: sh[0], S: sh[1], p: pa[0], P: pa[1], b: bk[0], B: bk[1], r: bk[0], f: h[0], h: h[1], i: k[0], j: k[1], head: LOOK_HEADS[look.head], bike: look.bikeType };
}
export function lookChanged() {
  applyLook(); bikeBases.clear(); footBases.clear(); flipBases.clear(); frameCache.clear();
  try { localStorage.setItem('super-bike-player', JSON.stringify(look)); } catch (e) {}
}
applyLook();
