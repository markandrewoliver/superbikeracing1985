/**
 * The CRT glass's moving part, shared by the React app (components/CrtScreen.tsx)
 * and the game page (game/ui/crt.js). The layers themselves are four spans
 * styled by styles/20-crt.css; see docs/03-crt-filter.md.
 */

/**
 * How often the roll bar comes round, and by how much that wanders.
 *
 * The gap is `--crt-roll-pause`, in seconds, read from the stylesheet rather
 * than fixed here — it belongs with the other dials. This is the fallback for a
 * missing or nonsense value.
 *
 * The wander is a fraction of the gap, so it stays proportional at any setting:
 * never metronomic, because a bar arriving on an exact beat reads as a loop, and
 * the whole point of it is that the tube looks alive rather than looped.
 */
const ROLL_PAUSE_FALLBACK_S = 10;
const ROLL_JITTER = 0.3;

/** The glass's layers, bottom to top. Each is a `span.crt__<name>`. */
export const CRT_LAYERS = ["bloom", "scanlines", "vignette", "roll"] as const;

function rollPauseMs(): number {
  const raw = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--crt-roll-pause"),
  );
  return (Number.isFinite(raw) && raw > 0 ? raw : ROLL_PAUSE_FALLBACK_S) * 1000;
}

/**
 * Sends the roll bar down the `.crt__roll` node every ~10s until the returned
 * function is called.
 */
export function startCrtRoll(node: HTMLElement): () => void {
  // Asked for less motion: the glass stays, the roll does not.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};

  let timer = 0;
  // Taken off at the end so the next add re-triggers the animation. The
  // alternative — removing and forcing a reflow to restart it — is a
  // synchronous layout of the whole document.
  const done = () => node.classList.remove("is-rolling");
  // Re-read on every schedule rather than once: the gap is a dial, and the
  // preview's CRT panel changes it while the tube is running.
  const sweep = () => {
    node.classList.add("is-rolling");
    const pause = rollPauseMs();
    timer = window.setTimeout(sweep, pause + (Math.random() * 2 - 1) * ROLL_JITTER * pause);
  };
  node.addEventListener("animationend", done);
  // The first one is not on the hour either — a post that opened a moment ago
  // should not roll in step with one that has been open all day (a feed can
  // show several posts at once).
  timer = window.setTimeout(sweep, Math.random() * rollPauseMs());
  return () => {
    window.clearTimeout(timer);
    node.removeEventListener("animationend", done);
    node.classList.remove("is-rolling");
  };
}
