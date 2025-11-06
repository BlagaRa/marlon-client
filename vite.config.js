import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // în dev, trimite /api către backendul live de pe Render
      "/api": {
        target: "https://marlon-app-2.onrender.com",
        changeOrigin: true,
        secure: true
      }
    }
  }
});
