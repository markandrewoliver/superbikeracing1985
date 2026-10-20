import express from "express";
import { context } from "@devvit/web/server";
import type { UiResponse } from "@devvit/web/shared";
import { dueNow, syncCrons } from "../cron";
import { forgetComment, forgetPost } from "../deletions";
import { chooseKindForm, postKindByValue } from "../postKinds";
import { createPost } from "../posts";
import type { PostKindId } from "../../shared/api";

/**
 * Devvit's own entry points: the menu row, the forms behind it, triggers and
 * scheduled tasks. Every path here is named in `devvit.json`.
 *
 * **Answer 200 and log, always.** Reddit renders a non-2xx from a menu or form
 * handler as its own "Something went wrong" and discards the `showToast` you
 * wrote — so a handler that refuses with a 400 and a perfectly good
 * explanation tells the moderator nothing, and with no `console.error` beside
 * it `npx devvit logs` is empty too. `showToast` is the error channel here.
 */
export const router = express.Router();

/** Read a form field, whichever shape the host sends it in. */
function field(body: unknown, name: string): string {
  const b = (body ?? {}) as Record<string, unknown> & { values?: Record<string, unknown> };
  const raw = b[name] ?? b.values?.[name];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" ? v.trim() : "";
}

/** The one menu row → the chooser. See postKinds.ts for why it is one row. */
router.post("/internal/menu/create", async (_req, res) => {
  const response: UiResponse = { showForm: { name: "chooseKind", form: chooseKindForm() } };
  res.json(response);
});

/** Chooser submit → the chosen kind's own form. */
router.post("/internal/forms/choose-kind", async (req, res) => {
  const value = field(req.body, "kind");
  const kind = postKindByValue(value);
  if (!kind) {
    console.error(`[menu] no post kind called "${value}"`);
    res.json({ showToast: `No post kind called "${value}".` });
    return;
  }
  try {
    const response: UiResponse = { showForm: { name: kind.formName, form: await kind.form() } };
    res.json(response);
  } catch (err) {
    console.error(`[menu] could not build the ${kind.value} form: ${String(err)}`);
    res.json({ showToast: `Could not open that form: ${String(err)}` });
  }
});

/**
 * A kind's form → the post. Every "create a post" form ends the same way; the
 * kind is the only difference, so it is a parameter.
 */
async function postFromForm(req: express.Request, res: express.Response, kind: PostKindId) {
  const { subredditName } = context;
  if (!subredditName) {
    console.error("[menu] no subreddit in context");
    res.json({ showToast: "Could not determine the subreddit." });
    return;
  }
  const title = field(req.body, "title");
  if (!title) {
    res.json({ showToast: "Give the post a title." });
    return;
  }
  try {
    const { url } = await createPost(subredditName, kind, title);
    // Navigating to the post is the confirmation.
    res.json({ navigateTo: url });
  } catch (err) {
    console.error(`[menu] create ${kind} post failed: ${String(err)}`);
    res.json({ showToast: `Failed to create post: ${String(err)}` });
  }
}

router.post("/internal/forms/new-race", (req, res) => postFromForm(req, res, "race"));
router.post("/internal/forms/new-example", (req, res) => postFromForm(req, res, "example"));

/**
 * Scheduled task. Wakes hourly at its planned minute (see cron.ts) and asks
 * `dueNow` whether this is the planned Eastern hour and weekday. **Never test
 * the clock here directly.**
 */
router.post("/internal/scheduler/example-post", async (_req, res) => {
  try {
    const due = await dueNow("examplePost");
    if (!due.ok) {
      res.json({ posted: false, reason: due.reason });
      return;
    }
    const { subredditName } = context;
    if (!subredditName) throw new Error("no subreddit in context");
    // Dedupe on a date key here if a post must go out at most once a day.
    const post = await createPost(subredditName, "example", "Example post");
    console.log(`[scheduler] examplePost posted ${post.id}`);
    res.json({ posted: true, id: post.id });
  } catch (err) {
    console.error(`[scheduler] examplePost failed: ${String(err)}`);
    res.json({ posted: false, error: String(err) });
  }
});

/** Install and upgrade: make the installation's cron jobs match the plan. */
router.post("/internal/triggers/installed", async (_req, res) => {
  try {
    res.json(await syncCrons());
  } catch (err) {
    console.error(`[cron] sync on install failed: ${String(err)}`);
    res.json({ error: String(err) });
  }
});

/** A post was deleted or removed. Required by the Devvit Rules — see deletions.ts. */
router.post("/internal/triggers/post-deleted", async (req, res) => {
  try {
    const body = req.body as { postId?: unknown } | undefined;
    const postId = typeof body?.postId === "string" ? body.postId : "";
    if (!postId) {
      console.error("[deleted] post trigger with no postId");
      res.json({ ok: false });
      return;
    }
    const cleared = await forgetPost(postId);
    console.log(`[deleted] post ${postId}: ${cleared.join(", ") || "nothing of ours"}`);
    res.json({ ok: true, cleared });
  } catch (err) {
    console.error(`[deleted] post trigger failed: ${String(err)}`);
    res.json({ ok: false });
  }
});

/** A comment was deleted or removed. */
router.post("/internal/triggers/comment-deleted", async (req, res) => {
  try {
    const body = req.body as { postId?: unknown; commentId?: unknown } | undefined;
    const postId = typeof body?.postId === "string" ? body.postId : "";
    const commentId = typeof body?.commentId === "string" ? body.commentId : "";
    if (!postId || !commentId) {
      console.error("[deleted] comment trigger with no ids");
      res.json({ ok: false });
      return;
    }
    const cleared = await forgetComment(postId, commentId);
    res.json({ ok: true, cleared });
  } catch (err) {
    console.error(`[deleted] comment trigger failed: ${String(err)}`);
    res.json({ ok: false });
  }
});
