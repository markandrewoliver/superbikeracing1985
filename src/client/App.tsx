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
 * **Super Bike Racing 1985 (`race`) is the exception to the last two.** Its
 * inline post is only a splash; the game is a page of its own (game.html), and
 * the splash's button is the one way into it, on desktop as well as phones. So
 * a tap anywhere else must not expand the post, and the game draws its own
 * screen, with no glass over the splash.
 */
export function App() {
  useEffect(() => trackVisibleHeight(), []);

  const kind = postKind();
  const race = kind === "race";

  // Post kinds that should stay inline (read-only reports, or anything typed
  // on the OS keyboard) leave this out. See docs/02-devices-and-input.md.
  const inlineOnly = race;
  useEffect(() => (inlineOnly ? undefined : expandOnTap()), [inlineOnly]);

  return (
    <>
      <div className="crt-screen">{route(kind)}</div>
      {race ? null : <CrtScreen />}
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
