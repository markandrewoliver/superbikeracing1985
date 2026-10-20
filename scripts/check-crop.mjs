/**
 * Does anything a reader looks at fall off the post?
 *
 * Reddit serves a custom post at a size we do not choose. Its own docs give the
 * numbers (Custom Post Styles → `height`): **`TALL` = 512px, `REGULAR` = 320px,
 * and the width varies from ~288 to ~880 depending on device and viewport.**
 * `devvit.json` declares `"height": "tall"`, so 512 is our height and the width
 * is the axis that moves — from 288 to 880, a factor of three.
 *
 * Things that broke at 288 wide in a previous game, invisible at every size a
 * person happens to have a window open at:
 *
 *   - a Menu button 35px past the right edge, unpressable, because the top
 *     nav's items were all `flex: 0 0 auto` and the row overflowed;
 *   - the top of an avatar cut off on a rotated banner, worse the WIDER the
 *     frame, because the ends of a leaning plate rise with its width.
 *
 * So this runs the corners.
 *
 * It asserts one thing: no text and no image leaves the frame. Boxes are left
 * alone deliberately — decoration may be built to run off the edge; what must
 * not is something with words or a face in it.
 *
 * And **nothing a player can reach may scroll** (Reddit's review rejects inline
 * scroll traps). A scrolling ancestor is a failure in its own right;
 * `.paged__view` (components/Paged.tsx) is the only sanctioned way to put
 * something out of frame.
 *
 * Needs `npm run preview` running. Uses `CHROMIUM_PATH` when set.
 */
import { chromium } from "@playwright/test";

/** Reddit's own numbers. The height we declare, and the width range it serves. */
const HEIGHT_TALL = 512;
const HEIGHT_REGULAR = 320;
const WIDTH_MIN = 288;
const WIDTH_MAX = 880;

/** The corners, plus the two frames the rest of the project already used, so a
 *  regression at a familiar size still shows up here. */
const FRAMES = [
  [WIDTH_MIN, HEIGHT_TALL],
  [WIDTH_MAX, HEIGHT_TALL],
  [390, 510],
  [705, HEIGHT_TALL],
];

/**
 * Every post kind and every screen inside one that draws by itself — as
 * preview.tsx routes. **A screen not in this list is simply not checked**, so
 * add a route here in the same change that adds the screen.
 */
const ROUTES = ["#app", "#app?guest"];

/** A couple of pixels of rounding is not a crop. */
const SLACK = 2;

const BASE = process.env.PREVIEW_URL || "http://localhost:5173";

function detect() {
  const out = [];
  document.querySelectorAll(".crt-screen *").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return;
    const tag = el.tagName.toLowerCase();
    const isPicture = tag === "img" || tag === "svg";
    const isType = !el.children.length && el.textContent && el.textContent.trim();
    if (!isPicture && !isType) return;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return;
    const over = {
      top: -r.top, bottom: r.bottom - innerHeight,
      left: -r.left, right: r.right - innerWidth,
    };
    const sides = Object.entries(over).filter(([, v]) => v > 2);
    if (!sides.length) return;

    /* **Off the frame is not the same as out of reach**, and only one of them
       is a bug. The Menu had no way to it at all — painted past the edge of a
       post, so it could not be pressed. Something inside a pager is one button
       away.

       **Reachable now means paged, never scrolled.** It used to mean a
       scrollable ancestor, which is the inline scroll trap Reddit's review
       rejected this app for and which this codebase had already ruled against
       on its own terms. So a scrollable ancestor is no longer an excuse — it is
       reported as a failure in its own right, because nothing a player can
       reach should scroll at all. */
    let reachable = false;
    let scroller = "";
    for (let a = el.parentElement; a; a = a.parentElement) {
      const acs = getComputedStyle(a);
      const scrolls =
        /auto|scroll/.test(acs.overflowY + acs.overflowX) &&
        (a.scrollHeight > a.clientHeight + 2 || a.scrollWidth > a.clientWidth + 2);
      /* **Checked before the pager, not after.** The first cut tested for
         `.paged__view` and broke out of the loop, so turning that very element
         into a scroller still read as "reachable" — the one mutation this gate
         exists to catch was the one it could not see. Any scrolling ancestor is
         a failure, `.paged__view` included. */
      if (scrolls) {
        scroller = (a.className || a.tagName).toString().trim().split(/\s+/)[0];
        break;
      }
      if (a.classList?.contains("paged__view")) {
        reachable = true;
        break;
      }
    }
    const label = ((el.className || tag).toString().split(" ")[0] || tag).slice(0, 26) +
      " " + sides.map(([k, v]) => `${k}+${Math.round(v)}px`).join(" ");
    /* A scrolling ancestor is its own failure, whatever else is true of this
       element: nothing a player can reach may scroll. */
    if (scroller) out.push({ what: `${label} — inside a SCROLLING .${scroller}`, reachable: false });
    else out.push({ what: label, reachable });
  });
  const seen = new Set();
  return out.filter((x) => !seen.has(x.what) && seen.add(x.what));
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
let bad = 0;
let checked = 0;
const notes = [];

for (const route of ROUTES) {
  const hits = [];
  for (const [w, h] of FRAMES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    try {
      await page.goto(BASE + "/preview.html?nopanel=1" + route);
      await page.waitForTimeout(2400);
      const found = await page.evaluate(detect);
      checked++;
      const cut = found.filter((f) => !f.reachable);
      const tight = found.filter((f) => f.reachable);
      if (cut.length) hits.push(`    ${w}x${h}  ` + cut.slice(0, 4).map((f) => f.what).join("\n              "));
      for (const t of tight) notes.push(`    ${route} at ${w}x${h}: ${t.what} (one press away)`);
    } catch (err) {
      hits.push(`    ${w}x${h}  could not be opened: ${String(err).slice(0, 80)}`);
    }
    await page.close();
  }
  if (hits.length) {
    bad += hits.length;
    console.log(`\n  ${route}`);
    for (const line of hits) console.log(line);
  }
}
await browser.close();

console.log(
  `\n  ${checked} frames checked across ${ROUTES.length} routes ` +
    `(${WIDTH_MIN}-${WIDTH_MAX} wide, TALL ${HEIGHT_TALL} / REGULAR ${HEIGHT_REGULAR}).`,
);
if (notes.length) {
  console.log("\n  Below the fold but reachable by paging — worth knowing, not a failure:");
  for (const n of [...new Set(notes)]) console.log(n);
}
if (bad) {
  console.log(`\n  ${bad} frame(s) put something a reader reads out of reach. ✗\n`);
  process.exit(1);
}
console.log("\n  Nothing a reader reads is out of reach. ✓\n");
