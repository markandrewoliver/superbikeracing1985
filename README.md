# Reddit game base template

A starting point for a game on Reddit's Developer Platform (Devvit Web 0.14):
a React client drawn as a custom post, a small Express server, Redis, the
scheduler, and the CRT screen filter. It also holds what we learned building
one, as docs.

It contains no game, only a per-post counter that shows the round trip. Replace
it.

## Start a new game

```bash
git checkout base-template
git checkout -b main          # in a new repo, or a fresh branch
nvm use                       # Node 24
npm ci
npx devvit login
```

1. Rename `your-app-name` in `devvit.json` and `package.json`.
2. Set `dev.subreddit` in `devvit.json`.
3. Fill in `src/client/lib/copy.ts` (it starts blank on purpose; see
   `docs/07-content-and-review.md`).
4. GitHub: secret `DEVVIT_AUTH_TOKEN`, variables `PROD_SUBREDDIT` and
   `DEV_SUBREDDIT` (see `docs/05-shipping.md`).
5. `npm run preview` → <http://localhost:5173/preview.html#app>.
6. `npm run dev` to playtest on the dev subreddit.

## Read these

| Doc | About |
|---|---|
| [`docs/01-frame-and-layout.md`](docs/01-frame-and-layout.md) | post sizes (288–880 x 512), no scrolling, `--vis-h`, layout shift, images |
| [`docs/02-devices-and-input.md`](docs/02-devices-and-input.md) | phones vs desktop, expanded mode, focus, keyboards, CSP, storage |
| [`docs/03-crt-filter.md`](docs/03-crt-filter.md) | the CRT glass, and the browser crashes that shaped it |
| [`docs/04-devvit-platform.md`](docs/04-devvit-platform.md) | approval, the one-row menu, Redis, deletions, scheduler, realtime |
| [`docs/05-shipping.md`](docs/05-shipping.md) | upload vs install, publishing safely, debugging production |
| [`docs/06-testing.md`](docs/06-testing.md) | the preview harness, crop check, cross-engine input tests, sims |
| [`docs/07-content-and-review.md`](docs/07-content-and-review.md) | copy, content banks, player text, the app review checklist |
| [`docs/08-learned-since-the-template.md`](docs/08-learned-since-the-template.md) | **read first**: inline-phone scroll traps, designing for the full-screen reload, setup notes |
| `docs/devvit/` | a local copy of Reddit's Devvit docs (not uploaded) |

## Layout

```
devvit.json                    manifest: one menu row, forms, triggers, tasks
src/client/
  index.html                   inline ground + spinner, external preflight script
  public/boot-preflight.js     first request, before the bundle (CSP-safe)
  App.tsx                      --vis-h, the CRT, expand-on-tap, routing by kind
  ExampleApp.tsx               the example post kind — replace
  components/CrtScreen.tsx     the CRT glass (+ crtSurge)
  components/Paged.tsx         lists that page instead of scrolling
  components/Modal.tsx         portalled overlay
  components/Key.tsx           on-screen key that fires on pointerdown
  components/Copy.tsx          player copy, or a visible empty slot
  lib/devvit.ts                navigateTo, viewer, postKind, expanded mode
  lib/visibleHeight.ts         measures the actually-visible height
  lib/boot.ts, lib/copy.ts
  styles/                      tokens + app column, components, CRT
  preview.tsx, embed.html      local harness (never shipped)
src/server/
  routes/api.ts                what the webview calls
  routes/internal.ts           menu, forms, triggers, scheduled tasks
  postKinds.ts                 the chooser behind the one menu row
  cron.ts                      runtime schedule: reconcile + Eastern dueNow
  deletions.ts                 required cleanup on post/comment delete
  keys.ts, posts.ts, time.ts, viewer.ts
src/shared/                    wire types and the schedule parser
scripts/                       check-wiring, check-crop, sim-crons
e2e/                           Playwright, embedded cross-origin
.github/workflows/deploy.yml   push → upload only; manual install / report
```

## Commands

```bash
npm run type-check   # tsc
npm run check        # devvit.json ↔ routes ↔ post kinds ↔ cron tasks
npm run build        # client + server
npm run sim:crons    # reconcile vs the 10-job cap; Eastern gate
npm run preview      # local harness on :5173
npm run check:crop   # needs preview running; CHROMIUM_PATH optional
npm run test:input   # Playwright, four engines, embedded
npm run dev          # devvit playtest on dev.subreddit
```

## Adding a post kind

1. Add the id to `PostKindId` in `src/shared/api.ts`.
2. Add an entry to `POST_KINDS` in `src/server/postKinds.ts`.
3. Add `"<formName>": "/internal/forms/<path>"` to `devvit.json` → `forms`.
4. Add `router.post("/internal/forms/<path>")` in `routes/internal.ts`, calling
   `createPost(subreddit, "<kind>", title)`.
5. Route the kind in `App.tsx`, and in `boot-preflight.js` if it fetches on open.
6. Add a preview route and list it in `scripts/check-crop.mjs`.
7. `npm run check`.

**Do not add a second menu row** (see `docs/04-devvit-platform.md`).
