import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Backend monta os routers com prefix `/api/*`, então NÃO podemos remover `/api`
      // da URL antes de encaminhar — a request precisa chegar como `/api/quizzes/...`.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});