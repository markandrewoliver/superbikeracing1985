/**
 * Every Redis key name, in one place.
 *
 * - Version the key (`:v1`) when the *meaning* of a stored value changes, and
 *   do not read the old one forward.
 * - Keys are namespaced per installation: dev and prod share nothing.
 *   `redis.global` is refused unless Reddit grants it per app, and fails with
 *   `FAILED_PRECONDITION` — do not build on it.
 * - There is no SCAN/KEYS: anything you will want to list needs an index
 *   written at the same time as the record.
 * - Anything a player can delete ("delete my data") must be reachable from the
 *   player's own keys, or it is stranded.
 */
export const keys = {
  /** Per post: the total. */
  total: (postId: string) => `example:${postId}:total:v1`,
  /** Per post: userId → their count. */
  byUser: (postId: string) => `example:${postId}:byuser:v1`,
  /** Per player twin, so "how did I do across every post" is one read. */
  mine: (userId: string) => `example:mine:v1:${userId}`,
};
