/**
 * The requests the page started before this code existed — see
 * `public/boot-preflight.js`. Every accessor degrades to fetching normally, so
 * a preflight that never ran (a static preview, a host that injects its
 * context late) costs only the time it would have saved.
 */
type Boot = {
  init?: Promise<unknown>;
};

function boot(): Boot {
  return ((globalThis as { __boot?: Boot }).__boot ??= {});
}

/** The /api/init response — preflighted if the script got to it. */
export function initResponse(): Promise<unknown> {
  const b = boot();
  b.init ??= fetch("/api/init")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return b.init;
}
