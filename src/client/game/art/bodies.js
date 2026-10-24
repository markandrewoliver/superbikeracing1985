// BODIES (Super Bike Workshop, section 8): what a rider wears, as a shape and its fixed-colour details. Colours still
// come from SHIRT, PANTS (and HELMET) COLOR; a body adds the shape. Each is defined once and shows in all three views:
// on the bike (gfx/riderSprites.js → BODY_PAINT), facing us on the podium (FRONT_BODY) and off the bike (BODY_DETAIL).
//   rider    the original one-piece suit
//   prof     "Suit and tie": the professor's outfit. Coat in SHIRT COLOR, light-blue collar (a), red tie (l) up to the
//            neck, long sleeves, coat tails
//   leather  "Leather jacket": jacket in SHIRT COLOR, white T-shirt at the neck (c), silver zip (g), turned-up collar,
//            long sleeves, short tails

// Facing us: the 9 x 6 torso, and whether the sleeves run down to the hands.
export const FRONT_BODY = {
  rider:   { rows: ['.ssSSSss.', '.sssssss.', '.SsssssS.', '.sssssss.', '.sSSSSSs.', '.PpPpPpP.'], sleeve: false },
  prof:    { rows: ['.sSalaSs.', '.sSalaSs.', '.SsSlSsS.', '.ssSlSss.', '.sSSSSSs.', '.PpPpPpP.'], sleeve: true },
  leather: { rows: ['.sScccSs.', '.sScccSs.', '.SsSgSsS.', '.sssgsss.', '.sSSgSSs.', '.PpPpPpP.'], sleeve: true }
};
// Off the bike: the body part of a K_PEOPLE pose is the same for every head (only where it sits changes), so one set of
// pixels per pose, placed against the helmet's body rows, dresses every head. [x, y, letter], y from the top body row.
export const BODY_DETAIL = {
  prof: {                                                            // collar (light-blue shirt), red tie, coat tails over the hips
    stand: [[3, 0, 'a'], [4, 0, 'l'], [5, 0, 'a'], [4, 1, 'l'], [4, 2, 'l'], [4, 3, 'l'], [3, 1, 'S'], [5, 1, 'S'], [2, 5, 's'], [6, 5, 's']],
    walk0: [[3, 0, 'a'], [4, 0, 'l'], [4, 1, 'l'], [4, 2, 'l'], [1, 5, 's'], [1, 6, 'S']],
    walk1: [[6, 0, 'a'], [7, 0, 'l'], [7, 1, 'l'], [7, 2, 'l'], [4, 5, 's'], [3, 6, 'S'], [4, 6, 's']],
    sit:   [[3, 0, 'a'], [4, 0, 'l'], [4, 1, 'l'], [4, 2, 'l']],
    lift:  [[6, 0, 'a'], [7, 0, 'l'], [7, 1, 'l'], [7, 2, 'l'], [4, 5, 's'], [3, 6, 'S'], [4, 6, 's']],
    jump:  [[6, 0, 'a'], [7, 0, 'l'], [7, 1, 'l'], [7, 2, 'l'], [4, 5, 's'], [4, 6, 'S']],
    rag:   [[6, 0, 'a'], [7, 0, 'l'], [7, 1, 'l'], [7, 2, 'l'], [4, 5, 's'], [4, 6, 'S']]
  },
  leather: {                                                         // white T-shirt at the neck, silver zip down the front
    stand: [[4, 0, 'c'], [4, 1, 'c'], [4, 2, 'g'], [4, 3, 'g'], [4, 4, 'g']],
    walk0: [[4, 0, 'c'], [4, 1, 'c'], [4, 2, 'g'], [4, 3, 'g']],
    walk1: [[7, 0, 'c'], [7, 1, 'c'], [7, 2, 'g'], [7, 3, 'g']],
    sit:   [[4, 0, 'c'], [4, 1, 'c'], [4, 2, 'g']],
    lift:  [[7, 0, 'c'], [7, 1, 'c'], [7, 2, 'g'], [7, 3, 'g']],
    jump:  [[7, 0, 'c'], [7, 1, 'c'], [7, 2, 'g'], [7, 3, 'g']],
    rag:   [[7, 0, 'c'], [7, 1, 'c'], [7, 2, 'g'], [7, 3, 'g']]
  }
};
