import { api } from "@/lib/api/client";
import type {
  AnswerInput,
  AnswerResult,
  CreateQuizInput,
  Quiz,
  UUID,
} from "@/lib/api/types";

export const quizzesApi = {
  list() {
    return api<Quiz[]>("/quizzes");
  },

  get(id: UUID) {
    return api<Quiz>(`/quizzes/${id}`);
  },

  generate(input: CreateQuizInput) {
    return api<Quiz>("/quizzes/generate", { method: "POST", json: input });
  },

  start(id: UUID) {
    return api<Quiz>(`/quizzes/${id}/start`, { method: "POST" });
  },

  answer(quizId: UUID, questionId: UUID, input: AnswerInput) {
    return api<AnswerResult>(`/quizzes/${quizId}/questions/${questionId}/answer`, {
      method: "POST",
      json: input,
    });
  },

  complete(id: UUID) {
    return api<Quiz>(`/quizzes/${id}/complete`, { method: "POST" });
  },

  restart(id: UUID) {
    return api<Quiz>(`/quizzes/${id}/restart`, { method: "POST" });
  },

  remove(id: UUID) {
    return api<void>(`/quizzes/${id}`, { method: "DELETE" });
  },
};
