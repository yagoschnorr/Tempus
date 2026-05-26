import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./routes";
import { AuthProvider } from "./lib/auth/AuthContext";

async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    try {
      const { worker } = await import("./lib/mocks/browser");
      await worker.start({ onUnhandledRequest: "bypass" });
    } catch {
      // Service worker pode estar bloqueado (ex.: Playwright E2E com
      // serviceWorkers: "block" para que page.route intercepte requests).
      // App continua renderizando — quem chamar /api/* terá que ter outro
      // interceptador (page.route do teste) ou o backend de pé.
    }
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </React.StrictMode>,
  );
}

bootstrap();
