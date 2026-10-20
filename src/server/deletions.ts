import { redis } from "@devvit/web/server";
import { keys } from "./keys";

/**
 * Honouring a deletion on Reddit by forgetting it here too.
 *
 * **This is a Devvit Rule, not a nicety.** "On PostDelete and CommentDelete
 * event triggers, you must delete all content related to the post and/or
 * comment (for example, title, body, embedded URLs, etc.) from your app. This
 * includes data that is in the Redis/KVstore." Metadata that only contextualises
 * other content — a post id, a timestamp — may be kept. See
 * docs/devvit/devvit_rules.md.
 *
 * Add a line here for every per-post record that holds anything a person wrote
 * (a title they typed, a comment's text or link, notes).
 *
 * **Idempotent** — a mod removal can also raise `onModAction`, and every step
 * here is a delete. **It fires for removals as well as deletions**, which is
 * the right behaviour: content taken off Reddit should not survive here.
 *
 * Nothing here throws. A failure is logged and the trigger still answers 200,
 * because a non-2xx only makes Devvit retry the same failure.
 */
export async function forgetPost(postId: string): Promise<string[]> {
  const done: string[] = [];
  try {
    // The example's per-post total holds nothing anybody wrote, so strictly it
    // may stay; it is deleted to show the shape.
    await redis.del(keys.total(postId), keys.byUser(postId));
    done.push("example");
  } catch (err) {
    console.error(`[deleted] cleanup for ${postId} failed: ${String(err)}`);
  }
  return done;
}

/**
 * A comment has gone. If anything stores a comment's text or link, match it
 * here. **Match ids by path segment, never by `includes`**: a comment permalink
 * contains the post id too, and short base36 ids are prefixes of one another.
 */
export async function forgetComment(_postId: string, _commentId: string): Promise<string[]> {
  return [];
}
