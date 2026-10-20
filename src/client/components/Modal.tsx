import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A card over the whole screen, on the viewport.
 *
 * **Portalled, always.** It is `position: fixed`, and a fixed element is laid
 * out against the nearest ancestor carrying a transform or a filter rather than
 * against the viewport — so a dialog rendered where its button sits inherits
 * whatever happens to contain that button. The classic way to get bitten: the
 * button lives in a card whose children animate in with `animation: ... both`,
 * and `both` leaves the final transform on the element for good, so the dialog
 * comes out sized to the card and centred off the bottom of the screen.
 *
 * Rendering into `.crt-screen` puts it back on the viewport and keeps it inside
 * the tube's type glow; `<body>` is the fallback for a host with no glass.
 *
 * The scrim is what makes it a modal rather than a panel: whatever it is over
 * is covered, not pushed down.
 */
export function Modal({
  label,
  children,
  onScrim,
  card,
}: {
  /** Names the dialog for a screen reader. */
  label?: string;
  children: ReactNode;
  /** The card's classes, when it is not the plain box. */
  card?: string;
  /** Pressing the scrim, when there is something for it to do. A modal with no
   * dismissable state leaves this out and the scrim is inert. */
  onScrim?: () => void;
}) {
  /* Resolved once: the host is a fixed part of the page, not something that
     moves under the dialog. */
  const [host] = useState<HTMLElement>(
    () => (document.querySelector(".crt-screen") as HTMLElement | null) ?? document.body,
  );

  return createPortal(
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (e.target === e.currentTarget) onScrim?.();
      }}
    >
      <div className={card ?? "modal__card"}>{children}</div>
    </div>,
    host,
  );
}
