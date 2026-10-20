# 4. The Devvit platform

Devvit Web 0.14: a React + Vite client served as the post's webview, an Express
server bundled to one CommonJS file, Redis, a scheduler, realtime. Node 24.
Pin `devvit` and `@devvit/web` **exactly**. After any `package.json` change run
`npm ci` — a stale `node_modules` type-checks and builds against the *old* SDK
while validating nothing.

Pure Devvit Web: no `@devvit/public-api`, no Blocks, no custom post types (0.13
removed them). `submitCustomPost`'s `splash` option is gone in 0.14; launch
screens are HTML entrypoints.

The local copy of the docs is in `docs/devvit/` (excluded from the publish zip by
`sourceIgnores`). `devvit_rules.md` is what app review is conducted against.

## Approval is per version

Reddit approves **each version**. Approval is not inherited. Installing an
unapproved version over an approved one **silently breaks `runAs: "USER"`**:
posts and comments come from the app account for everyone except the app owner,
with no error. So:

- **Never make CI install a version on push.** Push → upload only; installing is
  a manual `workflow_dispatch` with an explicit version (see
  `05-shipping.md`).
- On a dev subreddit an unapproved build is fine for testing — but say that
  attribution is app-account while it stands, because a shared result tested on
  it is not showing what a player would see.

## The subreddit menu is one row

`menu.items` is an ordered list and Reddit addresses each row **by index**
(`menuItem.${index}`); the label is display text the client cached. Insert a row
and every row below is renumbered — a client still holding the old list fires
the right index into the wrong meaning: stale labels, live dispatch, no error.
Nothing you upload invalidates that cache (incognito sees it too).

So `menu.items` has **one** row → a chooser form whose options are built
server-side at press time (`server/postKinds.ts`). Forms are addressed **by
name**, so adding one is safe. Adding a post kind = an entry in `POST_KINDS` +
a `forms` line in `devvit.json` + a `router.post`. `npm run check` verifies the
three agree.

A moderator tool that does not create a post does not need the menu at all — put
it in an admin screen inside the app.

"A menu row went missing" is almost always **a subreddit running an older
version**. Ask which version is installed (`deploy.yml` → `report_only`) before
forming a theory; compare the reported rows against the history of `menu.items`.

## Menu and form handlers answer 200

A non-2xx from `/internal/menu/*` or `/internal/forms/*` is rendered as Reddit's
own "Something went wrong" and your message is discarded. **Answer 200 with
`showToast`** and `console.error` beside it, or the failure is invisible on
screen *and* in `npx devvit logs`.

## Redis

- **Namespaced per installation.** Dev and prod share nothing.
- **`redis.global` is refused** unless Reddit grants it per app
  (`9 FAILED_PRECONDITION: global redis is not supported on this app`). There is
  no local fix. Don't build on it.
- **No `SCAN`, no `KEYS`, no `hLen`.** "Which X have Y?" needs an **index**
  written alongside the record. A loop with an `await` per item over a bank is
  the shape that timed out a moderator menu (2,041 sequential calls).
- **An index written at creation is empty for everything created before it.**
  Decide what you will need to list on day one. (Reddit's listings —
  `getNewPosts` — can backfill titles and times; `postData` is not on the
  listing and costs a call each.)
- **A per-player answer wants a per-player key.** Write a per-player twin of
  each per-post record on the same event, so "how did I do across every post" is
  one read.
- **A tally blob is not a hot-path read.** A question asked on open ("has this
  player ever played?") gets its own small key; don't parse a growing JSON blob
  for one bit.
- **`hSetNX` is the only atomic primitive.** Use it to claim things (settle a
  result once, pair two players). For two claims, take them in a fixed order
  (by id) so concurrent pairings resolve to one winner.
- **A swallowed write needs a `console.error` in its `catch`.** Wrapping writes
  so a failure never costs the player is right; doing it silently made a
  week-long outage invisible.
- **Version keys** (`:v1`) and bump when a stored value's meaning changes.
- Keep every key name in one module (`server/keys.ts`).

## Deletions (required)

The Devvit Rules: on `onPostDelete` / `onCommentDelete`, delete all content
related to that post or comment (title, body, embedded URLs) from Redis.
Metadata that only contextualises may stay. `server/deletions.ts`. Fires for
removals too; make it idempotent; answer 200 even on failure. When matching a
comment id inside a stored permalink, match a **path segment**, never
`includes` — a comment permalink contains the post id, and short ids are
prefixes of each other.

## postData

Written at `submitCustomPost`, readable by anybody with the post. Carry
`{ kind }` and route on it; **never put an answer in plain text**. It is not on
the `Post` model returned by listings.

## Scheduler

- **Cap: 10 cron jobs per installation.** Extra registrations are refused.
- **A version install keeps the previous version's jobs.** So never blind-
  register: `server/cron.ts` → `syncCrons` **reconciles** (read what is there,
  make it match), runs from `onAppInstall`/`onAppUpgrade`, and does **every
  cancel before any register** (an installation holding ten old-named jobs
  refuses the first add otherwise — invisible on dev, where names already
  match). `npm run sim:crons` plays that.
- **No `cron` on a task in `devvit.json`.** Declare the task (its endpoint) only.
  A manifest cron plus the runtime one fires every post twice. `npm run check`
  fails on it.
- **The schedule is data, in Eastern time.** `"minute hour weekday"` in
  `America/New_York`. The wake cron is derived (`"<minute> * * * *"`, hourly)
  and every handler asks `dueNow(task)`. **No handler tests the clock itself** —
  a literal `hour !== 9` means the cron decides when it wakes and the literal
  when it acts, and moving a post needs a version. Hourly + ask-New-York also
  removes the DST problem.
- One-off jobs (`runAt`) are never touched by the reconcile: filter on "has a
  `cron`", never on a name list.
- **A queue of unique content is read from what was posted, not a cursor.** A
  cursor in its own key reads 0 on any install that never ran the new code, and
  re-posts item one. Record each post (by item id) inside the function that
  creates it, then pick `firstUnposted`. A bank that runs out stops and logs; it
  must not wrap.
- A dedupe-by-date key per job prevents double posts if two wakes land.

## Realtime

An accelerator, never the transport. Every live screen **polls and
subscribes**; a push says "something changed". `permissions.realtime` is a bare
boolean, like Redis's, so nothing may depend on a push arriving. Because both
feed one screen, the same change arrives twice: carry a monotonic `seq` and drop
anything not newer (reset the guard when the *thing* changes, e.g. a new match
starting at seq 0). Send the state in the push (don't make the client poll to
learn what changed), but never send secrets on a channel — a channel authorises
nobody.

## Serverless shape

Each request is a fresh invocation that lives just long enough to answer.
There is no timer inside a request and no background sweep. So:

- **settle lazily, on read, in a loop** (a turn that expired between two polls
  is made true by the next reader);
- **defer by storing and delivering on read** (a message for someone busy is
  simply not handed over until they are free);
- the client must not depend on a write it just made being visible to the next
  request — send what it already knows (e.g. `?not=` the ids it is holding).

## Users and flair

- Mention people as `u/name` in a **comment** to notify them; nothing drawn in
  the webview can.
- `setUserFlair` replaces whatever the user chose (no append, no restore), takes
  a username, and needs the app account to be a moderator with flair rights.

## Launch and boot

- `index.html` paints the ground and a spinner from inline CSS; React's
  `createRoot` clears it.
- `boot-preflight.js` fires the first request before the bundle lands.
- Don't add a "loading" screen that only says wait — reserve the room and hold
  the first beat of your own opening instead.
