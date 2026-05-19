import { useCallback, useState } from "react";
import { getErrorMessage } from "@/lib/api/client";
import type {
  AnswerResult,
  CreateQuizInput,
  Quiz,
  QuizOption,
  QuizQuestion,
} from "@/lib/api/types";
import { quizzesApi } from "../api";

export type QuizPhase = "idle" | "generating" | "in_progress" | "completed";

interface UseQuiz {
  phase: QuizPhase;
  quiz: Quiz | null;
  currentIndex: number;
  currentQuestion: QuizQuestion | null;
  answerResult: AnswerResult | null;
  results: AnswerResult[];
  isLast: boolean;
  error: string | null;
  generate: (input: CreateQuizInput) => Promise<void>;
  answerCurrent: (option: QuizOption) => Promise<void>;
  next: () => void;
  complete: () => Promise<void>;
  reset: () => void;
}

export function useQuiz(): UseQuiz {
  const [phase, setPhase] = useState<QuizPhase>("idle");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const questions = quiz?.questions ?? [];
  const currentQuestion = questions[currentIndex] ?? null;
  const isLast = quiz ? currentIndex === quiz.total_questions - 1 : false;

  const generate = useCallback(async (input: CreateQuizInput) => {
    setError(null);
    setPhase("generating");
    try {
      const created = await quizzesApi.generate(input);
      const started = await quizzesApi.start(created.id);
      // start não devolve as questions; mantemos as do generate
      setQuiz({ ...started, questions: created.questions });
      setCurrentIndex(0);
      setAnswerResult(null);
      setResults([]);
      setPhase("in_progress");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível gerar o quiz"));
      setPhase("idle");
      throw err;
    }
  }, []);

  const answerCurrent = useCallback(
    async (option: QuizOption) => {
      if (!quiz || !currentQuestion || answerResult) return;
      try {
        const result = await quizzesApi.answer(quiz.id, currentQuestion.id, {
          user_answer: option,
        });
        setAnswerResult(result);
        setResults((prev) => [...prev, result]);
      } catch (err) {
        setError(getErrorMessage(err, "Não foi possível enviar resposta"));
      }
    },
    [quiz, currentQuestion, answerResult]
  );

  const next = useCallback(() => {
    if (isLast) return;
    setCurrentIndex((i) => i + 1);
    setAnswerResult(null);
  }, [isLast]);

  const complete = useCallback(async () => {
    if (!quiz) return;
    try {
      const finished = await quizzesApi.complete(quiz.id);
      setQuiz({ ...finished, questions: quiz.questions });
      setPhase("completed");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível concluir o quiz"));
    }
  }, [quiz]);

  const reset = useCallback(() => {
    setPhase("idle");
    setQuiz(null);
    setCurrentIndex(0);
    setAnswerResult(null);
    setResults([]);
    setError(null);
  }, []);

  return {
    phase,
    quiz,
    currentIndex,
    currentQuestion,
    answerResult,
    results,
    isLast,
    error,
    generate,
    answerCurrent,
    next,
    complete,
    reset,
  };
}
