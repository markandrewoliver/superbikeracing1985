# 8. Learned since the template was cut

This repo was copied from the `base-template` branch of
`markandrewoliver/decypher` (commit `0e4d89f`, Oct 10 2026). Decypher kept
shipping after that, and several things it learned belong to every game built
from here. They are written down rather than ported, because none of them is
code this template has yet: there is no game here for them to apply to. Read
this before building the first screen.

The decypher commit that recorded each one is named, so the full reasoning and
the working code can be looked up there.

## On a phone, the inline post is a splash and play starts full screen

Reddit **rejected decypher 0.0.601** under "Avoid Scroll Traps in Inline
Apps": *"the keyboard pops up without being typing. And even if you click it
closed, it comes back up as you scroll past it again."* (`6186d78`)

Two things on the inline board caused it, and they are one gesture seen from
two sides:

- **A cancelled `pointerdown` over most of the post.** Cancelling it is how iOS
  decides a gesture did not ask for a keyboard, so a game board does it on
  purpose — and inline, that same cancellation swallows the feed's scroll.
  Reddit's list names it: an app is rejected when it "blocks feed scrolling
  from a canvas, **game board**, map, carousel, or gesture area even when the
  app itself has no internal scroll position".
- **A `focus()` on that gesture onto a field with `inputMode="text"`**, which
  is asking for the OS keyboard while the reader is only scrolling past.

The rule that came out of it is the human's: **on a phone, the inline post is a
splash, and play starts in the expanded (full-screen) presentation.** Inline on
a phone, nothing may cancel a pointer gesture and nothing may focus a field; a
tap belongs to `expandOnTap` and has to reach the document unswallowed. Desktop
is unaffected.

`docs/02-devices-and-input.md` says to cancel `mousedown` (not `pointerdown`)
on a container so taps do not blur the capture field. That still holds, but on
a phone only once the post is expanded.

**Test it by scrolling, not by auditing properties** (`a2d73c2`). Decypher's
`scripts/check-inline.mjs` puts each post kind into the real `embed.html` feed
(four cross-origin iframes), parks the pointer over one, turns the wheel, and
fails if the page does not move. Around that it checks for cancelled `wheel` /
`touchmove` / `pointerdown` on the document, non-passive `wheel` or
`touchmove` listeners (caught by wrapping `addEventListener` before the app
runs), `touch-action: none` / `overscroll-behavior: none` on `html`, `body`,
the root, any canvas and anything covering most of the frame, and anything the
reader could scroll inside the post. An audit alone only finds the causes
somebody thought to look for, which is how 0.0.601 passed a green suite. Copy
that script over when there is a game board to point it at. It cannot test real
iOS or Android; a swipe on hardware is still a person's job.

## Expanding reloads the page, so make the page that loads the one the tap asked for

This template already sends `entryUrl` (see doc 02). Without it the Reddit
Android app shows a black screen. Decypher tried leaving it out once more on
Oct 12 on the strength of the protocol comment ("when unspecified, clients must
never reload") and the black screen came straight back (`9d72030`). **Every
phone reloads to go full screen. Do not take `entryUrl` out.**

So design for the reload. The rule decypher settled on:

- **Inline is always a splash.** Full screen opens straight on the first puzzle
  or race, with **no opening animation**. The one exception is "Learn to play",
  which opens the tutorial (also without its animation).
- **Know whether this page loaded full screen.** Read
  `webViewMode() === "expanded"` once, on the first render, before a collapse
  can change it (`openedExpanded()` in decypher's `lib/devvit.ts`).
- **Hold the press; don't act on it** (`useExpandPress` in
  `src/client/hooks/useExpandPress.ts`). On an inline phone, Start changes
  nothing on screen. Its action runs only if this document survives: the host
  expands in place (an `immersiveModeEvent` arrives), or nothing has happened
  after about 2s. Acting at the press plays the opening for the moment before
  the page is replaced, and then again after.
- **Carry intent across the reload with a one-shot note.** Anything other than
  "start playing" (Learn to play, a menu tile) writes a `localStorage` note with
  a short expiry (15s). The new page reads it once, then clears it. Clear it
  too if the host expands in place, or the note opens the tutorial on some later
  post (`421cf32`, `2e966ab`).
- **Don't draw the screen being left on the page that replaces it.** If the
  tutorial or next screen is a lazy chunk, start fetching it as soon as the note
  is read, and don't draw the splash under it while it loads. Otherwise the
  reader sees the screen they just pressed a button on.
- **Anything that must survive the reload is on the server, or in
  `localStorage`, at the moment of the press.** The tap itself is not carried
  over: the first tap expands, the second plays.

## Measure the room before the first draw on the full page

`--vis-h` is measured a frame or more after the first paint. Until it arrives,
every height reads `100dvh`, which is more than Reddit's full-screen view
actually shows. A layout that is drawn at once and then re-fitted when the
reading lands visibly jumps. Decypher's version of this was "you tap and see
the words adjusting to the new space" (`b4b5ae4`).

Lay the screen out but keep it at `visibility: hidden` until the reading has
**settled**: no change for about 150ms, capped at about 800ms so a host that
never reports can't leave it undrawn. Any opening animation waits for it too.
See decypher's `useRoomReady` and `ROOM_SETTLE_MS` / `ROOM_WAIT_MS` in
`lib/visibleHeight.ts`. To reproduce it in the harness, stub
`IntersectionObserver` so it reports a shorter frame a few hundred ms late.

## Something that arrives late starts blank, not as a stand-in

Reserve the room for anything that arrives late. Leave it blank
(`visibility: hidden`) until its data lands, rather than drawing a default that
the real content then replaces. A placeholder that looks finished reads as the
screen being drawn twice. Covering the swap with an animation only hides the
problem, and costs every open the animation's length (`3ae073e`).

## Check what goes to the reviewers, not only which commit is checked out

`devvit publish` zips the working directory, filtered only by `.gitignore` and
then `devvit.json` → `sourceIgnores`. Anything tracked and not listed in either
goes to Reddit's reviewers. Decypher sent 19MB of feature GIFs, videos and
mockups that way without noticing (`619fb13`). The pre-publish check in
`CLAUDE.md` compares the tree against `origin/dev`, which says nothing about
what is in the zip. When you add a folder of art, capture scripts or mockups,
add it to `sourceIgnores` in the same commit.

## Setup notes for this repo

- **Devvit version.** This template pins `devvit` and `@devvit/web` at
  **0.14.0**. Decypher moved to **0.14.7**, the latest release as of Oct 12,
  with nothing broken. To move, change both pins in `package.json`, then run
  `npm install` to update the lockfile and `npm ci` to get a clean tree. A
  stale `node_modules` type-checks and builds against the old SDK without
  complaint.
- **App name.** `devvit.json` now says `superbikeracing1985` (`SETUP.md` step 2). The
  name is the app's Reddit account name and its Community URL slug: 3–20
  characters, starting with a letter, lowercase letters, numbers and hyphens
  only (`docs/devvit/capabilities/devvit-web/devvit_web_configuration.md`).
  `superbikeracing1985` is 19 characters and fits, if it's available on Reddit.
- **Installing by hand.** The working form is
  `npx devvit install r/<sub> <app>@0.0.N`, with the app name included. The
  CLI's own help example, `devvit install r/<sub> @0.0.N`, fails on 0.14 with
  "DevvitVersion parts can only be numbers" (`22dec58`). `deploy.yml` already
  uses the form that works.
