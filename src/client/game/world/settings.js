// What a random track can be: times of day, settings, road surfaces, features and lengths.

/* ---------- track settings, rolled for each random track ---------- */
export const TODS = ['morning', 'day', 'evening', 'night'];
export const BGS = {
  city:   { surf: ['asphalt'], crowd: false, name: 'CITY' },
  grass:  { surf: ['dirt', 'asphalt'], name: 'GRASSLAND' },
  dirt:   { surf: ['dirt', 'asphalt'], name: 'BADLANDS' },
  desert: { surf: ['dirt'], name: 'DESERT' },
  arctic: { surf: ['ice'], name: 'ARCTIC' },
  beach:  { surf: ['dirt'], name: 'BEACH' }                        // (always a dirt road)
};
// asphalt rides like the original; dirt is slower and twitchier; ice is faster and twitchier still
export const SURF = {
  dirt:    { speed: 0.75, pull: 1.3, bump: 1.35, name: 'DIRT', slick: 'MUD!' },
  asphalt: { speed: 1.0,  pull: 1.0, bump: 0,    name: 'ASPHALT', slick: 'OIL!' },
  ice:     { speed: 1.25, pull: 1.5, bump: 0.75, name: 'ICE', slick: 'SLUSH!' }
};
// FEATURES: what a random track is built around. RANDOM picks one of the others for you.
export const FEATS = ['random', 'normal', 'mountains', 'rivers', 'ramps', 'downhill', 'street', 'stunt'];   // STUNT is its own mode (no rivals), so RANDOM leaves it out
export const FEAT_NAME = { random: 'RANDOM', normal: 'NORMAL', mountains: 'MOUNTAINS', rivers: 'RIVERS', ramps: 'RAMP COURSE', downhill: 'DOWNHILL', street: 'STREET RACE', stunt: 'STUNT' };
export const LENS = ['short', 'medium', 'long'], LEN_NAME = { short: 'SHORT', medium: 'MEDIUM', long: 'LONG' }, LEN_MULT = { short: 1, medium: 2, long: 3 };
