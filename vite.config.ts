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
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (
            /node_modules\/react\//.test(id) ||
            id.includes("react-dom") ||
            id.includes("react-router") ||
            id.includes("scheduler") ||
            id.includes("react-helmet-async")
          ) {
            return "vendor-react";
          }
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul") || id.includes("sonner")) {
            return "vendor-radix";
          }
          if (id.includes("recharts") || id.includes("d3-")) {
            return "vendor-charts";
          }
          if (id.includes("@dnd-kit")) {
            return "vendor-dnd";
          }
          if (id.includes("@supabase") || id.includes("@tanstack/react-query")) {
            return "vendor-data";
          }
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
          return "vendor";
        },
      },
    },
  },
}));
