# 9. Super Bike Racing 1985: how the game is laid out

The game arrived as one HTML file (kept in `original/`, see its README). This
doc is the plan for splitting it, and the record of how the split came out.

## What arrived

- **One inline script of 4,900 lines**, an IIFE over 627 top-level bindings.
  Everything could see and assign everything.
- **About 70 top-level `let`s assigned from more than one part of the script**:
  `state`, `stateT`, `camX`, `trk`, `mode`, `raceM` and so on.
- **The intro video patched four functions at runtime** (`crash`, `botCrash`,
  `tick`, `render` reassigned to wrapped versions), and replaced `Math.random`
  with a seeded stream while it plays.
- **135 PNGs as `data:` URIs** (title art, backdrops, cars), about 450KB of the
  file, and pixel art as string grids.
- **Things a Reddit post refuses**: an inline `<script>` (blocked by the
  webview's CSP) and Google Fonts (the webview may reach only its own origin).
  The fonts turned out to style nothing on screen, since all game text is drawn
  with the bitmap font in the canvas.
- A page that is one tall handheld with a D-pad, with `touch-action: none` and
  cancelled pointer events. Inline in a feed, that is a scroll trap.

## The plan

1. **Split by what the code is about, not by size.** Pure data (art tables,
   palettes, constants) goes in leaf modules that import nothing back. Logic
   goes by subject: world, race, rider, modes, input, drawing, UI, intro video.
2. **Make the split mechanical and checkable.** A parser assigns each top-level
   statement to a module and computes every import and export. Nothing is
   retyped by hand, so nothing is lost by hand.
3. **Give shared mutable state a home.** ES module imports are read-only, so a
   variable that several modules assign moves onto one of four state objects.
   Everything else stays a plain module variable, owned by one module and read
   by the others.
4. **Replace the runtime patching with plain code.** No module may reassign
   another's export.
5. **Prove the behaviour is unchanged** by running the original and the split
   side by side and comparing pixels, not by reading diffs.
6. **Fit Reddit**: the art becomes files, no inline script, no external fonts.
   The game becomes its own page, opened in the expanded view, behind a splash.

## How it came out

`src/client/game/`, 51 modules, the largest 390 lines:

| Folder | What is in it |
|---|---|
| `core/` | `config` (fixed numbers), `palette`, `util` (maths and random streams), `canvas` (the canvas, its context and `fitScreen`), `state` (the shared state objects) |
| `world/` | `settings` (what a track can be), `track` (the world and the rolled track), `terrain` (ground height, loops), `course` (the generator), `traffic` |
| `race/` | `session` (bike, input flags, new game), `play` (a step of riding), `crash`, `rivals`, `finish`, `loop` (the fixed-step tick), `playerLook` |
| `rider/` | `physics` (on the ground), `air` (rotation, tricks, landing), `secretMoves` |
| `modes/` | `tutorial`, `replay` (and the ghost), `stunt`, `builder`, `builderDraw` |
| `input/` | `pad` (D-pad, keyboard, taps, secret codes) |
| `gfx/` | `pixel` (rects, font, rotated frames), `riderSprites`, `backdrop`, `scenery`, `road`, `bike`, `vehicles`, `lighting`, `render` |
| `ui/` | `title`, `menu` (what a press does), `overlay`, `hud`, `podium` |
| `art/` | the pixel-art and image tables, and `assets.js` (PNG lookup and loading) |
| `attract/` | the title-screen intro video and its scenes |
| `assets/` | the 135 PNGs, named by where they sit in the art tables |
| | `main.js` (entry and frame loop), `debug.js` (`window.__scramble` test hooks), `game.css` |

`src/client/game.html` is the page: the original markup, `game.css`, and
`main.js` as a module.

### Shared state

`core/state.js` holds `game` (state, mode, clocks, run records), `race` (the
track, length, start, timings, results), `view` (camera and per-frame draw
lists) and `menu` (cursors and title flags). The names inside are the
original's, so `state` became `game.state` and `camX` became `view.camX`.
`ATT` (the intro video's switches) lives there too.

**Rule for new code:** if a second module needs to change a module's variable,
put it on one of these objects or give the owning module a function that does
the change. ES modules will not let an importer assign the variable itself.
`setCtx()` in `core/canvas.js` is the function kind, used for the drawing
context the compositor swaps.

### Load order

Modules import each other in cycles (drawing reads game state, game logic calls
drawing helpers). That is safe for calls inside functions. It is **not** safe
for top-level code that reads another module's `const` while that module is
still mid-load, which is why the track-setting tables went to `world/settings.js`
and the air-stunt table to `core/config.js`. `main.js` imports every module in
the original's order, so side effects (listeners, saved settings, the look)
still run in the original's order. `original/split/evalorder.mjs` checks this
statically.

### The hand changes

Everything else is the original code, moved:

- `crash()` and `botCrash()` check the intro video's switches themselves
  instead of being wrapped. `frameTick()` and `frameRender()` in
  `attract/attract.js` take over from the patched `tick` and `render`, and the
  frame loop calls them. (`window.__scramble.tick` and `.render` were always
  the unwrapped ones, and still are.)
- `setCtx()` replaces three assignments to `ctx` from other modules.
- Every picture loads through `loadImg()` in `art/assets.js`, and the loop
  starts once `assetsReady()` resolves. A file arrives over the network where a
  `data:` URI decoded at once.
- `game.css` drops the Google Fonts link and adds one rule capping the
  handheld's width so the D-pad always fits the height: the expanded view on
  desktop is a modal, often under 700px tall. It also stops the page scrolling.

### How it was checked

`original/split/equiv.mjs` loaded the original page and the built `game.html`
with `Math.random` seeded the same way, `requestAnimationFrame` driven by hand
at exactly 60 fps and the same key presses on the same frames. It hashed the
canvas every 20 frames. Across the intro video, a race through crash and
finish, the podium and a ghost race, stunt mode, How to Play, the track builder
and Edit Player, **all 425 samples matched the original pixel for pixel**. The
game page fits at 320×568, 375×667, 390×844, 844×390, 700×512, 900×600,
1280×720 and 1920×1080, with nothing scrolling.

## In Reddit

- `devvit.json` → `post.entrypoints`: `default` is `index.html` (the React app;
  for a `race` post, `RaceSplash.tsx`: the title picture and one button), and
  `game` is `game.html`.
- The button calls `requestExpandedMode(event, "game", { desktop: true })`.
  That is full screen on a phone and a large modal on desktop. Nothing else on
  the splash expands the post, and nothing inline is playable.
- **The desktop half is the part to check on a real post.** Decypher once saw
  desktop answer an expanded-mode request with a "Preview on Devices" modal,
  which is why the template refused on desktop. If that happens here, the
  fallback is to open the game inline on desktop only (a `tall` post is 512px:
  enough for the handheld at about 430px wide).

## Not done yet

- **Saved things live in `localStorage` only**: best time, stunt best, the
  three built tracks and the player's look. In a Devvit post that storage is
  scoped to the app version, so **every install empties it**. Moving it to
  Redis (per user, through `/api`) is the next real piece of work if those
  should survive an update.
- The game is JavaScript, not TypeScript. `tsc` does not check it. A gradual
  move (JSDoc types first, then `.ts` a module at a time) would let the type
  check catch the cross-module mistakes the split made easy to make.
- The sound engine is in place but switched off (`SOUND_ON` in
  `audio/sound.js`), as it was in the original.
