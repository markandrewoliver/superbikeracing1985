// The CRT glass on the game page: the same four layers the React app lays over a post (components/CrtScreen.tsx,
// styles/20-crt.css), confined to the handheld's screen so the bezel stays plastic. Nothing filters or blends.
// (The inline splash gets the app's own glass over the whole post: App.tsx.)

import { CRT_LAYERS, startCrtRoll } from '../../lib/crtGlass';

export function mountCrt(screen) {
  const glass = document.createElement('div');
  glass.className = 'crt crt--screen'; glass.setAttribute('aria-hidden', 'true');
  for (const k of CRT_LAYERS) { const s = document.createElement('span'); s.className = 'crt__' + k; glass.append(s); }
  screen.append(glass);
  startCrtRoll(glass.querySelector('.crt__roll'));
}
