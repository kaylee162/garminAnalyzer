import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Mirrors the /api rewrite in vercel.json so dev needs no VITE_API_URL.
    proxy: { "/api": "http://localhost:8000" },
  },
});
