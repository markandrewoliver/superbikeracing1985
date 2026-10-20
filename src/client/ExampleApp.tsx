import { useEffect, useState } from "react";
import type { InitResponse, PressResponse } from "../shared/api";
import { Copy } from "./components/Copy";
import { LoadingScreen } from "./components/LoadingScreen";
import { initResponse } from "./lib/boot";
import { viewer } from "./lib/devvit";

/**
 * The example post kind: one shared counter per post.
 *
 * Shows the patterns, not a game:
 *  - the first request was already sent by boot-preflight.js;
 *  - the viewer's name comes off the injected context, never a fetch;
 *  - the layout is a fixed-height column with no scrolling (`.app`);
 *  - the press is optimistic and reconciles with the server's answer.
 */
export function ExampleApp() {
  const [data, setData] = useState<InitResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const me = viewer();

  useEffect(() => {
    let live = true;
    void initResponse().then((r) => {
      if (!live) return;
      if (r) setData(r as InitResponse);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const press = async () => {
    if (!data) return;
    // Optimistic: the reader sees their press at once.
    setData({ ...data, total: data.total + 1, mine: data.mine + 1 });
    try {
      const r = await fetch("/api/press", { method: "POST" });
      if (!r.ok) throw new Error(String(r.status));
      const next = (await r.json()) as PressResponse;
      setData((d) => (d ? { ...d, ...next } : d));
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="app">
      <header className="app__head">
        <h1 className="app__title">
          <Copy k="title" />
        </h1>
        <span className="app__who">{me.username ? `u/${me.username}` : ""}</span>
      </header>
      {!data && !failed ? (
        <LoadingScreen />
      ) : (
        <main className="app__body">
          {failed && (
            <p role="alert">
              <Copy k="error" />
            </p>
          )}
          {data && (
            <>
              <p className="count">
                <Copy k="totalLabel" /> <strong>{data.total}</strong>
              </p>
              {me.userId && (
                <p className="count count--mine">
                  <Copy k="mineLabel" /> <strong>{data.mine}</strong>
                </p>
              )}
              <button className="btn" type="button" onClick={press} disabled={!me.userId}>
                <Copy k="press" />
              </button>
            </>
          )}
        </main>
      )}
    </div>
  );
}
