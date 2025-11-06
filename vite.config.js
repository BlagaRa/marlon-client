import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // în dev, poți lăsa /api relativ și folosești proxy -> Render
      "/api": {
        target: "https://marlon-app-2.onrender.com",
        changeOrigin: true,
        secure: true
      }
    }
  }
});
