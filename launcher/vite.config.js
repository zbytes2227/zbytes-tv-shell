import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ZBYTES OS launcher Vite config.
// Dev server proxies API calls to the Express backend on port 3000
// so the launcher can be developed independently with `npm run dev`.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    proxy: {
      "/apps": "http://localhost:3000",
      "/launch": "http://localhost:3000"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
