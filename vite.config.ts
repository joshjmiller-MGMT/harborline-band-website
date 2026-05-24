import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // manualChunks intentionally NOT set. The previous strategy split vendor into
    // 7 named chunks (vendor-react / vendor-radix / vendor-charts / vendor-dnd /
    // vendor-data / vendor-icons / vendor catch-all) but P334's lazy() additions
    // tipped the chunk graph into a circular import between vendor-react and the
    // catch-all `vendor` chunk → `Cannot read properties of undefined (reading
    // 'createContext')` → black-screen mount crash on 2026-05-22. Default Vite
    // chunking avoids cycles. Revisit splitting once we have a deterministic
    // cycle-free strategy verified across all lazy() boundaries.
  },
}));
