import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/lib/mocks/server";
import { authApi } from "@/features/auth/api";
import { ApiError, getErrorMessage } from "@/lib/api/client";

describe("authApi", () => {
  it("login devolve token e usuário", async () => {
    const res = await authApi.login("yago@tempus.dev", "qualquer");
    expect(res.access_token).toBe("fake-token");
    expect(res.user.email).toBe("yago@tempus.dev");
  });

  it("register devolve token e usuário", async () => {
    const res = await authApi.register("Yago", "novo@tempus.dev", "senha123");
    expect(res.access_token).toBe("fake-token");
    expect(res.user.id).toBeTruthy();
  });

  it("me devolve usuário corrente", async () => {
    const user = await authApi.me();
    expect(user.email).toBe("yago@tempus.dev");
  });

  it("propaga ApiError quando o backend devolve 401", async () => {
    // Sobrescreve só este teste com erro 401.
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ detail: "Credenciais inválidas" }, { status: 401 })
      )
    );

    await expect(authApi.login("a@b.com", "x")).rejects.toBeInstanceOf(ApiError);
  });

  it("getErrorMessage extrai detail do ApiError, ou usa fallback", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ detail: "Email ou senha incorretos" }, { status: 401 })
      )
    );

    try {
      await authApi.login("a@b.com", "x");
    } catch (err) {
      expect(getErrorMessage(err, "fallback")).toBe("Email ou senha incorretos");
    }

    expect(getErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });
});
