// The game's painted art: PNG files under ../assets, each named by where it sits in the art tables
// (`png('bg-art/scenery-nature1-0')` is BG_ART.scenery.nature1[0]). They were data: URIs inside the
// single-file original; as files they are cached, and reviewers can see them.
const urls = import.meta.glob('../assets/**/*.png', { eager: true, query: '?url', import: 'default' });

export function png(name) {
  const url = urls[`../assets/${name}.png`];
  if (!url) throw new Error(`no art called ${name}`);
  return url;
}

// Every picture the game draws is loaded through here, so the first frame can wait for them (a data: URI decoded
// almost at once; a file arrives over the network): all of them, or just the ones a first scene needs.
const pending = [], arrived = new WeakMap();
// priority: 'high' for what the first frame needs; everything else asks for 'low', so it queues behind.
export function loadImg(u, priority = 'low') {
  if (typeof Image === 'undefined') return {};
  const i = new Image(), p = new Promise((done) => { i.onload = i.onerror = done; });
  pending.push(p); arrived.set(i, p);
  i.fetchPriority = priority;
  i.src = u;
  return i;
}
export const assetsReady = () => Promise.all(pending);
export const imgsReady = (imgs) => Promise.all(imgs.map((i) => arrived.get(i)));
