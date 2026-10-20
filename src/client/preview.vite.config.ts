import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Local-only preview build — an entry (preview.html) alongside the real ones,
// never referenced by them and never touched by build:client, which lists its
// own pages (index.html and game.html) in vite.config.ts.
// So this never reaches dist/client, which is the only directory Devvit
// uploads: nothing here can end up in a version, on purpose. See preview.tsx.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, "../../dist/preview"),
    emptyOutDir: true,
    // The root also holds index.html (the real entry) — without this, a build
    // here would silently bundle that instead of preview.html.
    rollupOptions: {
      input: resolve(import.meta.dirname, "preview.html"),
    },
  },
});
