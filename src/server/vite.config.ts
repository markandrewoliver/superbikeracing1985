import { defineConfig } from "vite";
import { resolve } from "node:path";
import { builtinModules } from "node:module";

// Server build → dist/server/index.cjs. Devvit's server runtime requires
// CommonJS output.
export default defineConfig({
  // Bundle every npm dependency (express, etc.) into one self-contained file so
  // nothing has to be resolved from node_modules at runtime.
  ssr: {
    noExternal: true,
  },
  build: {
    ssr: resolve(import.meta.dirname, "index.ts"),
    outDir: resolve(import.meta.dirname, "../../dist/server"),
    emptyOutDir: true,
    target: "node22",
    sourcemap: true,
    // Leave dynamic require() calls (from Express's transitive deps) untouched,
    // or the bundler emits malformed requires that break Devvit's RPC layer.
    commonjsOptions: {
      ignoreDynamicRequires: true,
    },
    rollupOptions: {
      // Node built-ins are provided by the runtime.
      external: [...builtinModules],
      output: {
        format: "cjs",
        entryFileNames: "index.cjs",
        inlineDynamicImports: true,
      },
    },
  },
});
