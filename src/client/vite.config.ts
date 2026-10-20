import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Client build → dist/client (served as the web view root by Devvit).
//
// Two pages, one per devvit.json → post.entrypoints entry: index.html is the
// inline post (a splash), game.html is the game, opened in the expanded view.
export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, "../../dist/client"),
    emptyOutDir: true,
    sourcemap: true,
    // The game's art stays as files (game/art/assets.js): nothing is inlined
    // as a data: URI, so every picture is served from the webview's own origin.
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        game: resolve(import.meta.dirname, "game.html"),
      },
    },
  },
});
