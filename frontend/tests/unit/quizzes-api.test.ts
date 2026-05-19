import { describe, it, expect } from "vitest";
import { quizzesApi } from "@/features/quiz/api";
import { ApiError } from "@/lib/api/client";

describe("quizzesApi", () => {
  it("generate cria quiz pendente com perguntas", async () => {
    const quiz = await quizzesApi.generate({
      source_type: "general_topic",
      topic_description: "Derivadas",
      total_questions: 5,
    });
    expect(quiz.status).toBe("pending");
    expect(quiz.questions).toHaveLength(5);
    expect(quiz.source_type).toBe("general_topic");
  });

  it("rejeita generate general_topic sem topic_description", async () => {
    await expect(
      quizzesApi.generate({
        source_type: "general_topic",
        total_questions: 5,
      })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("start muda status para in_progress", async () => {
    const quiz = await quizzesApi.generate({
      source_type: "general_topic",
      topic_description: "X",
      total_questions: 3,
    });
    const started = await quizzesApi.start(quiz.id);
    expect(started.status).toBe("in_progress");
  });

  it("answer devolve is_correct e correct_answer", async () => {
    const quiz = await quizzesApi.generate({
      source_type: "general_topic",
      topic_description: "Y",
      total_questions: 3,
    });
    await quizzesApi.start(quiz.id);
    const q = quiz.questions![0];
    const result = await quizzesApi.answer(quiz.id, q.id, {
      user_answer: q.correct_answer,
    });
    expect(result.is_correct).toBe(true);
    expect(result.correct_answer).toBe(q.correct_answer);
  });

  it("complete calcula score baseado nas respostas", async () => {
    const quiz = await quizzesApi.generate({
      source_type: "general_topic",
      topic_description: "Z",
      total_questions: 4,
    });
    await quizzesApi.start(quiz.id);
    // responde só metade certo
    for (let i = 0; i < quiz.questions!.length; i++) {
      const q = quiz.questions![i];
      await quizzesApi.answer(quiz.id, q.id, {
        user_answer: i % 2 === 0 ? q.correct_answer : "a",
      });
    }
    const finished = await quizzesApi.complete(quiz.id);
    expect(finished.status).toBe("completed");
    expect(typeof finished.score).toBe("number");
  });
});
