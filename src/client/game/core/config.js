// Fixed numbers: the pixel grid, lanes, world scale, physics step and speeds, and the air stunt timings.

/* ---------- basics ---------- */
export const W = 240, H = 150;                // internal pixel grid; CSS scales it up crisp
export const LANES = 4;
export const SC = 0.5;                        // screen px per world px
export const LANE_SY = [70, 88, 106, 124];    // wheel line of each lane on screen, back (0) to front (3)
export const BIKE_SX = 56;                    // fixed screen x of the bike
export const PX_M = 8;                        // world px per metre
export const G = 230;                         // gravity, px/s^2
export const STEP = 1 / 120;                  // fixed physics step
export const CRUISE0 = 250;                   // default speed in px/s (about 100 kph); this used to be turbo speed
export const VMAX = 1500;                     // hard cap once turbos stack

// Air stunts. Hold UP: superman (legs kicked out behind). Hold DOWN: flip the bike upside down.
// The longer you hold the full pose, the bigger the boost, but you only get it if you're back on and land clean.
export const STUNTS = {
  superman: { tin: 0.3, tout: 0.35, rate: 130, name: 'SUPERMAN' },
  invert:   { tin: 0.5, tout: 0.6,  rate: 200, name: 'BIKE FLIP' }
};
