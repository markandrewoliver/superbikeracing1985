# 3. The CRT filter

The whole app is seen through a CRT tube. It is built to survive a feed full of
posts on old phones, which is a harder constraint than it looks.

Files: `src/client/components/CrtScreen.tsx`, `src/client/styles/20-crt.css`.
Tune live with the **+ CRT** panel in `npm run preview`.

## How it is mounted

```tsx
// App.tsx — once, outside the routing, so no screen can forget it
<>
  <div className="crt-screen">{route(kind)}</div>
  <CrtScreen />
</>
```

- `.crt-screen` wraps the routed screen and carries the **type** effects
  (glow and chromatic bleed) as an inherited `text-shadow`.
- `<CrtScreen />` draws four `position: fixed` layers over everything at
  `z-index: 9000`: **bloom** (an inset box-shadow, the lit rim), **scanlines**
  (a 2px gradient), **vignette** (one radial gradient), **roll** (a band of
  stronger scanlines drifting down every ~10s ± 30%).
- `.crt` itself is `display: contents` — no box, no stacking context.

## The one rule

**Nothing filters. Nothing blends. Nothing reads back.**

The first version stacked full-viewport `mix-blend-mode` layers, a
`backdrop-filter: blur()` bloom, an animated `feTurbulence` grain and an SVG
`filter: url()` over the app — once per post, on a feed showing several. It:

- killed **Firefox's GPU process** on desktop (relaunching 21 times in one
  session before taking the browser down),
- crashed **Firefox for Android** outright,
- gave **"A problem repeatedly occurred"** on older iPads (Safari).

From outside it looked like "the game will not take a click" — a dead content
frame. It was chased as an input bug for most of a day before anybody read the
browser's crash reports, which named the webview URL outright. **When a browser
dies, read its crash reports before forming a theory.**

Mozilla's tracker explains it: `mix-blend-mode` blends on the CPU in Firefox
(bug 1008128), blending and filters interact badly (1083241), `filter: url()`
on a huge element is 1520682's shape, `feTurbulence` is expensive (422371). None
of it reproduced in a desktop preview, at the real webview URL, or with ten
embedded copies.

What survived costs a composite and nothing else:

| Stage | Built as | Cost |
|---|---|---|
| bloom | inset `box-shadow` on one fixed span | painted once |
| scanlines | `linear-gradient`, black at low alpha, normal compositing | painted once |
| vignette | one `radial-gradient` | painted once |
| roll | `transform` + `opacity` on one span, band is a `mask` | composited |
| glow | `text-shadow` in `currentColor`, three capped stops | rasterised with the glyph |
| bleed | two offset `text-shadow`s, red and blue | rasterised with the glyph |

**Deliberately absent**: the aperture grille and animated noise (the crashers;
the picture was looked at without them and kept), and **curve** — barrel
distortion moves the picture without moving the hit targets, so a button stops
being where it looks.

## The type-shadow token

`text-shadow` is inherited, which is how one declaration lights the whole app.
But:

- an element that declares its **own** shadow **replaces** it;
- **form controls never inherit it** (the UA reset beats inheritance) — so every
  `<button>` was unlit while the row around it glowed.

So the shadow is a token, `--crt-type-shadow`, and:

```css
.crt-screen { text-shadow: var(--crt-type-shadow); }
.crt-screen :is(button, input, select, textarea, optgroup) { text-shadow: inherit; }

/* anything with a shadow of its own appends the token */
.title { text-shadow: 0 2px 0 #000, var(--crt-type-shadow); }

/* a surface that is not "on the tube" (paper, a photo) opts out by name */
.crt-screen .no-crt { text-shadow: none; --crt-type-shadow: 0 0 0 transparent; }
```

`0 0 0 transparent`, **not `none`**: `none` is illegal inside a shadow list, so
every composed declaration under it would be invalidated.

**Every glow radius is capped with `min()`.** Anything that surges `--crt-glow`
(e.g. a turn running out) would otherwise grow the widest stop quadratically on
every glyph, every frame. A new stop needs a cap in the same change.

The bleed fringes **text only**. Do not add a `box-shadow` fringe to boxes to
match: `box-shadow` is usually already carrying a selection ring, and the
fringe would have to be repeated into every rule that sets it.

## Dials

All on `:root`, all 0–100-ish, each multiplied by a per-stage factor:

| Dial | Default | Meaning |
|---|---|---|
| `--crt-vignette` | 5 | x 0.02 = alpha at the corners |
| `--crt-scanlines` | 12 | x 0.009 = alpha at each band's peak (the one that costs legibility — keep low) |
| `--crt-roll` | 16.8 | x 0.009 = what the roll bar adds |
| `--crt-glow` | 10 | bloom rim and type glow |
| `--crt-bleed` | 101 | x 0.022px = chromatic offset |
| `--crt-bleed-a` | 0.05 | chromatic strength (a wide split laid down faint reads as aberration) |
| `--crt-roll-band` | 7 | band height, % of screen |
| `--crt-roll-time` | 5.1 | seconds per sweep |
| `--crt-roll-pause` | 10 | seconds between sweeps (read by JS) |

A still screenshot lies about these: the app is read for minutes, and what looks
like character on a still becomes texture over the type. Tune by playing.

## Effects

`crtSurge({ vignette, glow, shake })` turns the tube up (timer running out, big
hit) and returns a restore function. **Every path that ends the effect must call
it** (unmount, screen change), or the tube stays turned up app-wide. The shake
is on `.crt-screen` with `steps()` (a CRT snaps, it does not glide), scaled
1.006 so the edges never uncover the ground, with `overflow: clip` on the root
while it runs (see layout doc). If it needs to outlive the component that
started it (a wind-down after a turn ends), drive it from its own rAF loop.

`prefers-reduced-motion`: the roll and the shake stop; the glass stays.

## Rules for changing it

1. A new layer is qualified with the element: `.crt > span.crt__x`. A bare
   `.crt__x { display: none }` is (0,1,0) and loses to `.crt > span` (0,1,1) —
   and an invisible full-viewport layer is still one the compositor carries.
   Check `getComputedStyle(el).display`, not a screenshot.
2. Never lift a screen above the glass with a four-digit z-index. To exempt a
   region, **mask the glass** (two `mask-image` gradients, which composite as a
   union by default).
3. Never put a `filter` or `transform` on `.crt-screen` at rest: it becomes the
   containing block for every `position: fixed` descendant and traps every
   overlay.
4. Anything that would blend, filter or sample the backdrop: test on a
   mid-range Android phone running Firefox and on an old iPad with **a feed of
   several posts** (`embed.html?n=6`) before shipping. A desktop preview
   proves nothing.
