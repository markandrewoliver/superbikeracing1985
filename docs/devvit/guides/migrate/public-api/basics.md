<!-- Scraped from https://developers.reddit.com/docs/guides/migrate/public-api/basics -->

- - Migration Guides- Migrating from PRAW to Devvit Web- Migration BasicsOn this page

# Migrating from PRAW to Devvit Web

Devvit Web is how
you ship the same kind of automation on Reddit’s platform. This guide will outline the basics of migrating from PRAW to Devvit Web.

note
This guide assumes you have basic familiarity with Python and PRAW (e.g., `pip`, `requirements.txt`, and
`praw.Reddit(...)`). The sections below focus on what changes on Devvit.

This guide is a PRAW → Devvit mapping: same workflows, different runtime. For Devvit setup, start with
the app quickstart or mod tool quickstart.

TopicDevvitArchitecture and limitsDevvit Web overview`devvit.json`Configure your app

## Migration Basics​

### 1. Project layout and auth​

PRAWDevvit`pip` / `requirements.txt``npm` / `package.json``praw.Reddit(...)` + env`devvit.json` + `permissions.reddit``python bot.py` on your server`npm run dev` (playtest on Reddit); handlers are HTTP routes, not a forever loop
Devvit (typical new project)

`npm install && npm run dev
`

devvit.json (excerpt)
`{
  "name": "my-app",
  "server": {
    "entry": "dist/server/index.cjs"
  },
  "permissions": {
    "reddit": true
  },
  "triggers": {
    "onAppInstall": "/internal/triggers/on-app-install"
  }
}
`

src/server/index.ts (excerpt)
`import { Hono } from "hono";
import type { TriggerResponse } from "@devvit/web/shared";

const app = new Hono();

app.post("/internal/triggers/on-app-install", async (c) => {
  return c.json<TriggerResponse>({ status: "ok" });
});

export default app;
`

### 2. `praw.Reddit` → `reddit` and `context`​

PRAWDevvit`reddit.subreddit(...)`, `reddit.comment(...)`, `reddit.submission(...)`Import `reddit` from `@devvit/web/server`. Load: `getSubredditInfoByName`, `getCurrentSubreddit`, `getCommentById`, `getPostById`. Submit: `submitPost`, `submitComment`. See `RedditClient`.Hard-coded subreddit / “current” thing from your script`context` from `@devvit/web/server` — `subredditName`, `subredditId`, `postId`, `commentId` (menu/form/post surfaces), `postData`. See `BaseContext`.Thing id from a menu or form action`context.commentId`, `context.postId` — mod tool quickstartSubreddit secrets / config in your scriptImport `settings` from `@devvit/web/server` (`settings.get(...)`)Event payload from a stream or webhook`await c.req.json<OnCommentCreateRequest>()` (and similar types from `@devvit/web/shared`) — Triggers (see Streams → triggers below)
PRAW

`for comment in reddit.subreddit("learnpython").stream.comments(skip_existing=True):
    print(comment.author, comment.body)
`

Devvit — declare a trigger in `devvit.json`, then handle the event (same idea
as Streams → triggers below):

devvit.json (excerpt)
`{
  "triggers": {
    "onCommentCreate": "/internal/triggers/on-comment-create"
  }
}
`

src/server/index.ts
`import { Hono } from "hono";
import { context } from "@devvit/web/server";
import type { OnCommentCreateRequest, TriggerResponse } from "@devvit/web/shared";

const app = new Hono();

app.post("/internal/triggers/on-comment-create", async (c) => {
  const { subredditName } = context;
  const input = await c.req.json<OnCommentCreateRequest>();
  const commentId = input.comment?.id;
  const postId = input.comment?.postId;
  if (subredditName && commentId) {
    console.log(`r/${subredditName} new comment (${commentId}) on ${postId}: ${input.comment?.body}`);
  }
  return c.json<TriggerResponse>({ status: "ok" });
});

export default app;
`

### 3. Streams → triggers​

Your `subreddit.stream` /
`mod.stream` loops do not
have a direct Devvit equivalent. Declare triggers in `devvit.json`; Reddit
POSTs one event per handler invocation (`onCommentSubmit`, `onPostCreate`, `onModAction`, `onModMail`, …).

PRAW

`for comment in reddit.subreddit("your_sub").stream.comments(skip_existing=True):
    if "spam phrase" in (comment.body or "").lower():
        comment.mod.remove(spam=True)
`

Devvit

devvit.json
`{
  "triggers": {
    "onCommentSubmit": "/internal/triggers/on-comment-submit"
  }
}
`

src/server/index.ts
`import { Hono } from "hono";
import { reddit } from "@devvit/web/server";
import type { OnCommentSubmitRequest, TriggerResponse } from "@devvit/web/shared";

const app = new Hono();

app.post("/internal/triggers/on-comment-submit", async (c) => {
  const input = await c.req.json<OnCommentSubmitRequest>();
  const body = (input.comment?.body ?? "").toLowerCase();
  const id = input.comment?.id;
  if (id && body.includes("spam phrase"))
    await reddit.remove(id, true);
  return c.json<TriggerResponse>({ status: "ok" });
});

export default app;
`

note
Handlers should return quickly (limitations). Defer
heavy work to the scheduler or an allow-listed
`fetch`.

### 4. Scheduler, Redis, and HTTP​

PRAWDevvit`while True`, `time.sleep`, cron jobScheduler — cron in `devvit.json` and/or `scheduler.runJob` (recurring scheduler tasks)SQLite / JSON files / pickle on diskRedis (per subreddit)`requests.get` to any URLServer-side HTTP fetch — `fetch` to domains in `permissions.http.domains`
Redis (replaces local SQLite / JSON files):

src/server/index.ts (excerpt)
`import { redis } from "@devvit/web/server";
import type { OnPostSubmitRequest, TriggerResponse } from "@devvit/web/shared";

app.post("/internal/triggers/on-post-submit", async (c) => {
  const input = await c.req.json<OnPostSubmitRequest>();
  const authorId = input.author?.id;
  if (!authorId) return c.json<TriggerResponse>({ status: "ignored" });

  const count = await redis.incrBy(`post_count:${authorId}`, 1);
  console.log(`User ${authorId} has submitted ${count} posts.`);
  return c.json<TriggerResponse>({ status: "ok" });
});
`

Scheduler (replaces `time.sleep` / cron; declare the task in `devvit.json` first):

src/server/index.ts (excerpt)
`import { scheduler } from "@devvit/web/server";

await scheduler.runJob({
  name: "my-delayed-task",
  data: { message: "Reminder in one hour" },
  runAt: new Date(Date.now() + 60 * 60 * 1000),
});
`

HTTP fetch (HTTPS only; domain must be allow-listed):

devvit.json — HTTP allow-list
`{
  "permissions": {
    "http": {
      "enable": true,
      "domains": [
        "api.example.com"
      ]
    }
  }
}
`

`const res = await fetch("https://api.example.com/v1/status");
const data = await res.json();
`

### 5. Posts, comments, moderation​

Same Reddit actions you already call from PRAW. Devvit’s client is async. PRAW loads comments and posts by base36 id;
Devvit APIs use fullnames (`t1_`, `t3_`) —
see Reddit thing IDs.

#### Posts​

PRAW — `subreddit.submit(...)`

`reddit.subreddit("learnpython").submit(
    "Weekly thread",
    selftext="Discussion goes here.",
)
`

Devvit — `submitPost` /
`submitCustomPost`; prefer `context.subredditName` over hard-coding the sub
name.

src/server/index.ts
`import { context, reddit } from "@devvit/web/server";

export async function createWeeklyThread() {
  const { subredditName } = context;
  if (!subredditName) throw new Error("subredditName is required");

  return await reddit.submitPost({
    subredditName,
    title: "Weekly thread",
    text: "Discussion goes here.",
  });
}
`

Acting as the logged-in user (not the app account): `runAs: "USER"`.

#### Comments​

Get post and comment fullnames from the current request — do not hard-code `t1_` / `t3_` ids in app code.

PRAWDevvit`comment.id` / `submission.id` on a loaded object`.id` on `Post`, `Comment`, or the return value of `submitComment`Hard-coded id in a long-running script`context.postId`, `context.commentId` (`reddit` and `context`)Id from a streamed or webhook event`input.post?.id`, `input.comment?.id` in the JSON body (Streams → triggers)
PRAW — `.reply()` on a `Comment` / `Submission`

`reddit.comment("abc123").reply("Thanks for the context.")
comment_reply = reddit.submission("def456").reply("Pinned notice.")
comment_reply.distinguish(True)  # to pin comment
`

Devvit — either pattern works: pass the fullname to
`reddit.*` (e.g.
`submitComment`), or fetch a
`Comment` / `Post` and
call methods on it (like PRAW). Fetching first adds an extra API round trip — prefer the id-only `reddit.*` path
when you only need a single action; fetch when you will chain several methods on the same thing.

src/server/index.ts — reply on a comment, id only (preferred)
`import { context, reddit } from "@devvit/web/server";

const { commentId } = context;
if (!commentId) throw new Error("Run on a comment.");

await reddit.submitComment({ id: commentId, text: "Thanks for the context.", runAs: "APP" });
`

src/server/index.ts — reply on a comment via Comment.reply()
`import { context, reddit } from "@devvit/web/server";

const { commentId } = context;
if (!commentId) throw new Error("Run on a comment.");

const comment = await reddit.getCommentById(commentId);
await comment.reply({ text: "Thanks for the context.", runAs: "APP" });
`

src/server/index.ts — reply on a post, id only (preferred)
`import { context, reddit } from "@devvit/web/server";

const { postId } = context;
if (!postId) throw new Error("Run on a post.");

const pinned = await reddit.submitComment({
  id: postId,
  text: "Pinned notice.",
  runAs: "APP",
});
await pinned.distinguish(true); // sticky mod comment (maps to PRAW distinguish(True))
`

src/server/index.ts — reply on a post via Post.addComment()
`import { context, reddit } from "@devvit/web/server";

const { postId } = context;
if (!postId) throw new Error("Run on a post.");

const post = await reddit.getPostById(postId);
const pinned = await post.addComment({ text: "Pinned notice.", runAs: "APP" });
await pinned.distinguish(true);
`

In a trigger handler, use ids from the event payload (see Streams → triggers) —
`input.comment?.id`,
`input.post?.id` — with either approach.

#### Moderation​

PRAW — `.mod.lock()`, `.mod.remove()`, `.mod.approve()`, `subreddit.banned.add`, Modmail via `subreddit.modmail`, …

`submission = reddit.submission("def456")
submission.mod.lock()
comment = reddit.comment("abc123")
comment.mod.remove(spam=False)
comment.mod.approve()
`

Devvit — same choice as comments: prefer
`reddit.*` with fullnames when that covers the
action (`remove`,
`approve`, …). Fetch
`Post` / `Comment` when
you need object-only methods (e.g. `lock`) or several calls on the
same thing — each `getPostById` / `getCommentById` is an extra round trip.

src/server/index.ts — moderate a comment (reddit.* with ids)
`import { context, reddit } from "@devvit/web/server";

const { commentId } = context;
if (!commentId) throw new Error("Run this action on a comment.");

await reddit.remove(commentId, false);
await reddit.approve(commentId);
`

src/server/index.ts — lock post and moderate comment (object methods)
`import { context, reddit } from "@devvit/web/server";

const { commentId } = context;
if (!commentId) throw new Error("Run this action on a comment.");

const comment = await reddit.getCommentById(commentId);
const post = await reddit.getPostById(comment.postId);
await post.lock();
await comment.remove(false);
await comment.approve();
`

More: `RedditClient`,
`ModMailService`. Mod tools often set `permissions.reddit.scope`
to `"moderator"` — permissions.

### 6. Gaps: what your PRAW bot may do that Devvit does not​

PRAWDevvitNotes`redditor.subreddits`, saved, upvoted, friends, …Private user data not availablePublic data onlyInfinite `stream` / open socket to RedditNo in-process stream; short-lived handlersTriggers + scheduler`requests` to any hostAllow-listed `fetch` onlyHTTP fetch; request domains earlyLocal SQLite / arbitrary filesNo general `fs` persistenceRedis; settingsOne bot process across all of Reddit from your VPSPer-installation, hosted appDesign for subreddit-scoped installsYour own OAuth app from prefsPlatform-managed Reddit access`permissions.reddit` in `devvit.json`
Most subreddit moderation and engagement flows you built with PRAW still map cleanly; the shift is event-driven
hosting and installation scope, not relearning Reddit’s content model.

### References​

Devvit

- App quickstart · Mod tool quickstart

- Triggers · Scheduler · Redis · HTTP fetch

- Reddit API overview ·
`RedditClient` · User actions

PRAW

- PRAW documentation
