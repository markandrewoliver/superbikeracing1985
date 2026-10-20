import { defineConfig, devices } from "@playwright/test";

/**
 * Cross-engine input tests. `npm run test:input`.
 *
 * Two outages in a previous game were the same shape: the app asked the
 * browser to do something, then relied on the browser *telling it back* that
 * it had. iOS refused to focus a hidden field; Firefox moved focus without
 * firing the event the selection was gated on. Both shipped green — a
 * type-check, a build and a jsdom test cannot see either, because neither
 * involves a real engine deciding what a real press does.
 *
 * So these tests do the one thing nothing else here does: press with the
 * browser's own input pipeline, on the three engines that matter, and check
 * that the reader can see it worked.
 *
 * **Headless is not a compromise here, it is the point.** The Firefox bug only
 * shows when the window does not hold focus — which is every post nobody has
 * touched yet, and which is exactly what a headless run is. Running these
 * headed would hide the thing they were written for.
 *
 * WebKit is Playwright's build, not Mobile Safari: close, and not the same
 * engine an iPhone runs. It catches the WebKit-family behaviour and it will not
 * catch a phone-only viewport or keyboard bug — test on a real phone for that.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "line" : [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    /* `CHROMIUM_PATH` points at an already-installed Chromium when the
       Playwright-matched build is not present (CI images, sandboxes). */
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    /* WebKit with touch, a phone viewport and `isMobile` — the closest thing to
       an iPhone that runs locally. It exercises the *touch* path (tap, not
       click), which is where the iOS bugs have been: a tap that blurs the
       capture field takes the keyboard with it. It is still Playwright's
       WebKit, not Mobile Safari, so it will not catch a phone-only viewport or
       keyboard bug. */
    { name: "mobile-webkit", use: { ...devices["iPhone 14"] } },
  ],
  /* The harness, not the app: preview.html mounts the real screens over a
     stubbed fetch, with no server behind them. A fixed port with `strictPort` so a
     stray dev server on 5173 is an error rather than a test run against
     something else. */
  webServer: {
    /* `--host` so the same server answers on both `localhost` and `127.0.0.1`.
       That pair is one server on two origins, which is what `embed.html` uses
       to put the app in a genuinely cross-origin frame without a second host —
       see e2e/embedded.spec.ts. Dev-only; nothing here is ever served. */
    command:
      "npx vite --config src/client/preview.vite.config.ts --port 5173 --strictPort --host",
    url: "http://localhost:5173/preview.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
