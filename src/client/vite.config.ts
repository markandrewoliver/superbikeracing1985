import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Client build → dist/client (served as the web view root by Devvit).
export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, "../../dist/client"),
    emptyOutDir: true,
    sourcemap: true,
  },
});
