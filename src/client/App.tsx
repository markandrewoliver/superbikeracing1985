import { useEffect } from "react";
import { CrtScreen } from "./components/CrtScreen";
import { ExampleApp } from "./ExampleApp";
import { RaceSplash } from "./RaceSplash";
import { expandOnTap, postKind } from "./lib/devvit";
import { trackVisibleHeight } from "./lib/visibleHeight";

/**
 * The root. Three things live here so that no post kind can forget them:
 *
 *  - the measured visible height (`--vis-h`), which every full-height rule reads;
 *  - the CRT glass, mounted once, outside the routing;
 *  - the phone's expanded-mode request on first tap.
 *
 * Then it routes on `postData.kind`.
 *
 * **Super Bike Racing 1985 (`race`) is the exception to the last one.** Its
 * inline post is only a splash; the game is a page of its own (game.html), and
 * a click on the splash is the one way into it, on desktop as well as phones,
 * so the splash asks for the expanded view itself. The glass covers the splash
 * as it covers any post; game.html lays its own over the game's screen.
 */
export function App() {
  useEffect(() => trackVisibleHeight(), []);

  const kind = postKind();
  // Post kinds that should stay inline (read-only reports, or anything typed
  // on the OS keyboard) leave this out. See docs/02-devices-and-input.md.
  const inlineOnly = kind === "race";
  useEffect(() => (inlineOnly ? undefined : expandOnTap()), [inlineOnly]);

  return (
    <>
      <div className="crt-screen">{route(kind)}</div>
      <CrtScreen />
    </>
  );
}

function route(kind: string | null) {
  switch (kind) {
    case "race":
      return <RaceSplash />;
    case "example":
    default:
      // An unknown or missing kind falls through to the example, so a post
      // created before a kind existed still draws something.
      return <ExampleApp />;
  }
}
