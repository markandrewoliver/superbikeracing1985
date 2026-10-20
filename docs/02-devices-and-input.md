# 2. Devices, input and the webview

The post is a **sandboxed, cross-origin iframe inside a feed that holds the
focus**. Almost every input bug comes from forgetting one of those words.

## Who is looking

- **Desktop web** — a fine pointer and a keyboard. Never ask for expanded mode
  here: the desktop host answers with its own "Preview on Devices" modal.
- **Mobile web** — `(pointer: coarse)`. Caught by the media query.
- **Reddit iOS / Android apps** — identify themselves on
  `devvit.context.client.name`.

`isMobile()` in `lib/devvit.ts` checks both. A touchscreen laptop reports a fine
pointer and is treated as desktop, which is right: it has a keyboard.

## Expanded mode

On a phone, the first tap should ask Reddit for the expanded presentation
(`expandOnTap()`, installed once in `App`). Rules:

1. The host only honours it from a **trusted `click`**. A `pointerdown` handler
   can do its own work; the `click` is a separate event and does this.
2. Listen on the **document, in the capture phase**, so a handler that stops
   propagation does not swallow the request.
3. **The request must carry an `entryUrl`.** Omitting it worked on the web
   client and gave a permanently **black post in the Reddit Android app**, on
   every version, because Android loads `entryUrl` and there was nothing to
   load. Resolve it from `devvit.entrypoints["default"]` at the moment of use —
   the URL has a per-session origin.
4. That means expanding **reloads the document**. Anything that must survive it
   has to be on the server already (flushed on a timer and on `pagehide`).
5. The reader can leave expanded mode from Reddit's own chrome; you hear about it
   only via an `immersiveModeEvent` message (`onWebViewModeChange`).
6. Read-only posts (reports, results) and posts where people type prose on the
   OS keyboard should **not** expand — set `inlineOnly` in `App`.

**Debugging a black screen**: put a `position: fixed; z-index: 999999` strip on
the page that repaints a counter four times a second. If *it* goes black too, no
layout fault can explain it — the document on screen is not yours. That one
round trip separates "our page is wrong" from "our page is not being shown".

## Focus

- **`focus()` scrolls the whole subreddit.** Focusing an element in an iframe
  scrolls the top-level document to bring the frame into view, so a post that
  focuses on load drags the reader down the feed, and several posts fight.
  Never focus on mount — only in response to something the reader did — and
  always pass `{ preventScroll: true }`. `autoFocus` is a focus-on-mount.
- **`focus()` on a `visibility: hidden` element is a no-op.** Wait a frame.
- **iOS refuses to focus a hidden field** unless the `focus()` happens inside
  the same gesture. Re-assert focus on `pointerdown`, `pointerup` and
  `touchstart`.
- Tapping non-focusable content blurs what had focus (and takes the phone's
  keyboard with it). Cancel `mousedown` on the container — `mousedown`, not
  `pointerdown`, or you also cancel touch scrolling that starts there.
- **Removing a focused field does not reliably dismiss the OS keyboard.** It
  stays up over the bottom of the post. `blur()` first, then unmount.
- **`inputMode` is read when a field takes focus.** Decide which keyboard a
  screen uses *during render*, never in an effect: a value that settles a render
  late flashes the OS keyboard up and down. To switch a focused field, `blur()`
  then `focus()`; a plain `focus()` on a focused field is a no-op. Catch this
  class of bug by instrumenting `HTMLInputElement.prototype.focus` and recording
  `inputMode` at the call, because the settled DOM looks right either way.

## Keyboards

- The OS keyboard covers the bottom of the post and the frame **cannot see it**
  unless the client reports VirtualKeyboard geometry — Reddit's client does not
  report it to a nested frame. Probing for it costs a visible keyboard swap.
- If a game takes typed input on a phone, an **on-screen keyboard as a row of
  the app column** is the arrangement that works everywhere. Render the keys
  with `components/Key.tsx`:
  - **fire on `pointerdown`**, not `click`. Fast typists roll their fingers: a
    `click` arrives in *release* order, needs press and release on the same
    element, and Chrome stops synthesising clicks once a second touch is down —
    so rolled pairs were **dropped**, not just reordered;
  - still listen for `click` (keyboard and screen-reader activation), ignored
    when a pointer started the press within the last second (a timestamp, not
    `event.detail`);
  - `touch-action: none` on keys stops iOS holding the press for double-tap;
  - only backspace repeats, and only when the handler reads live state (a ref),
    not state captured at render.
- Nothing may be positioned against the viewport bottom on a screen with
  on-screen keys; stop at the top of the keys.
- Mount the keys with **the screen**, never with focus — mounting on focus
  resizes the column out from under the finger already reaching for a button.
- Hidden capture field: a 1px input that holds the real text, with the visible
  UI as its rendering. Set `inputMode="none"` on it when the app's keys are up.

## Links and navigation

- **`target="_blank"` does nothing** in the sandbox; the popup is dropped. Ask
  Reddit to navigate: `navigateTo(url)` in `lib/devvit.ts` (EffectType 5). It
  resolves bare permalinks against `https://www.reddit.com` — Reddit hands those
  back for a post it just created.
- Navigating out of a post shows a "leaving for a third-party site" warning.
  Prefer putting external links in a comment.
- A comment posted from inside a post is invisible to its author (the thread is
  below the frame). Navigate to it after posting. Keep the button in its pending
  state on success — releasing it before the host navigates reads as failure.

## CSP

Reddit serves the webview under
`script-src 'self' webview.devvit.net webview-dev.devvit.net 'wasm-unsafe-eval'`.
**No inline scripts** — they work in local preview and are silently blocked in a
real post. Anything that must run early is a file in `public/`
(`boot-preflight.js`). Inline `<style>` is fine.

## The boot request

Nothing can be fetched until the bundles land. `public/boot-preflight.js` (a
plain ES5 file in the head) fires the first request off `postData.kind` and
leaves the promise on `window.__boot`; `lib/boot.ts` picks it up. Pick the
request **by post kind** — the wrong endpoint costs a second round trip. Every
path must degrade to fetching normally.

## Who is the viewer

`devvit.context.userId / username / snoovatar` are already injected. Read them
with `viewer()` (client) or `currentUsername()` (server). Never fetch them;
`reddit.getCurrentUsername()` is a network round trip for a string you have.
`username`/`snoovatar` are `@experimental` — treat absent as "ask the server",
never as "signed out". **`userId` is the signal for signed in.**

A signed-out reader is the same experience with a different record, not a
different experience. Every difference beyond "cannot comment", "is not a mod"
and "progress is local" has historically been a bug.

## Storage

**`localStorage` is scoped to an origin that changes with every app version.**
An install hands every reader an empty bucket. So:

- anything that must survive a deploy lives in Redis;
- `localStorage` is the second copy (fast first answer, and all a logged-out
  reader has), never the only one;
- read it one way only: a **present** flag can be trusted, an **absent** one
  proves nothing — never *show* something (an onboarding gate) on the strength
  of a missing local flag, or every install puts it in front of everybody.

## Testing input for real

`npm run test:input` presses with the browser's own input pipeline on Chromium,
Firefox, WebKit and mobile WebKit, **headless** (an unfocused window is what an
untouched post is), inside `embed.html` (cross-origin iframe, focus held by the
page). Assert what the reader can see, not that a handler ran. Playwright's
WebKit is not Mobile Safari: test on a real phone before shipping input changes.
