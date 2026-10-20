import { useEffect } from "react";
import { CrtScreen } from "./components/CrtScreen";
import { ExampleApp } from "./ExampleApp";
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
 */
export function App() {
  useEffect(() => trackVisibleHeight(), []);

  const kind = postKind();

  // Post kinds that should stay inline (read-only reports, or anything typed
  // on the OS keyboard) leave this out. See docs/02-devices-and-input.md.
  const inlineOnly = false;
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
    case "example":
    default:
      // An unknown or missing kind falls through to the example, so a post
      // created before a kind existed still draws something.
      return <ExampleApp />;
  }
}
