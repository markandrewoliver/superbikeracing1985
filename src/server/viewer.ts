import { context, reddit } from "@devvit/web/server";

/**
 * Who is making this request, from the request itself.
 *
 * Devvit builds the server `context` from the request's own headers, and two of
 * the fields it puts there are the viewer's handle and Snoovatar URL
 * (`Header.Username`, `Header.UserSnoovatarUrl` — see
 * `@devvit/shared-types/server/base-context.js`). So both are already in hand,
 * for free, on every request. `reddit.getCurrentUsername()` asks Reddit's API for
 * the same string over the network — a round trip that does not belong on the
 * boot path.
 *
 * Both fields are marked `@experimental` in 0.14, and Reddit's own FAQ points at
 * the API client as "the clearest documented path" — so this falls back to it
 * rather than trusting the header blindly. If a host ever stops sending the
 * header, the app gets slower, not wrong.
 */
export async function currentUsername(): Promise<string | undefined> {
  const fromHeader = context.username;
  if (fromHeader) return fromHeader;
  if (!context.userId) return undefined;
  return (await reddit.getCurrentUsername()) ?? undefined;
}

/**
 * The viewer's Snoovatar URL, from the same place. Empty string when they have
 * none (or aren't signed in), matching what `getSnoovatar` returns — callers
 * treat "" as "no avatar". No fallback: an avatar is decoration, and asking
 * Reddit for one is not worth a round trip on the boot path. Look up OTHER
 * people's avatars with `reddit.getSnoovatarUrl`, and cache them.
 */
export function currentSnoovatar(): string {
  return context.snoovatar ?? "";
}
