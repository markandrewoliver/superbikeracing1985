// Where the game is running, decided once at load:
//   splash   the inline post: the intro video only, sized to the post, no controls and no input at all
//            (RaceSplash.tsx sets data-host="splash" before it loads the game)
//   desktop  the expanded post on a computer: the screen fills the window inside the bezel; keyboard, no D-pad
//   handheld the expanded post on a phone: the handheld, with its D-pad
// game.css reads the same answer off <html data-host>.

import { isMobile } from '../../lib/devvit';

export const HOST = document.documentElement.dataset.host || (isMobile() ? 'handheld' : 'desktop');
document.documentElement.dataset.host = HOST;
