/**
 * The first request, sent before the app's JavaScript has been downloaded.
 *
 * A webview cannot ask the server anything until its bundles have arrived and
 * run, which on a phone is most of the wait before the first screen. This
 * script asks straight away and leaves the promise on `window.__boot` for the
 * app to pick up (lib/boot.ts), so the round trip overlaps the download.
 *
 * **It must be an external file, never an inline <script>.** Reddit serves the
 * webview under `script-src 'self' webview.devvit.net webview-dev.devvit.net
 * 'wasm-unsafe-eval'` — no 'unsafe-inline', no nonce — so an inline script is
 * blocked in a real post while working perfectly in local preview. The only
 * symptom is that the app is slower.
 *
 * Lives in public/ so the build copies it out verbatim. Dependency-free ES5,
 * because nothing here may wait on a bundle. Pick the request BY POST KIND —
 * asking the wrong endpoint costs a second round trip later.
 */
(function () {
  function preflight() {
    try {
      var c = (window.devvit || {}).context || {};
      var pd = c.postData || {};
      var kind = typeof pd.kind === "string" ? pd.kind : null;
      // The host has not injected its context yet: try once more next task.
      if (!c.subredditId && !c.userId && !kind) return false;
      var boot = (window.__boot = window.__boot || {});
      var json = function (r) {
        return r.ok ? r.json() : null;
      };
      var nul = function () {
        return null;
      };
      if (kind === "example") {
        boot.init = boot.init || fetch("/api/init").then(json).catch(nul);
      }
      return true;
    } catch (e) {
      return true;
    }
  }
  if (!preflight()) setTimeout(preflight, 0);
})();
