# Working notes for Claude

A Devvit Web (Reddit Developer Platform) game built from the base template.
Read `README.md` for the layout and `docs/` for the platform hazards; this file
is the short list of rules that have each already cost a silent bug.

**Read `docs/08-learned-since-the-template.md` before building the first
screen.** This repo was copied from decypher's `base-template` branch on Oct 20,
and that doc holds what decypher learned after the template was cut — above all
that on a phone the inline post is a splash and play starts full screen, which
is what got decypher 0.0.601 rejected for a scroll trap.

## Never

- **Never make a push install an app version.** Push → upload only; installing
  is a manual `workflow_dispatch` with an explicit `install_version`. Approval is
  per version, and an unapproved install silently makes `runAs: "USER"` post as
  the app account for everyone but the owner.
- **Never run `npx devvit publish` from a tree you have not checked** against
  what was tested: `git status --porcelain` empty and
  `git rev-parse HEAD origin/dev` matching. If they differ, say so and stop.
- **Never add a second row to `menu.items`.** Rows are addressed by index and
  clients cache the list. Add post kinds to `POST_KINDS` (server/postKinds.ts).
- **Never put a `cron` on a task in `devvit.json`.** The schedule lives in
  `server/cron.ts`; a manifest cron makes every post go out twice.
- **Never test the clock in a scheduled handler.** Ask `dueNow(task)`.
- **Never let anything a player can reach scroll.** Page it (`Paged`).
- **Never cancel a pointer gesture or focus a field in the inline post on a
  phone.** It swallows the feed's scroll and raises the keyboard, and Reddit
  rejects it as a scroll trap. Inline on a phone is a splash; play starts full
  screen (doc 08).
- **Never focus on mount**, and always `{ preventScroll: true }`: focus in an
  iframe scrolls the whole feed.
- **Never add a filter, blend mode, backdrop-filter or feTurbulence to the CRT**
  or over the app. It crashed Firefox's GPU process and older iPads.
- **Never put an inline `<script>` in index.html.** Reddit's CSP blocks it in a
  real post while it works locally.
- **Never invent player-facing copy.** Leave the slot empty (`lib/copy.ts`) and
  say what it needs. Fixing a typo in supplied copy is fine; rewording is not.
- **Never put an answer in `postData`** in plain text.
- **Never run a regex over a whole stylesheet.**

## Always

- Run `npm run type-check`, `npm run check` and `npm run build` before calling
  work done; `npm run check:crop` after touching layout (needs
  `npm run preview`); `npm run sim:crons` after touching `cron.ts`.
- `npm ci` after any `package.json` change.
- Menu/form handlers answer **200 + `showToast`**, with a `console.error`.
- Every swallowed write gets a `console.error` in its `catch`.
- A list you will ever need to enumerate gets an index written **now** (Redis
  has no key scan).
- Every per-post record holding anything a person wrote is cleared in
  `server/deletions.ts`.
- Anything that must survive a deploy is on the server; `localStorage` is the
  second copy, and an absent local flag proves nothing.
- Full-viewport overlays use `height: min(var(--vis-h, 100dvh), 100dvh)` and are
  portalled (`Modal`).
- A local `text-shadow` under the glass ends with `, var(--crt-type-shadow)`.
- A new screen gets a preview route and a line in `scripts/check-crop.mjs`.
- Preview fixtures answer exactly what the server answers.
- A difference between post kinds is a **parameter**, never a copy. Anything
  that exists twice gets a home. Files stay under ~2,000 lines.

## When it stops working, stop and ask

If an approach has failed and the next step would be a different approach, put
the alternatives to the human — what was observed, why the last attempt did not
address it, the options with their costs, and which you'd pick — and wait.

When a browser crashes, read its crash reports before forming a theory. When a
post is blank, put a fixed, top-z-index, self-repainting strip on the page: if
it goes blank too, the document on screen is not yours.

When something is "missing" on one subreddit, first ask which version that
subreddit is running (`deploy.yml` → `report_only`).
