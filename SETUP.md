# Setup

How to get Super Bike Racing 1985 from this repo to a post you can play on
the test subreddit, **r/decyphergame_dev**. Steps 1–6 happen once. Steps 7–9
are the everyday loop.

Before changing the game, read
[`docs/09-game-architecture.md`](docs/09-game-architecture.md). Before building
any new screen, read
[`docs/08-learned-since-the-template.md`](docs/08-learned-since-the-template.md).

## What is already done

- [x] The base template is copied into this repo on `main`, from decypher's
      `base-template` branch (`0e4d89f`).
- [x] The game is split from one HTML file into modules (`src/client/game/`),
      and checked pixel for pixel against the original (doc 09).
- [x] It is wired into Devvit. A `race` post shows a splash (the title picture
      and a **Click here** button). The button opens the game in the expanded
      view: full screen on a phone, a large modal on desktop. Nothing inline is
      playable.
- [x] The moderator menu offers the post kind **Super Bike Racing 1985**.
- [x] `devvit.json`: app name `superbikeracing1985`, test subreddit
      `decyphergame_dev`. **Check the app name in step 2.**
- [x] `npm run type-check`, `check`, `build`, `check:crop` and `sim:crons`
      pass.

## 1. Tools (on your computer)

```bash
git clone https://github.com/markandrewoliver/superbikeracing1985
cd superbikeracing1985
nvm use            # Node 24, from .nvmrc
npm ci
npx devvit login   # opens a browser; writes your token to ~/.devvit/token
```

## 2. Check the names

Both are in `devvit.json`.

- **`name`: `superbikeracing1985`.** This becomes the app's Reddit account
  (u/superbikeracing1985) and its Community URL. The first upload (step 4)
  registers it, so this is the one chance to change it. Rules: 3–20
  characters, starting with a letter, lowercase letters, numbers and hyphens
  only. If Reddit says it is taken, change it in **both** `devvit.json` and
  `package.json`, then run `npm install` and `npm ci`.
- **`dev.subreddit`: `decyphergame_dev`** (confirmed Oct 21). No `r/`.

## 3. The test subreddit

You must be a **moderator** of r/decyphergame_dev. Devvit only installs on a
subreddit you moderate, and only moderators see the menu that makes the post.
A small private subreddit is ideal.

## 4. First run: install and make a post

```bash
npm run dev        # = devvit playtest: builds, uploads, installs on r/decyphergame_dev
```

Leave it running while you test: it streams the app's logs. (If a code change
does not show up in the post, run `npm run build` and reload.) Then, on
reddit.com:

1. Open r/decyphergame_dev.
2. Open the subreddit's **⋯ (mod) menu** and choose **Create a post**.
3. Pick **Super Bike Racing 1985**, then **Next**.
4. Keep or change the title, then **Create post**. Reddit takes you to the
   post.

## 5. Try it, on a phone and on desktop

- **Phone (Reddit app):** the post shows the title picture and **Click here**.
  Tap it. The game should open full screen, with the D-pad under the screen.
  Scroll the feed past the post too: it must scroll freely.
- **Desktop (reddit.com):** click **Click here**. The game should open in a
  large window over the page, with the arrow keys working.

**Tell me what desktop does.** Decypher once saw desktop answer this request
with a "Preview on Devices" box instead of opening the post bigger. If that
happens, or nothing happens, say so: the fallback is to run the game inside
the post on desktop only (doc 09, "In Reddit").

## 6. Connect GitHub Actions (for shipping versions)

Under GitHub → this repo → Settings → Secrets and variables → Actions, add:

| Kind | Name | Value |
|---|---|---|
| Secret | `DEVVIT_AUTH_TOKEN` | the entire contents of `~/.devvit/token` (step 1) |
| Variable | `DEV_SUBREDDIT` | `decyphergame_dev` |
| Variable | `PROD_SUBREDDIT` | the live subreddit, without `r/` |

There is no live subreddit yet. Until there is, set `PROD_SUBREDDIT` to
`decyphergame_dev` too: the workflow refuses to run with it blank. Pushes only
upload; nothing installs anywhere unless you ask (step 9).

Until the secret is set, every push to `main` or `dev` fails its workflow run
before it builds anything. That includes the pushes so far.

Then make the `dev` branch. Work lands on `dev`; `main` is production, and only
a person moves it.

```bash
git checkout -b dev
git push -u origin dev
```

## 7. See it locally

```bash
npm run preview
```

- `http://localhost:5173/preview.html#app?kind=race`: the splash. Its button
  goes to the game, since there is no Reddit around it.
- `http://localhost:5173/game.html`: the game itself.

## 8. Words

Every player-facing word in the game is the owner's, and stays that way. The
rule is at the top of `src/client/game.html`. The splash's one string, **Click
here**, is in `src/client/lib/copy.ts`.

## 9. Ship a version

Pushing to `dev` or `main` **uploads** a new version and installs nothing. To
install one:

1. Find the version number in the push's workflow run (`0.0.N`).
2. Actions → *Deploy to Devvit* → **Run workflow** on the branch:
   - `install_version` = `0.0.N` installs it (`dev` → test subreddit,
     `main` → live subreddit);
   - `report_only` prints what each subreddit is running and changes nothing.

From the command line, the form that works is
`npx devvit install r/<sub> superbikeracing1985@0.0.N`. The CLI's own help
example leaves out the app name, and that form fails on 0.14.

`npm run dev` (step 4) installs its own throwaway versions on the test
subreddit; that is fine while trying things.

Before anything goes to a **live** subreddit, the version has to be approved
by Reddit. Approval is per version. The full procedure, including the checks
before `npx devvit publish`, is in [`docs/05-shipping.md`](docs/05-shipping.md).

## Know before you test

- **Saved things reset with every new version.** Best times, the stunt best,
  the three built tracks and your rider's look are kept in the browser's
  storage, which Devvit gives a fresh, empty copy per app version. Keeping
  them across updates means saving them on the server (Redis); that is the
  next piece of work if you want it.
- **Sound is off**, as it was in the original (`SOUND_ON` in
  `src/client/game/audio/sound.js`).
- **The template's example post kind is still in the menu** ("Example post").
  It is harmless; say if you want it removed.

## Optional: newer Devvit

The template pins `devvit` and `@devvit/web` at `0.14.0`. Decypher runs
`0.14.7`, the latest release as of Oct 12, without problems. To move, change
both pins in `package.json`, then run `npm install` (updates the lockfile) and
`npm ci` (gives a clean tree).
