/**
 * Navigate the Devvit webview to a URL (e.g. a freshly created post).
 *
 * This mirrors `@devvit/client`'s `navigateTo`, but posts the effect message to
 * the parent window directly instead of importing it. Under this repo's single
 * tsconfig — which type-checks the server too, so it can't use the `browser`
 * export condition — `@devvit/web/client` resolves to the "client code in the
 * server" panic stub and exports nothing. Reading/writing the Devvit bridge off
 * the window (as App.tsx already does for the context) keeps the type-check
 * happy while still working at runtime inside the webview.
 */
export function navigateTo(url: string, opts?: { newTab?: boolean }): void {
  let normalized: string;
  try {
    // Resolved against Reddit, so a bare permalink ("/r/sub/comments/…") works:
    // that is the shape Reddit's own API hands back for a post it just created,
    // and an unresolvable string used to make this a silent no-op — a Publish
    // that posted the tutorial and then appeared to do nothing.
    normalized = new URL(url, "https://www.reddit.com").toString();
  } catch {
    return;
  }
  /**
   * The exact shape `@devvit/client`'s `emitEffect` posts for a navigate effect
   * (EffectType 5, CLIENT scope 0), with the legacy `effect` mirror it also
   * sets — **plus `target`, which the SDK's own wrapper never sends.**
   *
   * `NavigateToUrlEffect` in `@devvit/protos` is `{ url, target? }`, and
   * `navigateTo` in `@devvit/client` only ever fills the first. Since this
   * function builds the message itself (see the note above for why), it can
   * fill the second — which is the only way to ask for a new tab from inside a
   * post.
   *
   * **It is a request, not a guarantee, and it is the fallback rather than the
   * first try.** A caller should attempt `window.open` first — a blocked popup
   * returns null, so the sandbox's answer is observable rather than assumed —
   * and come here only when that fails.
   * A client that ignores this field navigates in place, which is what every
   * link here did before, so nothing can regress on one that does not honour
   * it.
   */
  const effect = {
    navigateToUrl: { url: normalized, ...(opts?.newTab ? { target: "_blank" } : {}) },
    type: 5,
  };
  try {
    parent.postMessage(
      { ...effect, scope: 0, type: "devvit-internal", effect },
      "*",
    );
  } catch {
    /* not inside a Devvit webview (e.g. a static preview) — no-op */
  }
}

/**
 * The Devvit webview global. Read off `globalThis` for the same reason
 * `navigateTo` posts its own message: under this repo's single tsconfig,
 * `@devvit/web/client` resolves to the "client code in the server" panic stub.
 * Everything here is optional — outside the Devvit runtime (a static preview,
 * a test harness) it is all undefined and every function below no-ops.
 */
type DevvitGlobal = {
  context?: {
    /** `Context.client`, set only by the native iOS/Android apps. */
    client?: { name?: string };
    /** The viewer, as the host already knows them — see `viewer()` below. */
    userId?: string;
    username?: string;
    snoovatar?: string;
    /** Whatever was written at `submitCustomPost` time — usually `{ kind }`. Read through `postKind()`; it is `unknown` here because the
     * shape differs per kind and the host does not type it. */
    postData?: unknown;
    /** This post's own id (`t3_…`). The host injects it with the rest of the
     *  context, so a per-post record can be keyed without asking the server
     *  which post it is answering for. */
    postId?: string;
  };
  /** `WebViewImmersiveMode`: 1 inline, 2 expanded. */
  webViewMode?: number;
  /** Entrypoint name → URL, from `devvit.json` `post.entrypoints`. The host
   * injects this; it is what an expanded-mode request has to name. */
  entrypoints?: { [name: string]: string };
  /** The auth bearer token shared across entries. Only ever appended to an
   * entrypoint under `/api/`, which ours is not — carried so this matches the
   * SDK rather than because we expect to use it. */
  token?: string;
};

const IMMERSIVE = 2;
const INLINE = 1;

function global_(): DevvitGlobal | undefined {
  return (globalThis as { devvit?: DevvitGlobal }).devvit;
}

/**
 * Whether this is a phone or tablet, by the two signals available: the native
 * Reddit apps identify themselves on the context, and mobile web does not — so
 * it is caught by the pointer instead. A touchscreen laptop reports a fine
 * pointer and is treated as desktop, which is what we want: it has a keyboard.
 */
export function isMobile(): boolean {
  if (global_()?.context?.client?.name) return true;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/**
 * Who is looking at this post, with no request at all.
 *
 * The host injects all three fields on the context it hands the webview (they are
 * `BaseContext.userId` / `.username` / `.snoovatar`, filled from the request's own
 * headers). Fetching them from the server (or worse, `reddit.getCurrentUsername()`)
 * makes the first screen wait on a round trip for two strings already in the
 * page.
 *
 * `username` and `snoovatar` are `@experimental` in 0.14, so every caller treats
 * an absent value as "ask the server instead" rather than as "signed out".
 * `userId` is the stable one, and is what "signed in" means.
 */
export function viewer(): { userId?: string; username?: string; snoovatar?: string } {
  const c = global_()?.context;
  return {
    userId: c?.userId || undefined,
    username: c?.username || undefined,
    snoovatar: c?.snoovatar || undefined,
  };
}

/**
 * What kind of post this is, straight off `postData`.
 *
 * One reader, because two screens ask: the router picks the post's app from it,
 * and `App` decides from it whether a tap may ask for the expanded presentation
 * at all — and those two live either side of the routing, so a second copy of
 * the parse would be a second thing to keep in step with a new kind.
 *
 * `null` for a post whose `postData` carries no `kind`.
 */
export function postKind(): string | null {
  const pd = global_()?.context?.postData as { kind?: unknown } | undefined;
  return typeof pd?.kind === "string" ? pd.kind : null;
}

/** This post's id, or null outside a post (the harness). */
export function currentPostId(): string | null {
  const id = global_()?.context?.postId;
  return typeof id === "string" && id ? id : null;
}

/**
 * A field off this post's own `postData`, as a string.
 *
 * **`postData` is readable by anybody who can open the post.** Never put an
 * answer here in plain text — obfuscate it, or keep it server-side keyed on the
 * post id.
 */
export function postField(name: string): string | null {
  const pd = global_()?.context?.postData as Record<string, unknown> | undefined;
  const v = pd?.[name];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
}

/** 'expanded' once the post is in Reddit's larger modal presentation. */
export function webViewMode(): "inline" | "expanded" {
  return global_()?.webViewMode === IMMERSIVE ? "expanded" : "inline";
}

/**
 * Ask Reddit to show this webview in its expanded modal — the same effect
 * `@devvit/web/client`'s `requestExpandedMode` emits (EffectType 9,
 * `immersiveMode`), posted directly for the reason given above.
 *
 * The host only honours this inside a real click it can trust, so pass the
 * native event; a synthetic one is dropped on the floor.
 *
 * **The request has to name an entrypoint, and not naming one blanked the post
 * in the Reddit Android app.** This used to send no `entryUrl`, deliberately:
 * the SDK's own docstring warns that "passing the same entrypoint as currently
 * loaded may cause a reload", and a reload costs any unsaved state. On the
 * web client that worked — it kept showing the current document. The Android
 * client instead opens the expanded presentation and loads `entryUrl`, so with
 * nothing to load the reader got an empty webview: black, on every version, and
 * never recovering, because there was no content to recover. The giveaway was
 * that a `position: fixed`, z-index 999999 debug strip repainting four times a
 * second went black with everything else — no layout fault can do that, because
 * the document that was failing to paint was not the one on screen.
 *
 * `entry` is a required parameter of `requestExpandedMode` in
 * `@devvit/client/effects/web-view-mode`, which is the tell we missed; the rest
 * of the message this file hand-rolls matches that SDK exactly (`scope: 0` is
 * `WebViewInternalMessageScope.CLIENT`, and the effect's own `type` is clobbered
 * by `emitEffect`'s spread, so omitting it is correct).
 */
export function requestExpandedMode(event: MouseEvent): void {
  if (!event.isTrusted || event.type !== "click") return;
  if (webViewMode() === "expanded") return;
  /* **Never on desktop**, and the gate is here rather than at each call site
     because forgetting it is invisible until somebody presses the button: the
     desktop host answers this with its own "Preview on Devices" modal, which is
     not an expanded post and is not what any caller wanted. `expandOnTap` has
     always checked `isMobile()` before installing its listener; a button that
     called this directly once did not, and opened that modal on desktop. One gate, at the bottom, that no new caller can miss. */
  if (!isMobile()) return;
  emitMode(IMMERSIVE, ENTRY);
}

/** Back to the inline post. Same trusted-click rule. */
export function exitExpandedMode(event: MouseEvent): void {
  if (!event.isTrusted || event.type !== "click") return;
  if (webViewMode() === "inline") return;
  emitMode(INLINE);
}

/**
 * Our only `devvit.json` `post.entrypoints` key. Named rather than looked up so
 * that renaming it there is a compile-time concern here — but resolved through
 * `devvit.entrypoints` at the moment of use, because the URL is the host's to
 * decide and it carries a per-session origin we must not guess at.
 */
const ENTRY = "default";

/**
 * Exiting sends no entry, which is what the SDK does — there is nothing to
 * navigate back to, the inline presentation already holds the document.
 */
function emitMode(mode: number, entry?: string): void {
  try {
    const entrypoints = global_()?.entrypoints;
    let entryUrl: string | undefined;
    if (entry && entrypoints?.[entry]) {
      const url = new URL(entrypoints[entry]!);
      // Mirrors the SDK: a server-rendered entrypoint needs the bearer token in
      // its query. Ours is index.html, so this branch does not fire — it is here
      // so the two cannot drift if an /api/ entrypoint is ever added.
      const token = global_()?.token;
      if (url.pathname.startsWith("/api/") && token) url.searchParams.set("token", token);
      entryUrl = `${url}`;
    }
    parent.postMessage(
      { immersiveMode: { entryUrl, immersiveMode: mode }, scope: 0, type: "devvit-internal" },
      "*",
    );
  } catch {
    /* not inside a Devvit webview — no-op */
  }
}

/**
 * Calls back when the host changes the presentation — including when the reader
 * closes the modal from Reddit's own chrome, which is the only way we hear about
 * an exit we did not ask for. The host announces it with an `immersiveModeEvent`
 * message; `window.focus` is the documented backstop for clients that don't send
 * one. Returns a cleanup function.
 */
export function onWebViewModeChange(cb: () => void): () => void {
  const onMessage = (e: MessageEvent) => {
    const data = (e as MessageEvent<{ type?: string; data?: { immersiveModeEvent?: unknown } }>)
      .data;
    if (data?.type === "devvit-message" && data.data?.immersiveModeEvent) cb();
  };
  window.addEventListener("message", onMessage);
  window.addEventListener("focus", cb);
  return () => {
    window.removeEventListener("message", onMessage);
    window.removeEventListener("focus", cb);
  };
}

/**
 * On a phone, hand the post to Reddit's expanded presentation the moment the
 * reader touches anything.
 *
 * A tap on the game itself is the obvious trigger, but then the first tap on
 * Start, on Menu, on any control that is not the game itself is spent inline. This listens on the document instead, in the
 * capture phase, so a handler that stops propagation on its way to doing
 * something else does not also swallow the request.
 *
 * Nothing else changes: `requestExpandedMode` ignores an untrusted event and a
 * post that is already expanded, so this is inert on desktop, inert once the
 * modal is up, and inert where the host does not honour the effect. Returns a
 * cleanup function.
 */
export function expandOnTap(): () => void {
  /* `requestExpandedMode` refuses on desktop anyway; this is the cheaper half —
     not installing a capture-phase listener on every click at all. */
  if (!isMobile()) return () => {};
  const onClick = (e: MouseEvent) => requestExpandedMode(e);
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
