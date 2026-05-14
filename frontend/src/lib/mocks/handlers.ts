import { http, HttpResponse } from "msw";
import type { AuthResponse, Subject } from "../api/types";

const fakeUser = {
  id: "u-1",
  name: "Yago",
  email: "yago@tempus.dev",
  created_at: new Date().toISOString(),
};

const subjects: Subject[] = [
  {
    id: "s-1",
    name: "Cálculo I",
    color: "#3b82f6",
    description: "Limites, derivadas, integrais",
    weekly_goal_minutes: 600,
    created_at: new Date().toISOString(),
  },
];

export const handlers = [
  http.post("/api/auth/login", async () => {
    const res: AuthResponse = { user: fakeUser, access_token: "fake-token" };
    return HttpResponse.json(res);
  }),
  http.post("/api/auth/register", async () => {
    const res: AuthResponse = { user: fakeUser, access_token: "fake-token" };
    return HttpResponse.json(res);
  }),
  http.get("/api/auth/me", () => HttpResponse.json(fakeUser)),

  http.get("/api/subjects", () => HttpResponse.json(subjects)),
];
