import { http, passthrough } from "msw";
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

// Rotas cujo backend já está implementado: o MSW deixa a request passar
// direto para o servidor real (via Vite proxy → :8000). Outras rotas
// (subjects, sessions, documents, ...) continuam servidas pelos handlers
// mockados até o backend correspondente entrar.
//
// Em E2E (VITE_E2E=true), passthroughs são desligados — o Playwright sobe
// só o Vite, não o backend, então tudo precisa cair nos handlers mockados.
const isE2E = import.meta.env.VITE_E2E === "true";

const backendReadyPassthrough = isE2E
  ? []
  : [
      http.all("/api/auth/*", () => passthrough()),
      http.all("/api/subjects", () => passthrough()),
      http.all("/api/subjects/*", () => passthrough()),
      http.all("/api/quizzes", () => passthrough()),
      http.all("/api/quizzes/*", () => passthrough()),
      http.all("/api/chat/*", () => passthrough()),
      http.all("/api/notebooks", () => passthrough()),
      http.all("/api/notebooks/*", () => passthrough()),
    ];

export const worker = setupWorker(...backendReadyPassthrough, ...handlers);

