import { useEffect, useRef, type ReactNode } from "react";

/**
 * One key on an on-screen keyboard.
 *
 * **A key fires on the way down, not on the way up.** Every OS keyboard does,
 * and it is not a matter of feel: a `click` only exists if the press and the
 * release land on the same element, and its *order* is the order of the
 * releases. Someone typing quickly rolls their fingers — the second key goes
 * down before the first comes up — so a release-ordered keyboard delivers the
 * letters in whatever order the fingers happened to lift — reported as
 * "it gets jumbled when I type fast". Chrome also stops synthesising clicks once
 * a second touch is down, so a rolled pair can be silently dropped altogether. It also drops a key outright when a
 * finger slides a few pixels off it before lifting, and on iOS a second tap in
 * the same place inside the double-tap window can be swallowed altogether.
 * Pressing on `pointerdown` makes each finger independent of every other one
 * and of its own release.
 *
 * A click is still listened for, because it is the only thing a keyboard or a
 * screen reader produces — but only when no pointer started it, or every touch
 * would type twice. The window is a timestamp rather than `event.detail`, which
 * is 0 for a keyboard activation on paper and not reliably 1 for a touch one.
 *
 * `repeat` is the hold: the same wait every phone gives you before a held
 * backspace starts running, then an interval that ramps from a readable pace to
 * a fast one, so a short hold nudges and a long one clears the line. Only ever
 * given to backspace — a letter key that repeated would fill a field with one
 * character the moment somebody rested a thumb on it.
 */

/** Held this long before a repeat starts — near Android's own initial delay,
 * and long enough that an ordinary press cannot trigger one. */
const REPEAT_DELAY_MS = 400;
/** The first repeats, spaced so a short hold deletes a word rather than a line. */
const REPEAT_SLOW_MS = 90;
/** Where it ends up, and how long it takes to get there. */
const REPEAT_FAST_MS = 22;
const REPEAT_RAMP_MS = 1000;
/** A click this soon after a pointer press is that press's own click. */
const POINTER_CLICK_MS = 1000;

export function Key({
  className,
  label,
  pressed,
  disabled,
  repeat,
  onPress,
  children,
}: {
  className: string;
  /** aria-label, when the glyph on the key is not the name of it. */
  label?: string;
  /** aria-pressed, for a key with a state — shift. */
  pressed?: boolean;
  /** Refuses presses, and says so, without leaving the row a gap. */
  disabled?: boolean;
  /** Hold to repeat. Backspace only. */
  repeat?: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  // Read at fire time rather than captured: a repeat outlives the render that
  // started it, and the press has to act on the state as it stands now.
  const press = useRef(onPress);
  press.current = onPress;
  const off = useRef(disabled);
  off.current = disabled;

  const timer = useRef(0);
  const pointerAt = useRef(0);

  const stop = useRef(() => {});
  stop.current = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = 0;
    }
  };
  useEffect(() => () => stop.current(), []);

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    // A right- or middle-click is not a key press.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    /* Keeps whatever field the keys type into focused — a button that took
       focus would blur it on every press — and, on a touchscreen, stops the
       press starting a text selection or a callout. */
    e.preventDefault();
    pointerAt.current = performance.now();
    if (off.current) return;
    press.current();
    if (!repeat) return;

    const began = performance.now();
    const tick = () => {
      if (off.current) return;
      press.current();
      const held = performance.now() - began;
      const gap =
        REPEAT_SLOW_MS -
        (REPEAT_SLOW_MS - REPEAT_FAST_MS) * Math.min(1, held / REPEAT_RAMP_MS);
      timer.current = window.setTimeout(tick, gap);
    };
    timer.current = window.setTimeout(tick, REPEAT_DELAY_MS);
    /* The release can land anywhere — a held finger drifts off the key, and a
       pointer that leaves the window never returns an event to it at all — so
       the end of the hold is watched for on the window rather than on the key.
       `once` on each, and the pair are cheap enough to add per press. */
    const end = () => {
      stop.current();
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      onPointerDown={down}
      /* Sliding off ends a hold, the way it does on a phone: the finger has
         left the key, so it is no longer being held down. */
      onPointerLeave={() => stop.current()}
      onPointerUp={() => stop.current()}
      onPointerCancel={() => stop.current()}
      onClick={() => {
        // Already handled on the way down. What reaches here otherwise is Enter
        // or Space on a focused key, which is how a keyboard presses one.
        if (performance.now() - pointerAt.current < POINTER_CLICK_MS) return;
        if (off.current) return;
        press.current();
      }}
    >
      {children}
    </button>
  );
}
