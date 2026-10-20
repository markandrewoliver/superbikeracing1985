import { COPY, type CopyKey } from "../lib/copy";

/**
 * A player-facing string from `lib/copy.ts`, or a visibly empty slot when
 * nobody has written it yet. The slot is the point: an empty box gets noticed
 * and filled; plausible filler gets shipped.
 */
export function Copy({ k }: { k: CopyKey }) {
  const text = COPY[k];
  if (text) return <>{text}</>;
  return <span className="todo-copy" data-copy={k} aria-label={`[${k}]`} />;
}
