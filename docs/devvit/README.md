# Devvit docs, scraped

A local copy of <https://developers.reddit.com/docs/>, so they can be read
without a browser — the phone client this project is often driven from cannot
open them.

**Not shipped to Reddit.** `devvit.json` → `sourceIgnores` lists `docs/devvit/`,
so this directory is excluded from the source zip `devvit publish` builds. It is
in git so it travels with the repo; it is not part of the app.

## What is here

82 pages: everything under `guides/`, `capabilities/`, `quickstart/`,
`earn-money/`, and the root pages — `devvit_rules.md` foremost, which is the
document app review is conducted against.

## What is not

The **674-page API reference** (`/docs/api/…`) and the blog. The reference is
generated from the same typings that are already in `node_modules/@devvit`, so
it is both enormous and available locally by better means; the blog is news.
Ask and they can be pulled down too.

## Keeping it current

There is no updater. These were taken on 2026-09-23 against docs version 0.14,
and the rules page in particular is one Reddit says "may evolve over time" — so
treat anything load-bearing here as a pointer to the live page rather than as
the last word. Re-scraping is a sitemap fetch and a loop; see the commit that
added this directory.
