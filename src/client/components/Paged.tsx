import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/* Defaults only — override with `upLabel` / `downLabel` (player-facing copy). */
const DOWN_LABEL = "Down";
const UP_LABEL = "Up";

/**
 * A list that pages instead of scrolling.
 *
 * **Nothing in an inline post may scroll.** Reddit's review is explicit — a
 * scrollable web view swallows the gestures the feed needs, and the guidance is
 * "use buttons to navigate or take the user to Expanded Mode". In a failure
 * case, clip some content rather than add a vertical scrollbar; `check:crop`
 * enforces the half of that about things being out of reach.
 *
 * So this shows exactly what fits and moves a whole viewport at a time: a
 * full-width button under the list while there is more below, and one above it
 * once the reader has moved down.
 *
 * ## Why it is a transform and not a scroll
 *
 * The obvious build is `scrollTop`, which is a scroll — the container is still
 * scrollable, the gesture is still swallowed, and `check:crop` still finds a
 * scrollable ancestor. This keeps `overflow: hidden` and **translates the
 * content**, so there is no scroll container anywhere in the tree and a drag
 * over the list belongs to the feed, as it should.
 *
 * ## Two measurements, and both have to be live
 *
 * The viewport is whatever the row leaves (`flex: 1 1 0`), and the content is
 * whatever the host happens to hold — a table, a list, an empty state. Both change: tabs switch, a fetch lands, a face loads. A `ResizeObserver`
 * on each is what keeps the page count honest, and the page is clamped whenever
 * it would land past the end — otherwise switching from a long tab to a short
 * one leaves the reader looking at blank space with no way back.
 */

/**
 * The tallest clean cut that fits: the lowest line-box bottom at or above
 * `room`, measured from the top of `el`'s own content.
 *
 * **Asked as "where do the lines end", not "how tall is a line".** Two earlier
 * answers are both wrong, and in opposite directions. The computed
 * `line-height` is not the laid-out box — one measured case computed 16.5px and
 * laid out at 18.93, because a line box is the strut *and* whatever the inline content
 * asks for. And the smallest gap between box tops is the gap *inside* a wrapped
 * paragraph, which is shorter than the one between paragraphs, so snapping to
 * it cut the wrapped line in half instead.
 *
 * A `Range` over the contents reports the boxes as they were laid out, so this
 * needs to know nothing about the markup: it works for one paragraph per line,
 * for a line that wraps to two boxes, and for anything else a host pages.
 *
 * Returns 0 when there is nothing to measure or when not even one line fits,
 * which the caller reads as "page the ordinary way" — a page that cannot show
 * a line is worse than one that shows a clipped one.
 */
function cleanCut(el: HTMLElement, room: number): number {
  if (typeof document.createRange !== "function") return 0;
  const r = document.createRange();
  r.selectNodeContents(el);
  const rects = Array.from(r.getClientRects());
  r.detach?.();
  /* The element's own top, so this is measured in the inner's coordinates and
     is unaffected by however far the page has already been translated. */
  const origin = el.getBoundingClientRect().top;
  let best = 0;
  for (const box of rects) {
    if (box.height <= 0) continue;
    const bottom = box.bottom - origin;
    if (bottom <= room + 0.5 && bottom > best) best = bottom;
  }
  return best;
}

export function Paged({
  children,
  className,
  snapLines,
  upLabel = UP_LABEL,
  downLabel = DOWN_LABEL,
}: {
  children: ReactNode;
  /** The host's own class, so this can *be* the body rather than wrap one. */
  className?: string;
  /**
   * Cut between lines, never through one.
   *
   * **The overlap below is deliberate and stays the default.** A list of rows
   * cut exactly at the fold gives a reader no way to tell that is what
   * happened, so keeping a sliver of the next row visible is what makes the
   * move read as continuing rather than as jumping. Right for lists of rows.
   *
   * Verse or prose set as a page is the case it is wrong for. A half-line is not a hint that there is
   * more; it is a line of verse with its descenders shaved off, on a page whose
   * whole subject is the lines. So this snaps both the viewport and the step
   * down to a whole number of line boxes and drops the overlap entirely.
   *
   * It snaps to the **computed line-height** rather than to a row's own height,
   * which is what makes it right when a line wraps: a wrapped line is two line
   * boxes tall, and a cut between boxes is clean wherever it falls.
   */
  snapLines?: boolean;
  /** The two buttons' labels. Player-facing copy: supply your own. */
  upLabel?: string;
  downLabel?: string;
}) {
  const view = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [step, setStep] = useState(0);
  /* The viewport's own height when it is snapped to whole lines; 0 when it is
     not, which leaves the flex row to size it as it always did. */
  const [clip, setClip] = useState(0);
  /* **What was last published, so a re-measure that lands on the same answer
     publishes nothing.** `measure` runs on every render (no dependency array,
     deliberately — see the layout effect below), and it *writes* a `maxHeight`
     that resizes the very element it measures. On a sheet that lies at an angle
     the rect-derived cut comes back a fraction different each pass, so without
     this the component set state, re-rendered, measured, set state again — React
     stops that with "Maximum update depth exceeded" and unmounts the tree,
     which in a post is a black screen. Rounded to whole pixels and
     compared before publishing: the measurement converges instead of ringing. */
  const last = useRef({ step: 0, pages: 1, clip: 0 });

  /** Set state only where it actually moved, so a stable measurement is a
   *  no-op rather than another render. */
  const publish = useCallback((nextStep: number, nextPages: number, nextClip: number) => {
    const was = last.current;
    if (Math.abs(was.step - nextStep) > 0.5) { was.step = nextStep; setStep(nextStep); }
    if (was.pages !== nextPages) { was.pages = nextPages; setPages(nextPages); }
    if (Math.abs(was.clip - nextClip) > 0.5) { was.clip = nextClip; setClip(nextClip); }
  }, []);

  const measure = useCallback(() => {
    const v = view.current;
    const c = inner.current;
    if (!v || !c) return;
    /* **Measured with the clamp off.** `snapLines` puts a `maxHeight` on this
       element, so reading it while that is applied answers with the clamp
       rather than with the room — and the view could then never notice the
       frame growing. Cleared, read, put back: one forced layout, in a layout
       effect, only when something resized. */
    const held = v.style.maxHeight;
    if (held) v.style.maxHeight = "";
    const room = v.clientHeight;
    if (held) v.style.maxHeight = held;
    const tall = c.scrollHeight;
    if (room <= 0) return;

    if (snapLines) {
      /* **The line box, measured — not the computed `line-height`.** Those are
         not the same number and trusting the second is what left a line still
         clipped: a computed 16.5px line-height laid out at 18.93, because a
         block's line box is the strut *and* whatever the inline content needs. A
         `Range` over the contents answers with the boxes as laid out, which is
         the only thing a clean cut can be measured against — and it is right
         for wrapped lines too, where one paragraph is two boxes. */
      const vis = Math.floor(cleanCut(c, room));
      if (vis > 0) {
        publish(vis, Math.max(1, Math.ceil(Math.max(0, tall - vis) / vis) + 1), vis);
        return;
      }
    }
    /* **A page is the viewport less an overlap**, not the whole viewport: a row
       cut exactly at the fold would be half on one page and half on the next,
       and a reader has no way to tell that is what happened. Keeping a sliver
       of the previous page visible is what makes the move read as continuing
       rather than as jumping. */
    const overlap = Math.min(28, room * 0.12);
    const s = Math.max(1, room - overlap);
    publish(s, Math.max(1, Math.ceil(Math.max(0, tall - room) / s) + 1), 0);
  }, [snapLines, publish]);

  /* Layout effect, so the first paint already knows whether a button is needed
     — an ordinary effect draws the list once without it and then adds one,
     which moves everything under it by a button's height. */
  useLayoutEffect(measure);

  useEffect(() => {
    const v = view.current;
    const c = inner.current;
    if (!v || !c || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    ro.observe(c);
    return () => ro.disconnect();
  }, [measure]);

  /* Clamped rather than reset: a tab change that shortens the list should leave
     the reader as far down as still exists, not throw them back to the top. */
  useEffect(() => {
    setPage((p) => Math.min(p, pages - 1));
  }, [pages]);

  const at = Math.min(page, pages - 1);
  const more = at < pages - 1;

  return (
    <div className={`paged${className ? ` ${className}` : ""}`}>
      {at > 0 && (
        <button
          className="paged__step paged__step--up"
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          <span aria-hidden="true">▲</span> {upLabel}
        </button>
      )}
      {/* `overflow: hidden`, never `auto`: the whole point is that this is not a
          scroll container. Anything past the fold is reached by the buttons. */}
      <div
        className="paged__view"
        ref={view}
        style={clip ? { maxHeight: `${clip}px` } : undefined}
      >
        <div
          className="paged__inner"
          ref={inner}
          style={{ transform: `translateY(${-at * step}px)` }}
        >
          {children}
        </div>
      </div>
      {more && (
        <button
          className="paged__step paged__step--down"
          type="button"
          onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
        >
          <span aria-hidden="true">▼</span> {downLabel}
        </button>
      )}
    </div>
  );
}
