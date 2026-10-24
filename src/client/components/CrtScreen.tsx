import { useEffect, useRef } from "react";
import { CRT_LAYERS, startCrtRoll } from "../lib/crtGlass";

/**
 * The CRT glass, laid over the whole app. Mount it **once**, in `App`, outside
 * the routing, so no screen can forget it. See `docs/03-crt-filter.md`. (The
 * game page, which is not React, lays the same glass over its screen:
 * `game/ui/crt.js`.)
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
    return node ? startCrtRoll(node) : undefined;
  }, []);

  return (
    <div className="crt" aria-hidden="true">
      {CRT_LAYERS.map((k) => (
        <span key={k} className={`crt__${k}`} ref={k === "roll" ? roll : undefined} />
      ))}
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
