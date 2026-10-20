import { reddit } from "@devvit/web/server";
import type { PostData, PostKindId } from "../shared/api";

/**
 * Create a post of a given kind. Every post kind goes through here, so
 * `postData` always has the shape `postKind()` reads on the client.
 *
 * **`postData` is readable from the post.** Never put an answer in it in plain
 * text — obfuscate it, or keep it in Redis keyed by post id.
 *
 * Posts are made by the **app account** (u/<your-app>). `runAs: "USER"` posts as
 * the player instead, needs `permissions.reddit.asUser` in devvit.json, and
 * only works on an **approved** version: on an unapproved one it silently
 * posts as the app account for everyone except the app's owner.
 *
 * If a list of posts of this kind will ever be needed ("show me every event"),
 * write an index here now. Devvit's Redis has no key scan, so an index started
 * later is empty for everything already posted.
 */
export async function createPost(
  subredditName: string,
  kind: PostKindId,
  title: string,
): Promise<{ id: string; url: string }> {
  const postData: PostData = { kind };
  const post = await reddit.submitCustomPost({ subredditName, title, postData });
  return { id: post.id, url: post.url };
}
