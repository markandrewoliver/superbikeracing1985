# Setup

How to get this repo from a fresh copy of the base template to a game running
on a test subreddit. Steps 1–5 happen once. Steps 6–8 are the everyday loop.

Before building the first screen, read
[`docs/08-learned-since-the-template.md`](docs/08-learned-since-the-template.md).
It covers what decypher learned after this template was cut.

## What is already done

- [x] The base template is copied into this repo on `main`, from decypher's
      `base-template` branch (`0e4d89f`).
- [x] `npm ci`, `npm run type-check`, `npm run check` and `npm run build` pass
      on that tree.

## 1. Tools

```bash
git clone https://github.com/markandrewoliver/superbikeracing1985
cd superbikeracing1985
nvm use            # Node 24, from .nvmrc
npm ci
npx devvit login   # writes your token to ~/.devvit/token
```

## 2. Name the app

Replace `your-app-name` in **both** `devvit.json` (`name`) and `package.json`
(`name`).

The name becomes the app's Reddit account name and its Community URL slug. It
must be 3–20 characters, start with a letter, and use only lowercase letters,
numbers and hyphens. `superbikeracing1985` (19 characters) fits, if it's
available on Reddit. The first `npx devvit upload` registers the name, so
choose it before that upload.

## 3. Pick a test subreddit

Set `dev.subreddit` in `devvit.json`. It currently says `your_dev_subreddit`.
Use a small private subreddit you moderate. Leave out the `r/`.

## 4. Connect GitHub Actions

Under GitHub → this repo → Settings → Secrets and variables → Actions, add:

| Kind | Name | Value |
|---|---|---|
| Secret | `DEVVIT_AUTH_TOKEN` | the entire contents of `~/.devvit/token` |
| Variable | `PROD_SUBREDDIT` | the live subreddit, without `r/` |
| Variable | `DEV_SUBREDDIT` | the test subreddit from step 3, without `r/` |

Until the secret is set, every push to `main` or `dev` fails its workflow run
before it builds anything. That includes the push that created this repo.

## 5. Make the `dev` branch

Work lands on `dev`. `main` is production, and only a person moves it.

```bash
git checkout -b dev
git push -u origin dev
```

## 6. Write the game's words

Fill in `src/client/lib/copy.ts`. It starts blank on purpose: every
player-facing string comes from you, and an empty slot shows on screen as a
visible blank. See [`docs/07-content-and-review.md`](docs/07-content-and-review.md).

## 7. See it locally

```bash
npm run preview    # → http://localhost:5173/preview.html#app
npm run dev        # playtest on the test subreddit from step 3
```

`npm run dev` installs a throwaway version on the test subreddit.

## 8. Ship a version

Pushing to `dev` or `main` **uploads** a new version and installs nothing. To
install one:

1. Find the version number in the push's workflow run (`0.0.N`).
2. Actions → *Deploy to Devvit* → **Run workflow** on the branch:
   - `install_version` = `0.0.N` installs it (`dev` → test subreddit,
     `main` → live subreddit);
   - `report_only` prints what each subreddit is running and changes nothing.

From the command line, the form that works is
`npx devvit install r/<sub> <app-name>@0.0.N`. The CLI's own help example
leaves out the app name, and that form fails on 0.14.

Before anything goes to the **live** subreddit, the version has to be approved
by Reddit. Approval is per version, and installing an unapproved one silently
makes posts by players come from the app account instead. The full procedure,
including the checks before `npx devvit publish`, is in
[`docs/05-shipping.md`](docs/05-shipping.md).

## Optional: newer Devvit

The template pins `devvit` and `@devvit/web` at `0.14.0`. Decypher runs
`0.14.7`, the latest release as of Oct 12, without problems. To move, change
both pins in `package.json`, then run `npm install` (updates the lockfile) and
`npm ci` (gives a clean tree).
