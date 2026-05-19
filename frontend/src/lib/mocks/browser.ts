import { http, passthrough } from "msw";
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

// Rotas cujo backend já está implementado: o MSW deixa a request passar
// direto para o servidor real (via Vite proxy → :8000). Outras rotas
// (subjects, sessions, documents, ...) continuam servidas pelos handlers
// mockados até o backend correspondente entrar.
const backendReadyPassthrough = [
  http.all("/api/auth/*", () => passthrough()),
  http.all("/api/subjects", () => passthrough()),
  http.all("/api/subjects/*", () => passthrough()),
  http.all("/api/quizzes", () => passthrough()),
  http.all("/api/quizzes/*", () => passthrough()),
];

export const worker = setupWorker(...backendReadyPassthrough, ...handlers);

