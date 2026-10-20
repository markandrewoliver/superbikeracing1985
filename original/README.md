# The original single-file game

`Super_Bike_Racing_1985.html` is the game as it was handed over on Oct 20: one
570KB page with the whole game in one inline script and its art as `data:` URIs.
It is kept as the reference the split was checked against. **Do not edit it**,
and do not build from it: the game is `src/client/game/` now.

It is listed in `devvit.json` → `sourceIgnores`, so it never goes to Reddit's
reviewers.

## How the split was made

`split/` holds the tool that turned this file into `src/client/game/`. It is a
record of how the split was made, not part of the build.

- `split.mjs` parses the script, gives each top-level statement a module by
  original line number (`config.mjs` → `RANGES`, `OVERRIDES`,
  `NAME_OVERRIDES`), works out every import and export from the scope analysis,
  moves the variables that several modules assign onto the four state objects
  (`config.mjs` → `GROUPS`), and writes the embedded PNGs out as files.
  `PRE_EDITS` are the few hand changes made on the way (see
  `docs/09-game-architecture.md`).
- `evalorder.mjs` checks the result statically: running the modules in ES
  module order, no top-level code may read another module's `let` or `const`
  before that module has run.
- `equiv.mjs` runs this page and the split build side by side with the same
  seeded `Math.random`, the same hand-driven clock and the same key presses,
  and compares the canvas pixel for pixel.

To run them again, install the parser packages without saving them:

```bash
npm i --no-save acorn acorn-walk eslint-scope@8 magic-string
node original/split/split.mjs original/Super_Bike_Racing_1985.html /tmp/split
cp -r original/split/static/. /tmp/split/
node original/split/evalorder.mjs /tmp/split
```

`equiv.mjs` needs this page and a build served from one origin, as
`/original.html` and (with `SPLIT=/game.html`) the game page:
`node original/split/equiv.mjs http://localhost:5200 race 1800`. Scenarios are
`attract`, `race`, `finish`, `stunt`, `tutorial`, `builder` and `player`.
Once the game changes, the two stop matching. That is expected, and from then
on this check has nothing left to say.
