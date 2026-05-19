import { describe, it, expect } from "vitest";
import type {
  AnswerResult,
  AuthResponse,
  Quiz,
  StudySession,
  Subject,
} from "@/lib/api/types";

// =============================================================================
// Verifica que o "cozinheiro fake" (MSW) responde corretamente em cada endpoint.
// O server MSW e o resetMockState() já estão configurados em tests/setup.ts.
// =============================================================================

describe("MSW handlers — Auth", () => {
  it("login devolve token e usuário", async () => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "yago@tempus.dev", password: "x" }),
    });
    const data = (await res.json()) as AuthResponse;
    expect(res.status).toBe(200);
    expect(data.access_token).toBe("fake-token");
    expect(data.user.email).toBe("yago@tempus.dev");
  });
});

describe("MSW handlers — Subjects (CRUD)", () => {
  it("começa com 3 matérias do seed", async () => {
    const res = await fetch("/api/subjects");
    const list = (await res.json()) as Subject[];
    expect(list).toHaveLength(3);
    expect(list[0].name).toBe("Cálculo I");
  });

  it("cria matéria nova e ela aparece na lista", async () => {
    const created = await fetch("/api/subjects", {
      method: "POST",
      body: JSON.stringify({ name: "Física", color: "#ff0000" }),
    });
    expect(created.status).toBe(201);

    const list = (await (await fetch("/api/subjects")).json()) as Subject[];
    expect(list).toHaveLength(4);
    expect(list.some((s) => s.name === "Física")).toBe(true);
  });

  it("rejeita matéria com nome duplicado (409)", async () => {
    const res = await fetch("/api/subjects", {
      method: "POST",
      body: JSON.stringify({ name: "Cálculo I" }),
    });
    expect(res.status).toBe(409);
  });

  it("edita e deleta uma matéria", async () => {
    await fetch("/api/subjects/s-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Cálculo II" }),
    });
    const updated = (await (await fetch("/api/subjects/s-1")).json()) as Subject;
    expect(updated.name).toBe("Cálculo II");

    const del = await fetch("/api/subjects/s-1", { method: "DELETE" });
    expect(del.status).toBe(204);

    const after = (await (await fetch("/api/subjects")).json()) as Subject[];
    expect(after.some((s) => s.id === "s-1")).toBe(false);
  });
});

describe("MSW handlers — Sessions (máquina de estados)", () => {
  it("fluxo completo: criar → pausar → retomar → completar", async () => {
    const created = (await (
      await fetch("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ subject_id: "s-1", planned_duration_seconds: 1500 }),
      })
    ).json()) as StudySession;
    expect(created.status).toBe("in_progress");

    const paused = (await (
      await fetch(`/api/sessions/${created.id}/pause`, { method: "PATCH" })
    ).json()) as StudySession;
    expect(paused.status).toBe("paused");

    const resumed = (await (
      await fetch(`/api/sessions/${created.id}/resume`, { method: "PATCH" })
    ).json()) as StudySession;
    expect(resumed.status).toBe("in_progress");

    const completed = (await (
      await fetch(`/api/sessions/${created.id}/complete`, { method: "PATCH" })
    ).json()) as StudySession;
    expect(completed.status).toBe("completed");
    expect(completed.ended_at).not.toBeNull();
  });

  it("bloqueia transição inválida: pausar sessão já pausada (400)", async () => {
    const created = (await (
      await fetch("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ planned_duration_seconds: 600 }),
      })
    ).json()) as StudySession;

    await fetch(`/api/sessions/${created.id}/pause`, { method: "PATCH" });
    const second = await fetch(`/api/sessions/${created.id}/pause`, { method: "PATCH" });
    expect(second.status).toBe(400);
  });
});

describe("MSW handlers — Quizzes (fluxo completo)", () => {
  it("gera quiz, responde tudo certo e fecha com 100%", async () => {
    const quiz = (await (
      await fetch("/api/quizzes/generate", {
        method: "POST",
        body: JSON.stringify({
          source_type: "general_topic",
          topic_description: "Derivadas",
          total_questions: 4,
        }),
      })
    ).json()) as Quiz;
    expect(quiz.status).toBe("pending");
    expect(quiz.questions).toHaveLength(4);

    await fetch(`/api/quizzes/${quiz.id}/start`, { method: "POST" });

    // Responde sempre com a alternativa correta (determinística no mock).
    for (const q of quiz.questions!) {
      const result = (await (
        await fetch(`/api/quizzes/${quiz.id}/questions/${q.id}/answer`, {
          method: "POST",
          body: JSON.stringify({ user_answer: q.correct_answer }),
        })
      ).json()) as AnswerResult;
      expect(result.is_correct).toBe(true);
    }

    const finished = (await (
      await fetch(`/api/quizzes/${quiz.id}/complete`, { method: "POST" })
    ).json()) as Quiz;
    expect(finished.status).toBe("completed");
    expect(finished.score).toBe(100);
  });

  it("rejeita gerar quiz general_topic sem topic_description (400)", async () => {
    const res = await fetch("/api/quizzes/generate", {
      method: "POST",
      body: JSON.stringify({ source_type: "general_topic", total_questions: 5 }),
    });
    expect(res.status).toBe(400);
  });
});
