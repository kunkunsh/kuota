import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const src = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  fmt: { singleQuote: false, semi: true },
  // Tests resolve workspace packages from source so they never depend on stale `dist` builds.
  resolve: {
    alias: {
      "@kuota/core": src("core"),
      "@kuota/providers": src("providers"),
      "@kuota/history": src("history"),
      "@kuota/tui": src("tui"),
      "@kuota/kunkun": src("kunkun"),
    },
  },
});
