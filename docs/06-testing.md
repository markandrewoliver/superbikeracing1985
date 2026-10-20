# 6. Testing

There is no unit-test suite by default. What there is, and why each exists:

| Command | Catches |
|---|---|
| `npm run type-check` | the client/server wire types drifting |
| `npm run check` | devvit.json naming forms, menu rows, tasks or triggers with no route; a manifest cron; more than one menu row |
| `npm run build` | the bundles |
| `npm run sim:crons` | the reconcile against the 10-job cap; the Eastern gate over a week |
| `npm run check:crop` | text or images out of the frame at 288/880 x 512, 390 x 510, 705 x 512; **any scrolling element** a player can reach |
| `npm run test:input` | real presses on Chromium, Firefox, WebKit, mobile WebKit, inside a cross-origin iframe that does not hold focus |

Run `type-check`, `check` and `build` before calling work done.

## The preview harness

`npm run preview`, then:

- `http://localhost:5173/preview.html#app` — signed in; `#app?guest` signed out.
- `?vp=288x512#app` — the screen inside an iframe of that size, so `100dvh`,
  media queries and `--vis-h` resolve against the frame, as in a post.
- `embed.html#app` (open it at `localhost`; the frame loads from `127.0.0.1`) —
  cross-origin, unfocused, in a page. `?n=6` for a feed.
- Bottom left: the **layout-shift meter**. Bottom right: the **CRT panel**.

Give every interesting state its own hash route (`#screen?flag`), so
`check:crop` and the e2e tests can reach it by URL. **A route not listed in
`check-crop.mjs` is not checked.**

**A fixture is a claim about the server.** The stubbed fetch in `preview.tsx`
must answer what the real route answers. A fixture shaped the way you wish the
server behaved is how a bug works in the preview and never in a post (a rematch
that "worked" for weeks; a tie that could not exist because the server numbers
rows `i + 1`). Import the server's pure functions instead of restating them.

The harness also has to track `--vis-h` (`Glass` does), or every height reserve
is laid out against `100dvh` and looks fine while being wrong in a post. Check
height changes at a **short** frame.

## Simulations

When a rule needs two people, a clock, or history, no preview can reach it.
Write a sim: bundle the real server modules over a fake Redis and drive the
clock by hand (every entry point takes `now`). Rules for sims:

- **Mutation-test every check.** Break the thing it guards and watch it go red.
  Several checks in a previous game passed against the broken code on their
  first draft (a check that looked a wiped player up by name passed because the
  wipe deleted the name too).
- **Never re-derive the value under test.** A cron sim that did its own
  conversion stayed green while every real registration was refused.
- For "never offer the same thing twice", count distinct offers over a whole
  pool — "is the next one different?" passes on a shuffle that retires nothing.
- Jitter the clock. A frozen or uniform tick hides the race.

## Real devices

Playwright's WebKit is not Mobile Safari, and nothing local is the Reddit
Android app. Before shipping anything touching input, focus, expanded mode or
the CRT: a real iPhone, a real Android phone in the Reddit app, Firefox for
Android, and an old iPad.
