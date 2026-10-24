
/**
 * How much of this webview is actually on screen.
 *
 * The post is an iframe, and the frame can be taller than the area the host
 * shows it in: in Reddit's expanded presentation on mobile web the modal is
 * sized past the bottom of the visible page, so the last ~50px of the frame —
 * `100dvh` and all — are below the fold. Anything the app pins to the bottom of
 * the viewport (the on-screen keyboard) is then cut off, which is exactly how it
 * shipped: only two of the three key rows were reachable.
 *
 * An iframe is not told it is clipped, but it can measure it: an
 * IntersectionObserver with a null root measures against the TOP-LEVEL viewport
 * and is clipped by every frame in between, so a probe as tall as the frame
 * reports back how much of itself is visible.
 *
 * The probe is `position: fixed` and sized in `dvh`, so its own height never
 * depends on the app's layout — otherwise shrinking the app to the measured
 * height would change the measurement and oscillate.
 */

/** The slice of the VirtualKeyboard API this needs. Not in TypeScript's DOM lib
 * at this version, and `navigator.virtualKeyboard` is absent on plenty of
 * clients, so it is read off navigator rather than declared globally. */
type VirtualKeyboardLike = {
  overlaysContent: boolean;
  boundingRect: DOMRectReadOnly;
  addEventListener: (type: "geometrychange", fn: () => void) => void;
  removeEventListener: (type: "geometrychange", fn: () => void) => void;
};

/** Fired on `window` each time `--vis-h` changes. */
export const VIS_H_EVENT = "vis-h";

/** The visible height in px: `--vis-h` once measured, the window's until then. */
export function visibleHeight(): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--vis-h"));
  return v > 0 ? Math.min(v, window.innerHeight) : window.innerHeight;
}

/** ~1% steps, so a change of a few px reports rather than waiting for 0. */
const THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

/**
 * Measures the visible height and keeps `--vis-h` up to date on the root element,
 * so every screen inherits it — including anything portalled out to `<body>`,
 * which no ancestor style would reach.
 * Returns a cleanup function. A no-op (leaving `--vis-h` unset, so everything
 * falls back to `100dvh`) where IntersectionObserver is missing.
 */
export function trackVisibleHeight(): () => void {
  const host = document.documentElement;
  if (typeof IntersectionObserver === "undefined") return () => {};

  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:100dvh;pointer-events:none;visibility:hidden";
  probe.setAttribute("aria-hidden", "true");
  document.body.appendChild(probe);

  let last = -1;
  let framePx = 0;                       // the frame's own visible slice
  let keyboardTop = Infinity;            // where the on-screen keyboard starts
  const apply = (px: number) => {
    // Round to 2px: the URL bar sliding produces a stream of sub-pixel changes,
    // and each one would re-lay-out the app.
    const v = Math.round(px / 2) * 2;
    if (v === last || v <= 0) return;
    last = v;
    host.style.setProperty("--vis-h", `${v}px`);
    // A page that sizes itself in script (the game's canvas) hears it here: the
    // reading can change with no resize event at all (the frame scrolled
    // further under the host's chrome).
    window.dispatchEvent(new Event(VIS_H_EVENT));
  };

  /**
   * The smaller of the two things that can take height away: the frame being
   * clipped by the host, and the visual viewport shrinking. The second is the
   * on-screen keyboard's doing — the OS keyboard covers the bottom of the post,
   * footer and all. Where a nested frame is not
   * told about it, `visualViewport` simply matches the frame and this is the
   * clipping measurement alone.
   */
  const publish = () => {
    const vv = window.visualViewport?.height ?? Infinity;
    const px = Math.min(framePx || Infinity, vv > 0 ? vv : Infinity, keyboardTop);
    if (Number.isFinite(px)) apply(px);
  };

  const io = new IntersectionObserver(
    (entries) => {
      framePx = entries[entries.length - 1]!.intersectionRect.height;
      publish();
    },
    { threshold: THRESHOLDS },
  );
  io.observe(probe);

  // Thresholds only fire on a crossing; these are the moments the frame's own
  // geometry changes and a fresh reading is needed regardless.
  const remeasure = () => {
    publish();                           // the viewport half needs no observer
    io.unobserve(probe);
    io.observe(probe);
  };
  window.addEventListener("resize", remeasure);
  window.visualViewport?.addEventListener("resize", remeasure);
  // The keyboard opening also scrolls the visual viewport; its height can settle
  // a frame later than the resize.
  window.visualViewport?.addEventListener("scroll", remeasure);
  // Coming back to the app is the other moment the reading can be stale without
  // anything having resized: leaving dismisses the phone's keyboard, and a
  // keyboard that went away while we were not looking would otherwise keep the
  // app short until the next resize.
  window.addEventListener("focus", remeasure);
  window.addEventListener("pageshow", remeasure);
  document.addEventListener("visibilitychange", remeasure);

  /**
   * The third thing that takes height away, and the only one with an API of its
   * own: the OS keyboard. It covers the bottom of the post, footer and all.
   * `visualViewport` is no help — inside a frame it describes the frame — but
   * the VirtualKeyboard API reports the keyboard's rectangle in the frame's own
   * coordinates, so `top` is where the usable area ends.
   *
   * This is a measurement, not a policy: where a client reports it the column
   * shrinks around whatever keyboard is up, and where it does not nothing
   * changes. **Nothing should decide which keyboard a screen uses from it**: Reddit's
   * own clients do not report it to a nested frame, so a screen that types on a
   * phone in the expanded post should use the app's own keys (`Key.tsx`) — the
   * arrangement that works on every client rather than on the ones that answer.
   * See docs/02-devices-and-input.md.
   *
   * It has to be opted into: `boundingRect` stays empty until `overlaysContent`
   * is set, which also tells the browser not to reflow anything itself, because
   * we are doing it here. Absent (older clients, or a client that withholds it
   * from a nested frame) this stays Infinity and nothing changes.
   */
  const vk = (navigator as { virtualKeyboard?: VirtualKeyboardLike }).virtualKeyboard;
  const onGeometry = () => {
    const r = vk?.boundingRect;
    const up = !!r && r.height > 0;
    keyboardTop = up ? r!.top : Infinity;
    publish();
  };
  if (vk) {
    try {
      vk.overlaysContent = true;
      vk.addEventListener("geometrychange", onGeometry);
    } catch {
      /* Present but not usable here — leave the keyboard out of the measurement. */
    }
  }

  return () => {
    try {
      vk?.removeEventListener("geometrychange", onGeometry);
    } catch {
      /* nothing to undo */
    }
    window.removeEventListener("resize", remeasure);
    window.visualViewport?.removeEventListener("resize", remeasure);
    window.visualViewport?.removeEventListener("scroll", remeasure);
    window.removeEventListener("focus", remeasure);
    window.removeEventListener("pageshow", remeasure);
    document.removeEventListener("visibilitychange", remeasure);
    io.disconnect();
    probe.remove();
    host.style.removeProperty("--vis-h");
  };
}
