import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./routes";
import { AuthProvider } from "./lib/auth/AuthContext";

async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { worker } = await import("./lib/mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
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
