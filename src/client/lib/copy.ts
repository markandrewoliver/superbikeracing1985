/**
 * Every player-facing string, in one place.
 *
 * **Left blank on purpose.** Copy that arrives in a template reads as approved
 * once it is on screen, and then it ships. Fill these in for your game; until
 * then each one renders as a visibly empty slot (`.todo-copy`) rather than as
 * plausible filler. See docs/07-content-and-review.md.
 */
export const COPY = {
  /** The post's heading. */
  title: "",
  /** The one button. */
  press: "",
  /** Label beside the post's total. */
  totalLabel: "",
  /** Label beside the reader's own count. */
  mineLabel: "",
  /** Shown when a request fails. */
  error: "",
} as const;

export type CopyKey = keyof typeof COPY;
