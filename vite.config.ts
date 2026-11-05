import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks(id) { if (id.includes("spellCatalog.json")) return "spell-catalog"; if (id.includes("classCatalog.json")) return "class-catalog"; } } } },
  server: {
    proxy: { "/api": "http://127.0.0.1:4174" },
  },
});
