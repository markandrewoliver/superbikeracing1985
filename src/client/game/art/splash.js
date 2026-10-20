// The title picture's layers.

import { png } from './assets.js';

// The title art: the sunset-and-city picture, the rider, and each word of the title as their own transparent layers (480x620,
// four pixels to each pixel of the 120x155 picture), so the title screen can build itself up: the picture is drawn in line by line,
// the rider flies in, then BIKE RACING, Super and 1985.
export const SPLASH_ART = {
  bg: png('splash-art/bg'),
  rider: png('splash-art/rider'),
  bike: png('splash-art/bike'),
  super: png('splash-art/super'),
  n1985: png('splash-art/n1985')
};
