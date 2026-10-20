/**
 * The wire types, shared by client and server so the two cannot drift.
 *
 * The example game is a per-post counter: everybody who opens the post can
 * press, the post keeps a total, and each reader sees their own count. Replace
 * it — it exists to show the shape of a round trip, a per-post record and a
 * per-player twin (see docs/04-devvit-platform.md → Redis).
 */

/** What every post kind's `postData` carries. Read through `postKind()`. */
export type PostData = { kind: PostKindId };

/** Every post kind this app can create. Add one here, in `POST_KINDS`
 *  (server/postKinds.ts), in devvit.json → forms, and as a route. */
export type PostKindId = "example";

export type InitResponse = {
  postId: string;
  /** The post's total. */
  total: number;
  /** This reader's own presses; 0 when signed out. */
  mine: number;
  /** Null when signed out. */
  username: string | null;
};

export type PressResponse = { total: number; mine: number };

export type ErrorResponse = { status: "error"; message: string };
