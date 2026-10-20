# 7. Content, copy and review

## Don't let filler copy ship

Every player-facing string (titles, buttons, labels, captions, empty states,
toasts a player sees) is written by the person who owns the game. Copy that
arrives in a template or a PR reads as approved once it is on screen, and it
ships.

So `src/client/lib/copy.ts` starts **blank**, and `<Copy k="..."/>` renders a
visibly empty dashed slot until a string is supplied. If a layout needs a string
nobody has written, leave the slot empty and say what it needs.

Not covered by that rule: strings already in the product (quoting them is fine),
`alt` text and screen-reader labels (accessibility metadata — write those
properly), and **typos in supplied copy** (fix spelling, doubled words, missing
apostrophes; don't reword).

Moderator-facing strings (menu form labels, admin toasts) are tooling, not
player copy.

## Content banks

- Keep content in a committed JSON file and gate it in CI with a check script:
  a bad row is a code change and should fail the build, not reach a player.
- **A rule that only runs on import does not speak for what is already
  committed.** Put text rules in one shared module that both the importer and
  the gate apply.
- **Identify rows by id, never by text or position.** Scores, recordings and
  "already posted" records are keyed by id; two rows can share an opening.
- Edit a large JSON bank **textually, one row at a time** — re-serialising
  reformats untouched blocks and produces a 700-line diff nobody can review.
- Straight quotes only in banks; smart quotes from a source break matching.
- Exact-duplicate checks (case- and punctuation-folded) are cheap; near-duplicate
  detection (re-cut spans, rewording) should **report**, not fail, in the gate.
- **Credit sources.** If content comes from Reddit users (e.g. a subreddit
  dataset), keep the author and permalink per row and show the credit.
- Filter sexual content, slurs, severe profanity and politics at import time;
  a word-boundary match only (no substring accidents — "Scunthorpe", "class").

## Text from players

- Store it verbatim; filter on the way **out** (a filter in the client is one a
  modified client skips, and a report full of `****` tells a moderator nothing).
- Offer **Report and Block**. Reddit will not tell an app who a user has blocked
  (no readable list), so the app keeps its own.
- Anything a player wrote is subject to the deletion triggers.

## App review checklist

From experience; read `docs/devvit/devvit_rules.md` for the source.

- [ ] No inline scroll trap: nothing a player can reach scrolls
      (`npm run check:crop`).
- [ ] `onPostDelete` / `onCommentDelete` delete related Redis content.
- [ ] Nothing focuses on load (it scrolls the feed).
- [ ] No external navigation without need; no `target="_blank"`.
- [ ] Publish zip contains nothing it shouldn't (`.gitignore`, `sourceIgnores`).
- [ ] `PUBLISHING.md`-style notes for reviewers describing what the app posts,
      as which account, and what it stores.
- [ ] `runAs: "USER"` only where the player explicitly acts, and tested on an
      approved version.
- [ ] A "delete my data" path that clears the player's records (server *and*
      local), reachable from their own keys.
