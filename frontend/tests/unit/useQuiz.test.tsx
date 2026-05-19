import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useQuiz } from "@/features/quiz/hooks/useQuiz";

describe("useQuiz", () => {
  it("começa em idle", () => {
    const { result } = renderHook(() => useQuiz());
    expect(result.current.phase).toBe("idle");
    expect(result.current.quiz).toBeNull();
  });

  it("generate carrega quiz e entra em in_progress", async () => {
    const { result } = renderHook(() => useQuiz());

    await act(async () => {
      await result.current.generate({
        source_type: "general_topic",
        topic_description: "Cálculo",
        total_questions: 3,
      });
    });

    await waitFor(() => expect(result.current.phase).toBe("in_progress"));
    expect(result.current.quiz?.questions).toHaveLength(3);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentQuestion).not.toBeNull();
  });

  it("answerCurrent devolve feedback e impede dupla resposta", async () => {
    const { result } = renderHook(() => useQuiz());
    await act(async () => {
      await result.current.generate({
        source_type: "general_topic",
        topic_description: "X",
        total_questions: 2,
      });
    });

    const correct = result.current.currentQuestion!.correct_answer;

    await act(async () => {
      await result.current.answerCurrent(correct);
    });
    expect(result.current.answerResult?.is_correct).toBe(true);
    expect(result.current.results).toHaveLength(1);

    // segunda chamada não deve adicionar novo result
    await act(async () => {
      await result.current.answerCurrent("a");
    });
    expect(result.current.results).toHaveLength(1);
  });

  it("next avança e limpa o feedback", async () => {
    const { result } = renderHook(() => useQuiz());
    await act(async () => {
      await result.current.generate({
        source_type: "general_topic",
        topic_description: "X",
        total_questions: 3,
      });
    });

    await act(async () => {
      await result.current.answerCurrent("a");
    });
    expect(result.current.answerResult).not.toBeNull();

    act(() => result.current.next());
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.answerResult).toBeNull();
    expect(result.current.isLast).toBe(false);
  });

  it("isLast vira true na última e complete fecha o quiz", async () => {
    const { result } = renderHook(() => useQuiz());
    await act(async () => {
      await result.current.generate({
        source_type: "general_topic",
        topic_description: "X",
        total_questions: 2,
      });
    });

    // pergunta 1
    await act(async () => {
      await result.current.answerCurrent(result.current.currentQuestion!.correct_answer);
    });
    act(() => result.current.next());

    // pergunta 2 (última)
    expect(result.current.isLast).toBe(true);
    await act(async () => {
      await result.current.answerCurrent(result.current.currentQuestion!.correct_answer);
    });

    await act(async () => {
      await result.current.complete();
    });

    expect(result.current.phase).toBe("completed");
    expect(result.current.quiz?.score).toBe(100);
  });

  it("reset volta ao idle", async () => {
    const { result } = renderHook(() => useQuiz());
    await act(async () => {
      await result.current.generate({
        source_type: "general_topic",
        topic_description: "X",
        total_questions: 1,
      });
    });

    act(() => result.current.reset());
    expect(result.current.phase).toBe("idle");
    expect(result.current.quiz).toBeNull();
  });
});
