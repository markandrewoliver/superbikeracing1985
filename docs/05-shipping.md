# 5. Shipping

## One-time setup

1. `npm ci`, then `npx devvit login`.
2. Rename the app: `name` in `devvit.json` **and** `package.json`. The first
   `npx devvit upload` registers the name with Reddit.
3. Set `dev.subreddit` in `devvit.json` (a small private test subreddit you
   moderate).
4. GitHub → Settings → Secrets and variables → Actions:
   - secret **`DEVVIT_AUTH_TOKEN`** = the entire contents of `~/.devvit/token`;
   - variables **`PROD_SUBREDDIT`** and **`DEV_SUBREDDIT`** (no `r/`).
5. Branches: work lands on `dev`; `main` is production and only a person moves
   it.

## The pipeline

`.github/workflows/deploy.yml`:

| Trigger | What happens |
|---|---|
| push to `main` | `npm run check`, type-check, build, **upload a new version**. Nothing is installed. |
| push to `dev` | the same, then **install that version on the dev subreddit** (retrying while Reddit finishes processing it) |
| manual, `install_version` = `0.0.N` | install that version on the branch's subreddit (`main` → prod, `dev` → dev) |
| manual, `report_only` | print `devvit list installs` for both subreddits and do nothing else |

The report also runs after every install, as independent confirmation.

**Never change this so that a push to `main` installs.** Approval is per
version; an unapproved install silently breaks user attribution. Which build
the live subreddit runs should be something a person chose.

The dev subreddit is the exception, because a push to `dev` is a test build
and this app never posts with `runAs: "USER"`, the one thing an unapproved
version breaks. If the app ever adds `runAs: "USER"`, take the dev
auto-install out of `deploy.yml` in the same change.

## Publishing for review

`npx devvit publish` builds from the **working directory** and cuts a *second*
version — not the one CI uploaded. So the build that reaches review is only the
build you tested if the checkout matches the ref CI built. Three things make a
mismatch invisible:

- `main` lags by default — a publish from a stale `main` ships old code;
- version numbers are assigned by Reddit **monotonically per app at upload**, not
  per branch — a stale tree gets a *higher* number carrying *older* code;
- nothing stamps a commit into the build.

Before publishing, stop if any of these disagree:

```bash
git status --porcelain          # must be empty
git fetch origin dev
git rev-parse HEAD origin/dev   # the two lines must match
```

(Better still: publish from CI on a named ref, and stamp the short SHA into the
build where an admin screen can show it.)

The publish zip is the working directory filtered by `.gitignore` and
`devvit.json` → `sourceIgnores`. **Reviewers receive everything else** —
scratch files, mockups, virtualenvs, traces. Keep `.gitignore` honest.

## Then

1. Wait for **Approved** at developers.reddit.com → your app → versions.
2. Run the workflow on `main` with `install_version`.
3. Check the report step says the subreddit is on that version.

## Debugging in production

- `npx devvit logs <subreddit>` — everything `console.*` on the server.
- If the logs are empty for a failing menu press, the handler returned non-2xx
  or never logged (see `04-devvit-platform.md`).
- "Something is missing on one subreddit and not another" → two installs on two
  versions. Run `report_only` first.
- `npm run dev` (`devvit playtest`) installs throwaway versions on the dev sub,
  displacing whatever was pinned there. Reinstall a known version before testing
  anything you will report on.
