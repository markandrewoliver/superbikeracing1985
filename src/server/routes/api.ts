import express from "express";
import { context, redis } from "@devvit/web/server";
import type { ErrorResponse, InitResponse, PressResponse } from "../../shared/api";
import { keys } from "../keys";
import { currentUsername } from "../viewer";

/**
 * What the webview calls. The example: a per-post counter.
 *
 * Identity comes from `context` (the request's own headers), never from the
 * client's body. `context.userId` is the signal for "signed in".
 */
export const router = express.Router();

router.get("/api/init", async (_req, res) => {
  const { postId, userId } = context;
  if (!postId) {
    res.status(400).json({ status: "error", message: "no post" } satisfies ErrorResponse);
    return;
  }
  const [total, mine, username] = await Promise.all([
    redis.get(keys.total(postId)),
    userId ? redis.hGet(keys.byUser(postId), userId) : Promise.resolve(undefined),
    currentUsername(),
  ]);
  res.json({
    postId,
    total: Number(total ?? 0),
    mine: Number(mine ?? 0),
    username: username ?? null,
  } satisfies InitResponse);
});

router.post("/api/press", async (_req, res) => {
  const { postId, userId } = context;
  if (!postId || !userId) {
    res.status(401).json({ status: "error", message: "sign in to play" } satisfies ErrorResponse);
    return;
  }
  // Both halves on the same event: the per-post record and the per-player twin.
  const [total, mine] = await Promise.all([
    redis.incrBy(keys.total(postId), 1),
    redis.hIncrBy(keys.byUser(postId), userId, 1),
    redis.hIncrBy(keys.mine(userId), postId, 1),
  ]);
  res.json({ total, mine } satisfies PressResponse);
});
