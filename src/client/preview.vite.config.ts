import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Local-only preview build — a second entry (preview.html) alongside the real
// one, never referenced by it and never touched by build:client's default
// single-entry build (Vite only picks up index.html unless told otherwise).
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
