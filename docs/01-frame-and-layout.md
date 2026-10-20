# 1. The frame, sizing and layout

A custom post is drawn in a box Reddit chooses. Everything here follows from
that.

## The numbers

From Reddit's Custom Post Styles docs (`height` in `devvit.json`):

| Setting | Height | Width |
|---|---|---|
| `"height": "tall"` | **512px** | **~288 to ~880**, by device and viewport |
| `"height": "regular"` | **320px** | same |

This template declares `tall`. So **height is fixed at 512 and width moves by a
factor of three.** Two more frames matter:

- **Desktop inline** measured at about **705 x 526** (1411 x 1053 at 2x DPR).
- **Expanded** (phone, after a tap): the whole screen, e.g. 390 x 844, 320 x 568,
  430 x 932, and tablets.

The **inline post is the one that hurts**: as wide as an expanded one and less
than half the height. Design for 288 x 512 and 880 x 512 first.

## Rules

1. **Nothing a player can reach may scroll.** Reddit's app review rejected a
   build for an "in-line scroll trap": a scrollable web view swallows the
   gestures the feed needs. When a list does not fit, page it —
   `components/Paged.tsx` translates content inside `overflow: hidden` and
   draws full-width Up/Down buttons. In a failure case, clip rather than scroll.
   `npm run check:crop` fails on any scrolling ancestor.

2. **The app is a fixed-height column sized to what is actually visible.**
   `.app { height: min(var(--vis-h, 100dvh), 100dvh) }`. `100dvh` is *not* what
   you can see in the expanded post — on mobile web the frame can run past the
   bottom of the visible page, and an iframe is never told. `lib/visibleHeight.ts`
   measures the real visible height (a `position: fixed; height: 100dvh` probe
   watched by an `IntersectionObserver` with a **null root**, which clips across
   every frame boundary) and also folds in the OS keyboard where the
   VirtualKeyboard API reports it. Read `--vis-h`, never `innerHeight`.

3. **Every full-viewport overlay needs the same height line.** `position: fixed;
   inset: 0` covers the *frame*, so a centred card lands half the clipped height
   too low. Use `top: 0; height: min(var(--vis-h, 100dvh), 100dvh)`.

4. **`vw` is the wrong axis for vertical sizes.** On an inline post a `vw`-sized
   gap takes its *maximum* exactly where there is least height. Use
   `min(Nvw, Mvh)`, container query units (`cqw`/`cqh` on a size container), or
   measure.

5. **Run the corners.** At 288 wide a top nav whose items are all
   `flex: 0 0 auto` overflows and the *last* item (usually Menu) goes off the
   edge, unpressable. Give flex items `min-width: 0` and let one of them shrink.
   And anything rotated or leaning gets worse the **wider** the frame: the ends
   of a tilted band rise with its width.

## Zero layout shift

Screens build in stages (a logo animates, data lands, a font swaps). Each is a
chance for something already on screen to move — obvious in use, invisible in a
screenshot.

- **Reserve the room; never let the late thing size it.** A container whose
  contents arrive late gets its height from something other than its contents.
  `flex: 1 1 auto` is the shape to be suspicious of — it makes the row exactly
  as tall as whatever turns up. Use a named height, or `flex: 1 1 0` (the
  leftover, which is content-independent).
- When the leftover has to be known in pixels (e.g. to size a grid), **measure
  it back out** with a `ResizeObserver` and hand it to the child as a custom
  property. Safe only because the row's height does not depend on its contents.
- **Text in a webfont states its own `line-height`.** With `font-display: swap`
  the first paint is the fallback face; an explicit unitless `line-height`
  makes the box font-size times a number, which no face can resize.
- **A `white-space: pre` block reserves both axes** (`ch` and `em`), or a
  terminal that types itself on grows sideways and slides a centred screen.
- **`scrollbar-gutter: stable`** on anything that might ever overflow, or its
  content changes width when a scrollbar appears.
- **A flex column with `align-items: center` shrink-wraps to its widest
  child** — when a font lands, the column narrows and everything in it moves
  sideways. Give it `width: 100%`.
- Do size-dependent work in a **layout effect**, not an effect, so the wrong
  size is never painted.
- **Measure, don't eyeball.** `npm run preview` shows a layout-shift meter
  (bottom left) reading the browser's Layout Instability API, with the
  elements that moved. Target: 0.

## CSS hazards

- **Custom properties on the element beat inherited ones.** If a component
  declares `--foo` on itself, setting `--foo` on a wrapper silently does
  nothing. Override on the component's own selector.
- **An undefined `var()` invalidates the whole declaration**, not just that
  term. In a `padding` it falls back quietly to 0; in a custom property it
  poisons everything computed from it (a grid collapsed to one column this way).
- **A transform or filter on an ancestor makes it the containing block for
  `position: fixed`.** Any modal must be portalled out (`components/Modal.tsx`).
  `animation: ... both` leaves the final transform on the element forever.
- **A transform contributes to scrollable overflow** even though it changes no
  layout. A shake on the whole screen made a scrollbar appear and squeezed the
  app 15px. `overflow: clip` (not `hidden` — `clip` makes no scroll container)
  while it runs.
- **Never run a regex over a whole stylesheet.** A substitution meant for one
  rule matched four and passed every check, because none of them read CSS
  values. Edit by unique surrounding context; diff after any bulk edit.

## Colour of the ground, three times

The ground is painted three times before React does anything, and all three must
agree or the reveal flashes:

1. `devvit.json` → `post.entrypoints.default.styles.backgroundColor` — what
   Reddit paints before showing your page at all. Flat colour only, `#rrggbbaa`.
   Pick the tone that covers most of your gradient.
2. The inline `<style>` in `index.html` — before your stylesheet arrives.
3. `--bg-grad` in `styles/00-base.css`.

## Images

- Anything decorative goes on a `background-image`, so nothing in the layout is
  sized by it — and crop it **by aspect**, because a frame wider than tall
  shows about half its height.
- An `<img>` in the flow needs its aspect ratio stated up front (`aspect-ratio`
  or width/height attributes) so the room is right on the first paint. If a
  pipeline encodes the images, have it write the ratios into a generated module.
- Bound a picture by **height** as well as width on a wide frame:
  `max-width: min(25vw, 34vh * var(--ar))`-style — a `vw` clamp alone overflowed
  a 400px-tall frame.
- Inline small fonts as data URIs if they are on the first screen; anything
  bigger, `import()` it so it loads beside the app instead of ahead of it.
- Ship WebP/AVIF; keep the published bundle small (approval reviewers download
  it, and so does every reader on a phone).
