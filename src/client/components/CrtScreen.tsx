import { useEffect, useRef } from "react";

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

function rollPauseMs(): number {
  const raw = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--crt-roll-pause"),
  );
  return (Number.isFinite(raw) && raw > 0 ? raw : ROLL_PAUSE_FALLBACK_S) * 1000;
}

/**
 * The CRT glass, laid over the whole app. Mount it **once**, in `App`, outside
 * the routing, so no screen can forget it. See `docs/03-crt-filter.md`.
 *
 * Four composited layers, none of which blends, filters or reads back:
 *
 *  - **bloom**     an inset box-shadow — the lit rim of the tube.
 *  - **scanlines** a soft dark band every other CSS pixel.
 *  - **vignette**  the corners falling away.
 *  - **roll**      a band of stronger scanlines drifting down every ~10s.
 *
 * The type's **glow** and **chromatic bleed** are not layers at all: they are a
 * `text-shadow` on `.crt-screen` (the wrapper the app renders inside), built
 * from the `--crt-type-shadow` token.
 *
 * Two layers that a CRT bench would have — the aperture grille and animated
 * noise — are deliberately absent. In their original form (`mix-blend-mode`,
 * `feTurbulence`, `filter: url()`, `backdrop-filter`) they crashed Firefox's
 * GPU process and Safari on older iPads. Do not add them back without testing
 * on that hardware.
 *
 * **Curve is deliberately absent too.** Barrel distortion moves the picture
 * without moving the hit targets, so a button stops being where it looks.
 */
export function CrtScreen() {
  const roll = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const node = roll.current;
    if (!node) return undefined;
    // Asked for less motion: the glass stays, the roll does not.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

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
  }, []);

  return (
    <div className="crt" aria-hidden="true">
      <span className="crt__bloom" />
      <span className="crt__scanlines" />
      <span className="crt__vignette" />
      <span className="crt__roll" ref={roll} />
    </div>
  );
}

/**
 * Turn the tube up for a moment — a timer running out, a big hit. Writes the
 * dials on `:root`, so whatever the stylesheet (or the preview's panel) has
 * them at is what it returns to. `shake` is 0..1 and drives `.is-crt-shaking`.
 *
 * Returns a function that restores the resting values. Every path that ends
 * the effect (unmount, screen change) must call it, or the tube stays turned up
 * for the whole app.
 */
export function crtSurge(dials: { vignette?: number; glow?: number; shake?: number }): () => void {
  const root = document.documentElement;
  const prev = {
    vignette: root.style.getPropertyValue("--crt-vignette"),
    glow: root.style.getPropertyValue("--crt-glow"),
    shake: root.style.getPropertyValue("--crt-shake"),
  };
  if (dials.vignette != null) root.style.setProperty("--crt-vignette", String(dials.vignette));
  if (dials.glow != null) root.style.setProperty("--crt-glow", String(dials.glow));
  if (dials.shake != null) {
    root.style.setProperty("--crt-shake", String(dials.shake));
    root.classList.toggle("is-crt-shaking", dials.shake > 0);
  }
  return () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v) root.style.setProperty(`--crt-${k}`, v);
      else root.style.removeProperty(`--crt-${k}`);
    }
    root.classList.remove("is-crt-shaking");
  };
}
