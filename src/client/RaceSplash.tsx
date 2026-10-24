import { useEffect } from "react";
import { inDevvit, requestExpandedMode, webViewMode } from "./lib/devvit";

/**
 * Super Bike Racing 1985, inline: the game's own intro video, playing by
 * itself, sized to the post. Nothing here is playable. A click anywhere opens
 * the game (game.html) in the expanded view, where it starts on the title
 * menu: full screen on a phone, a large modal on desktop.
 *
 * The game runs here in its `splash` host (game/core/host.js): no controls, no
 * input listeners, no cancelled gestures, so the feed scrolls past the post
 * untouched. The video's own PRESS TO START is the label for the click.
 */
export function RaceSplash() {
  useEffect(() => {
    // Read by the game as it loads. Importing it runs it, once: the module is
    // cached, so a second effect (StrictMode) starts nothing new.
    document.documentElement.dataset.host = "splash";
    import("./game/main.js").catch((err) => console.error(`[splash] game failed to load: ${String(err)}`));
  }, []);

  const open = (e: React.MouseEvent) => {
    // Outside Reddit (the local preview) there is no expanded view to ask for;
    // already expanded, there is nothing left to ask. Either way, go straight in.
    if (!inDevvit() || webViewMode() === "expanded") {
      location.href = "./game.html";
      return;
    }
    requestExpandedMode(e.nativeEvent, "game", { desktop: true });
  };

  return (
    <div className="app race-splash" onClick={open}>
      <canvas id="game" width={240} height={150} role="img" aria-label="Super Bike Racing 1985" />
    </div>
  );
}
