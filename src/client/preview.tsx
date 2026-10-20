import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CrtScreen } from "./components/CrtScreen";
import { trackVisibleHeight } from "./lib/visibleHeight";
import "./styles.css";

/**
 * The local preview harness: `npm run preview`, then open
 *
 *   http://localhost:5173/preview.html#app              the app, signed in
 *   http://localhost:5173/preview.html#app?guest        signed out
 *   http://localhost:5173/preview.html?vp=288x512#app   inside a post-sized frame
 *   http://localhost:5173/embed.html#app                cross-origin, unfocused
 *
 * It never reaches dist/client (see preview.vite.config.ts), so nothing here
 * can ship.
 *
 * **A fixture is a claim about the server.** The stubbed fetch below must
 * answer exactly what the real route answers — a fixture shaped the way you
 * wish the server behaved is how a bug works in the preview and not in a post.
 * Prefer importing the real pure functions the server uses over restating them.
 */

/* --------------------------------------------------------------------------
   The host's injected globals. Inside Reddit, `window.devvit` is put there by
   the webview host; here it is faked so `viewer()`, `postKind()` and the
   boot preflight see what a real post would hand them.
   -------------------------------------------------------------------------- */
const guest = location.hash.includes("guest");
(globalThis as { devvit?: unknown }).devvit = {
  context: {
    postData: { kind: "example" },
    postId: "t3_preview",
    subredditId: "t5_preview",
    ...(guest ? {} : { userId: "t2_you", username: "you", snoovatar: "" }),
  },
  webViewMode: 1,
};

/* --------------------------------------------------------------------------
   The server, stubbed. One state object, mutated the way the routes would.
   -------------------------------------------------------------------------- */
const state = { total: 41, mine: guest ? 0 : 3 };
function installStubFetch() {
  const real = window.fetch.bind(window);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    const method = (init?.method ?? "GET").toUpperCase();
    /* A short delay, so loading states are actually seen. */
    await new Promise((r) => setTimeout(r, 250));
    if (url.pathname === "/api/init")
      return json({ postId: "t3_preview", total: state.total, mine: state.mine, username: guest ? null : "you" });
    if (url.pathname === "/api/press" && method === "POST") {
      if (guest) return json({ status: "error", message: "sign in to play" }, 401);
      state.total += 1;
      state.mine += 1;
      return json({ total: state.total, mine: state.mine });
    }
    return real(input, init);
  };
}
installStubFetch();

/** The glass and the measured height, as `App` mounts them, for any screen
 *  previewed on its own. */
export function Glass({ children }: { children: React.ReactNode }) {
  useEffect(() => trackVisibleHeight(), []);
  return (
    <>
      <div className="crt-screen">{children}</div>
      <CrtScreen />
    </>
  );
}

function Preview() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  /* Add a route per screen worth looking at on its own — and give every
     interesting state its own `?flag`, so check:crop and the e2e tests can
     reach it by URL. */
  if (hash.startsWith("#app") || hash === "") return <App />;
  return <App />;
}

/* ==========================================================================
   CRT tuning panel — harness only.

   The strengths are `:root` custom properties, so they can be set on
   documentElement and every layer re-reads them on the next frame: no rebuild,
   no remount, and the screen under them keeps its state while you drag.

   It exists because the roll bar cannot be judged from a stylesheet. It sweeps
   for --crt-roll-time once every ~10s, and its alpha is a *difference* against
   the resting scanlines rather than a brightness of its own — so whether it
   reads at all depends on four dials at once. ROLL fires one on demand, which
   is the only way to see the thing you are tuning while you tune it.

   The values it prints are the numbers to put back into styles/20-crt.css.
   ========================================================================== */

/** A dial: the property, the range to drag it over, and what it multiplies out
 *  to in the stylesheet — the second number is the one that matters visually,
 *  so it is what the readout shows. */
const CRT_DIALS = [
  { prop: "--crt-vignette", max: 40, step: 0.5, mul: 0.02, note: "corner darkness" },
  { prop: "--crt-scanlines", max: 30, step: 0.01, mul: 0.009, note: "resting lines" },
  { prop: "--crt-glow", max: 60, step: 0.5, mul: 0.1, note: "type glow (px, first stop)" },
  { prop: "--crt-bleed", max: 200, step: 1, mul: 0.022, note: "chromatic offset px" },
  { prop: "--crt-bleed-a", max: 1, step: 0.01, mul: 1, note: "chromatic strength" },
  { prop: "--crt-roll", max: 60, step: 0.01, mul: 0.009, note: "roll lines" },
  { prop: "--crt-roll-band", max: 100, step: 1, mul: 0.01, note: "band height" },
  { prop: "--crt-roll-time", max: 6, step: 0.1, mul: 1, note: "sweep seconds" },
  { prop: "--crt-roll-pause", max: 30, step: 0.5, mul: 1, note: "seconds between" },
] as const;

/** The shipped values, read once off the stylesheet rather than duplicated here
 *  — a copy would go stale the moment styles.css changed, and then RESET would
 *  quietly lie about what the app actually looks like. */
function shippedCrtValues(): Record<string, number> {
  const computed = getComputedStyle(document.documentElement);
  const out: Record<string, number> = {};
  for (const d of CRT_DIALS) out[d.prop] = parseFloat(computed.getPropertyValue(d.prop)) || 0;
  return out;
}

function CrtControls() {
  const [shipped] = useState(shippedCrtValues);
  const [values, setValues] = useState<Record<string, number>>(shipped);
  /**
   * Open only where there is room for it beside the app.
   *
   * The panel is 260px plus its margins, fixed to the right of the window — so
   * on a window the size of a real post it is *on top of* the app, and what
   * it covers reads as missing.
   *
   * 1156 is the widest frame a post is drawn in (880, Reddit's own ceiling)
   * plus the panel's own width. Above it nothing is covered and the panel
   * stays open, which is what somebody tuning the CRT on a desktop window
   * wants. Below it the panel starts as its "+ CRT" toggle and opens on a
   * press — the dials are still one click away, they are just not in front of
   * the thing being looked at.
   *
   * `nopanel` in the hash or the query still forces it shut at any width;
   * `panel` forces it open, for the case where the CRT *is* what is being
   * judged and the covering does not matter.
   */
  const [open, setOpen] = useState(() => {
    const flag = (s: string) => location.hash.includes(s) || location.search.includes(s);
    if (flag("nopanel")) return false;
    if (flag("panel")) return true;
    return window.innerWidth >= 1156;
  });
  const [repeat, setRepeat] = useState(false);

  // Written straight to documentElement: the same place the cascade reads them,
  // so nothing here has to know which layers use which dial.
  useEffect(() => {
    for (const [prop, v] of Object.entries(values)) {
      document.documentElement.style.setProperty(prop, String(v));
    }
  }, [values]);

  // Fire a sweep now. CrtScreen owns the class and takes it off on animationend,
  // so adding it is the whole job; if one is already running this is a no-op.
  const rollNow = () => {
    document.querySelectorAll<HTMLElement>(".crt__roll").forEach((n) => n.classList.add("is-rolling"));
  };

  useEffect(() => {
    if (!repeat) return undefined;
    const id = window.setInterval(rollNow, (values["--crt-roll-time"] ?? 1.6) * 1000 + 400);
    return () => window.clearInterval(id);
  }, [repeat, values]);

  const asCss = CRT_DIALS.map((d) => `  ${d.prop}: ${values[d.prop]};`).join("\n");

  return (
    <div
      /* Named so anything driving the harness can hide it. At a phone width its
         collapsed "+ CRT" toggle sits exactly where the app's Menu is, and an
         automated press lands on the panel instead of the app. */
      className="crt-panel"
      style={{
        /* **Bottom right, not top right.** At the top right the collapsed
           toggle sits exactly where most screens put a Menu button and
           silently swallows the press. The shift meter has the bottom left. */
        position: "fixed", bottom: 8, right: 8, zIndex: 99999,
        font: "11px/1.45 ui-monospace, monospace", color: "#e6edf3",
        background: "rgba(10,13,18,0.92)", border: "1px solid #30363d",
        borderRadius: 6, padding: 8, width: open ? 260 : "auto",
        maxHeight: "92vh", overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={() => setOpen((o) => !o)} style={{ font: "inherit" }}>
          {open ? "–" : "+"} CRT
        </button>
        {open && (
          <>
            <button onClick={rollNow} style={{ font: "inherit" }}>ROLL</button>
            <label style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
              loop
            </label>
            <button onClick={() => setValues(shipped)} style={{ font: "inherit", marginLeft: "auto" }}>
              reset
            </button>
          </>
        )}
      </div>

      {open && (
        <>
          {CRT_DIALS.map((d) => {
            const v = values[d.prop] ?? 0;
            return (
              <div key={d.prop} style={{ marginTop: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{d.prop.replace("--crt-", "")}</span>
                  <span style={{ color: "#8b949e" }}>
                    {v} → {(v * d.mul).toFixed(3)}
                  </span>
                </div>
                <input
                  type="range" min={0} max={d.max} step={d.step} value={v}
                  onChange={(e) => setValues((s) => ({ ...s, [d.prop]: Number(e.target.value) }))}
                  style={{ width: "100%" }}
                />
                <div style={{ color: "#6e7681", fontSize: 10 }}>{d.note}</div>
              </div>
            );
          })}
          <textarea
            readOnly
            value={asCss}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: "100%", height: 92, marginTop: 8, font: "10px/1.4 ui-monospace, monospace",
              background: "#0d1117", color: "#8b949e", border: "1px solid #30363d", borderRadius: 4,
            }}
          />
        </>
      )}
    </div>
  );
}

/* ==========================================================================
   Viewport shell — harness only.

   A desktop browser window is not a viewport this app is ever seen in. Every
   real reader is inside Reddit's own frame, which is a phone-sized box, and
   judging layout against a 1900px window mostly measures things nobody will
   see — .app letterboxing to its 920px column, bands cut at the column edge,
   acres of negative space that do not exist on a phone.

   So with `?vp=WxH` the screen is rendered inside an **iframe** at a chosen
   size, on white.

   The iframe is the whole point and not an implementation detail: it is the
   only way to make the app's own measurements agree with the box it is drawn
   in. Sized with a div instead, `100dvh` and every media query would still
   resolve against the outer window, `.app` would still be 920px wide, and the
   frame would be a picture of the wrong layout at the right size. Inside a
   frame they resolve against the frame — and --vis-h's IntersectionObserver
   uses a null root, so it measures across frame boundaries exactly as it does
   inside Reddit's.

   Driven by a `?vp=WxH` search param rather than the hash, which is already the
   screen router and is passed through to the inner document untouched.
   ========================================================================== */

/**
 * Sizes worth checking, INLINE FIRST.
 *
 * Inline is the post as it sits in the feed, and it is the one that hurts: it
 * is short. Everything has to fit a frame less than half the height of the
 * expanded one — which is where the fight card runs out of room, where the
 * negative space around the coded line is not negative space at all, and where
 * a layout that reads fine expanded gets cut.
 *
 * Reddit's Custom Post Styles docs give TALL = 512px and REGULAR = 320px high,
 * width ~288 to ~880 depending on device. 705 x 526 was measured from a real
 * desktop post (1411 x 1053 at 2x DPR). Read `innerWidth` / `innerHeight`
 * inside a real post and type the result into the box when in doubt.
 */
const VIEWPORTS: Array<{ label: string; w: number; h: number }> = [
  /* 288 is the narrowest a post ever gets, and the width things break at. */
  { label: "288 x 512   inline, narrowest", w: 288, h: 512 },
  { label: "880 x 512   inline, widest", w: 880, h: 512 },
  { label: "705 x 526   inline, desktop  (measured)", w: 705, h: 526 },
  { label: "390 x 510   inline, phone", w: 390, h: 510 },
  { label: "320 x 430   inline, small phone", w: 320, h: 430 },
  { label: "390 x 844   expanded, phone", w: 390, h: 844 },
  { label: "320 x 568   expanded, small phone", w: 320, h: 568 },
  { label: "430 x 932   expanded, large phone", w: 430, h: 932 },
  { label: "768 x 1024  expanded, tablet", w: 768, h: 1024 },
];

function ViewportShell({ w, h }: { w: number; h: number }) {
  const [size, setSize] = useState({ w, h });
  const [custom, setCustom] = useState(`${w}x${h}`);
  const [hash, setHash] = useState(() => location.hash || "#app");

  useEffect(() => {
    const on = () => setHash(location.hash || "#app");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // The inner document gets the hash and nothing else — no `vp`, or it would
  // build another shell inside itself. `nopanel` keeps the CRT panel collapsed:
  // it is 260px wide and would cover most of a phone frame, and its own "+"
  // button reopens it in place.
  const src = `preview.html?nopanel=1${hash}`;

  const apply = (v: string) => {
    const m = /^\s*(\d{2,4})\s*[x×]\s*(\d{2,4})\s*$/.exec(v);
    if (m) setSize({ w: Number(m[1]), h: Number(m[2]) });
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "#fff", color: "#111",
        font: "12px/1.5 ui-monospace, monospace",
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 10, padding: 12, overflow: "auto",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={`${size.w}x${size.h}`}
          onChange={(e) => { apply(e.target.value); setCustom(e.target.value); }}
          style={{ font: "inherit" }}
        >
          {VIEWPORTS.map((v) => (
            <option key={v.label} value={`${v.w}x${v.h}`}>{v.label}</option>
          ))}
          {!VIEWPORTS.some((v) => v.w === size.w && v.h === size.h) && (
            <option value={`${size.w}x${size.h}`}>{`${size.w} x ${size.h}  custom`}</option>
          )}
        </select>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") apply(custom); }}
          onBlur={() => apply(custom)}
          size={10}
          style={{ font: "inherit" }}
        />
        <span style={{ color: "#666" }}>
          {size.w} x {size.h} — screen {hash}
        </span>
      </div>

      <iframe
        title="viewport"
        src={src}
        style={{
          width: size.w, height: size.h, flex: "0 0 auto",
          border: "1px solid #bbb", borderRadius: 6, background: "#000",
          boxShadow: "0 2px 18px rgba(0,0,0,0.18)",
        }}
      />
    </div>
  );
}

/* ==========================================================================
   Layout-shift meter — harness only.

   Screens build themselves in stages: a logo animates, then content mounts,
   then a font swaps in. Each is a chance for something already drawn to move,
   and a shift that arrives a second after the reader started reading is
   obvious in use and invisible in a screenshot.

   So it is measured rather than eyeballed. This is the browser's own Layout
   Instability API — the thing CLS is computed from — reporting the same score
   Chrome would, plus the elements that actually moved, which is the part that
   turns "something shifted" into "this element shifted".

   Anything above ~0.1 is a bad experience by Google's own threshold; on these
   screens the target is 0, because nothing here has an excuse. The fix is
   almost always the same one: reserve the room from the first frame instead of
   letting the late content size it.

   Hidden with `nopanel`, so screenshots stay clean.
   ========================================================================== */

interface ShiftSource {
  node?: Node | null;
}
interface ShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  sources?: ShiftSource[];
}

/** `div.app__body` — enough to find it, short enough to read. */
function describe(node?: Node | null): string {
  if (!node || !(node instanceof Element)) return "(anonymous)";
  const cls = typeof node.className === "string" ? node.className.trim().split(/\s+/)[0] : "";
  return cls ? `${node.tagName.toLowerCase()}.${cls}` : node.tagName.toLowerCase();
}

function ShiftMeter() {
  const [total, setTotal] = useState(0);
  const [worst, setWorst] = useState<Array<{ what: string; value: number }>>([]);

  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return undefined;
    let sum = 0;
    const byNode = new Map<string, number>();
    const obs = new PerformanceObserver((list) => {
      for (const raw of list.getEntries()) {
        const e = raw as ShiftEntry;
        // A shift the reader caused by tapping something is not a defect.
        if (e.hadRecentInput) continue;
        sum += e.value;
        for (const s of e.sources ?? []) {
          const key = describe(s.node);
          byNode.set(key, (byNode.get(key) ?? 0) + e.value);
        }
      }
      setTotal(sum);
      setWorst(
        [...byNode.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([what, value]) => ({ what, value })),
      );
    });
    try {
      obs.observe({ type: "layout-shift", buffered: true });
    } catch {
      return undefined; // Not Chromium — the meter simply does not run.
    }
    return () => obs.disconnect();
  }, []);

  const bad = total > 0.01;
  return (
    <div
      style={{
        position: "fixed", left: 8, bottom: 8, zIndex: 99999,
        font: "11px/1.45 ui-monospace, monospace",
        color: bad ? "#ffb4a2" : "#8b949e",
        background: "rgba(10,13,18,0.92)",
        border: `1px solid ${bad ? "#a03c2e" : "#30363d"}`,
        borderRadius: 6, padding: "5px 8px", maxWidth: 260,
      }}
    >
      <div>shift {total.toFixed(4)}{bad ? "  ← moved" : ""}</div>
      {worst.map((w) => (
        <div key={w.what} style={{ color: "#6e7681" }}>
          {w.what} {w.value.toFixed(4)}
        </div>
      ))}
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

const vp = /^(\d{2,4})[x×](\d{2,4})$/.exec(
  new URLSearchParams(location.search).get("vp") ?? "",
);

createRoot(root).render(
  <StrictMode>
    {vp ? (
      <ViewportShell w={Number(vp[1])} h={Number(vp[2])} />
    ) : (
      <>
        <Preview />
        <CrtControls />
        {!location.search.includes("nopanel") && <ShiftMeter />}
      </>
    )}
  </StrictMode>,
);
