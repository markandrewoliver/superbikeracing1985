import { Copy } from "./components/Copy";
import { inDevvit, requestExpandedMode, webViewMode } from "./lib/devvit";
import bg from "./game/assets/splash-art/bg.png";
import rider from "./game/assets/splash-art/rider.png";
import bike from "./game/assets/splash-art/bike.png";
import sup from "./game/assets/splash-art/super.png";
import n1985 from "./game/assets/splash-art/n1985.png";

/** The title picture's layers, back to front — the same art the game's title
 *  screen builds itself up from. All five are the same size, so stacking them
 *  lines them up. */
const LAYERS = [bg, rider, bike, sup, n1985];

/**
 * Super Bike Racing 1985, inline: a splash and one button. Nothing here is
 * playable — the game is game.html, opened in the expanded view (full screen
 * on a phone, a large modal on desktop) by the button and only by the button.
 *
 * No gesture is cancelled and nothing takes focus, so the feed scrolls past the
 * post untouched.
 */
export function RaceSplash() {
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
    <div className="app race-splash">
      <div className="race-splash__art" aria-hidden="true">
        {LAYERS.map((src) => (
          <img key={src} src={src} alt="" width={480} height={620} draggable={false} />
        ))}
      </div>
      <button type="button" className="race-splash__open" onClick={open}>
        <Copy k="raceOpen" />
      </button>
    </div>
  );
}
