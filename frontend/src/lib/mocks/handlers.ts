import { http, HttpResponse } from "msw";
import type {
  AnswerInput,
  AnswerResult,
  AuthResponse,
  ChangePasswordInput,
  CreateQuizInput,
  CreateSessionInput,
  CreateSubjectInput,
  DeleteAccountInput,
  Quiz,
  QuizOption,
  QuizQuestion,
  StudySession,
  Subject,
  UpdateProfileInput,
  UpdateSubjectInput,
  UUID,
  User,
} from "../api/types";

// =============================================================================
// Estado em memória (mutável entre requests; resetMockState() limpa para testes)
// =============================================================================

let fakeUser: User = {
  id: "u-1",
  name: "Yago",
  email: "yago@tempus.dev",
  timezone: "America/Belem",
  created_at: new Date().toISOString(),
};

// senha do mock — só usada pra simular re-autenticação no PATCH /password e DELETE /me
let fakeUserPassword = "senha-de-teste";

const seedSubjects = (): Subject[] => [
  {
    id: "s-1",
    name: "Cálculo I",
    color: "#3b82f6",
    description: "Limites, derivadas, integrais",
    weekly_goal_minutes: 600,
    created_at: new Date().toISOString(),
  },
  {
    id: "s-2",
    name: "Algoritmos",
    color: "#a855f7",
    description: "Complexidade, ordenação, grafos",
    weekly_goal_minutes: 480,
    created_at: new Date().toISOString(),
  },
  {
    id: "s-3",
    name: "Banco de Dados",
    color: "#10b981",
    description: "SQL, normalização, transações",
    weekly_goal_minutes: 360,
    created_at: new Date().toISOString(),
  },
];

let subjects: Subject[] = seedSubjects();
let sessions: StudySession[] = [];
let quizzes: Quiz[] = [];
const quizAnswers = new Map<UUID, AnswerResult[]>();
let counter = 100;

export const resetMockState = () => {
  subjects = seedSubjects();
  sessions = [];
  quizzes = [];
  quizAnswers.clear();
  counter = 100;
};

// =============================================================================
// Helpers
// =============================================================================

const newId = (prefix: string) => `${prefix}-${counter++}`;
const now = () => new Date().toISOString();
const error = (status: number, detail: string) =>
  HttpResponse.json({ detail }, { status });

// =============================================================================
// Auth
// =============================================================================

const authHandlers = [
  http.post("/api/auth/login", () => {
    const res: AuthResponse = { user: fakeUser, access_token: "fake-token" };
    return HttpResponse.json(res);
  }),

  http.post("/api/auth/register", () => {
    const res: AuthResponse = { user: fakeUser, access_token: "fake-token" };
    return HttpResponse.json(res);
  }),

  http.get("/api/auth/me", () => HttpResponse.json(fakeUser)),

  http.patch("/api/auth/me", async ({ request }) => {
    const body = (await request.json()) as UpdateProfileInput;
    if (body.name !== undefined) {
      const trimmed = body.name.trim();
      if (!trimmed) return error(400, "nome não pode ser vazio");
      fakeUser = { ...fakeUser, name: trimmed };
    }
    if (body.timezone !== undefined) {
      if (!body.timezone.trim()) return error(400, "timezone inválida");
      fakeUser = { ...fakeUser, timezone: body.timezone };
    }
    return HttpResponse.json(fakeUser);
  }),

  http.patch("/api/auth/me/password", async ({ request }) => {
    const body = (await request.json()) as ChangePasswordInput;
    if (body.current_password !== fakeUserPassword) {
      return error(400, "senha atual incorreta");
    }
    if (!body.new_password || body.new_password.length < 8) {
      return error(400, "nova senha deve ter ao menos 8 caracteres");
    }
    fakeUserPassword = body.new_password;
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("/api/auth/me", async ({ request }) => {
    const body = (await request.json()) as DeleteAccountInput;
    if (body.password !== fakeUserPassword) {
      return error(400, "senha incorreta");
    }
    // No mock só limpamos o estado em memória — frontend trata o logout depois do 204
    resetMockState();
    return new HttpResponse(null, { status: 204 });
  }),
];

// =============================================================================
// Subjects (CRUD)
// =============================================================================

const subjectsHandlers = [
  http.get("/api/subjects", () => HttpResponse.json(subjects)),

  http.post("/api/subjects", async ({ request }) => {
    const body = (await request.json()) as CreateSubjectInput;
    if (!body?.name?.trim()) return error(400, "name é obrigatório");
    if (subjects.some((s) => s.name === body.name)) {
      return error(409, "já existe matéria com esse nome");
    }
    const subject: Subject = {
      id: newId("s"),
      name: body.name,
      color: body.color ?? "#534AB7",
      description: body.description ?? null,
      weekly_goal_minutes: body.weekly_goal_minutes ?? 0,
      created_at: now(),
    };
    subjects.push(subject);
    return HttpResponse.json(subject, { status: 201 });
  }),

  http.get("/api/subjects/:id", ({ params }) => {
    const subject = subjects.find((s) => s.id === params.id);
    if (!subject) return error(404, "matéria não encontrada");
    return HttpResponse.json(subject);
  }),

  http.patch("/api/subjects/:id", async ({ params, request }) => {
    const subject = subjects.find((s) => s.id === params.id);
    if (!subject) return error(404, "matéria não encontrada");
    const body = (await request.json()) as UpdateSubjectInput;
    Object.assign(subject, body);
    return HttpResponse.json(subject);
  }),

  http.delete("/api/subjects/:id", ({ params }) => {
    const idx = subjects.findIndex((s) => s.id === params.id);
    if (idx === -1) return error(404, "matéria não encontrada");
    subjects.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];

// =============================================================================
// Sessions (Timer) — máquina de estados in_progress ↔ paused → completed/abandoned
// =============================================================================

const sessionsHandlers = [
  http.get("/api/sessions", () => HttpResponse.json(sessions)),

  http.post("/api/sessions", async ({ request }) => {
    const body = (await request.json()) as CreateSessionInput;
    if (!body?.planned_duration_seconds || body.planned_duration_seconds <= 0) {
      return error(400, "planned_duration_seconds deve ser > 0");
    }
    const session: StudySession = {
      id: newId("ss"),
      user_id: fakeUser.id,
      subject_id: body.subject_id ?? null,
      planned_duration_seconds: body.planned_duration_seconds,
      actual_duration_seconds: 0,
      pause_duration_seconds: 0,
      status: "in_progress",
      notes: null,
      started_at: now(),
      ended_at: null,
    };
    sessions.push(session);
    return HttpResponse.json(session, { status: 201 });
  }),

  http.patch("/api/sessions/:id/pause", ({ params }) => {
    const session = sessions.find((s) => s.id === params.id);
    if (!session) return error(404, "sessão não encontrada");
    if (session.status !== "in_progress") {
      return error(400, `não é possível pausar sessão ${session.status}`);
    }
    session.status = "paused";
    return HttpResponse.json(session);
  }),

  http.patch("/api/sessions/:id/resume", ({ params }) => {
    const session = sessions.find((s) => s.id === params.id);
    if (!session) return error(404, "sessão não encontrada");
    if (session.status !== "paused") {
      return error(400, `não é possível retomar sessão ${session.status}`);
    }
    session.status = "in_progress";
    return HttpResponse.json(session);
  }),

  http.patch("/api/sessions/:id/complete", ({ params }) => {
    const session = sessions.find((s) => s.id === params.id);
    if (!session) return error(404, "sessão não encontrada");
    if (session.status === "completed" || session.status === "abandoned") {
      return error(400, `sessão já está ${session.status}`);
    }
    session.status = "completed";
    session.ended_at = now();
    return HttpResponse.json(session);
  }),

  http.patch("/api/sessions/:id/abandon", ({ params }) => {
    const session = sessions.find((s) => s.id === params.id);
    if (!session) return error(404, "sessão não encontrada");
    if (session.status === "completed" || session.status === "abandoned") {
      return error(400, `sessão já está ${session.status}`);
    }
    session.status = "abandoned";
    session.ended_at = now();
    return HttpResponse.json(session);
  }),
];

// =============================================================================
// Quizzes — gerar (fake), iniciar, responder (com feedback) e finalizar (score)
// =============================================================================

const optionFor = (i: number): QuizOption =>
  (["a", "b", "c", "d"] as const)[i % 4];

const generateQuestions = (
  quizId: UUID,
  total: number,
  topic: string
): QuizQuestion[] =>
  Array.from({ length: total }, (_, i) => ({
    id: newId("q"),
    quiz_id: quizId,
    question_index: i,
    question_text: `Pergunta ${i + 1} sobre "${topic}": qual alternativa é correta?`,
    option_a: `Alternativa A da pergunta ${i + 1}`,
    option_b: `Alternativa B da pergunta ${i + 1}`,
    option_c: `Alternativa C da pergunta ${i + 1}`,
    option_d: `Alternativa D da pergunta ${i + 1}`,
    correct_answer: optionFor(i),
    explanation: `A resposta correta é "${optionFor(i)}" — exemplo de explicação gerada pela IA.`,
  }));

const quizzesHandlers = [
  http.get("/api/quizzes", () =>
    HttpResponse.json(quizzes.map(({ questions: _q, ...rest }) => rest))
  ),

  http.get("/api/quizzes/:id", ({ params }) => {
    const quiz = quizzes.find((q) => q.id === params.id);
    if (!quiz) return error(404, "quiz não encontrado");
    return HttpResponse.json(quiz);
  }),

  http.post("/api/quizzes/generate", async ({ request }) => {
    const body = (await request.json()) as CreateQuizInput;
    if (!body?.total_questions || body.total_questions <= 0) {
      return error(400, "total_questions deve ser > 0");
    }
    if (body.source_type === "general_topic" && !body.topic_description?.trim()) {
      return error(400, "topic_description é obrigatório para general_topic");
    }
    if (body.source_type === "documents" && !body.document_ids?.length) {
      return error(400, "document_ids é obrigatório para source_type=documents");
    }

    const id = newId("qz");
    const topic = body.topic_description ?? "documentos selecionados";
    const quiz: Quiz = {
      id,
      user_id: fakeUser.id,
      subject_id: body.subject_id ?? null,
      title: `Quiz: ${topic.slice(0, 60)}`,
      source_type: body.source_type,
      topic_description: body.topic_description ?? null,
      total_questions: body.total_questions,
      score: null,
      status: "pending",
      created_at: now(),
      completed_at: null,
      questions: generateQuestions(id, body.total_questions, topic),
    };
    quizzes.push(quiz);
    quizAnswers.set(id, []);
    return HttpResponse.json(quiz, { status: 201 });
  }),

  http.post("/api/quizzes/:id/start", ({ params }) => {
    const quiz = quizzes.find((q) => q.id === params.id);
    if (!quiz) return error(404, "quiz não encontrado");
    if (quiz.status !== "pending") {
      return error(400, `quiz já está ${quiz.status}`);
    }
    quiz.status = "in_progress";
    return HttpResponse.json(quiz);
  }),

  http.post(
    "/api/quizzes/:id/questions/:qid/answer",
    async ({ params, request }) => {
      const quiz = quizzes.find((q) => q.id === params.id);
      if (!quiz) return error(404, "quiz não encontrado");
      if (quiz.status !== "in_progress") {
        return error(400, "quiz precisa estar in_progress");
      }
      const question = quiz.questions?.find((q) => q.id === params.qid);
      if (!question) return error(404, "pergunta não encontrada");

      const body = (await request.json()) as AnswerInput;
      if (!["a", "b", "c", "d"].includes(body?.user_answer)) {
        return error(400, "user_answer deve ser 'a', 'b', 'c' ou 'd'");
      }

      const result: AnswerResult = {
        is_correct: body.user_answer === question.correct_answer,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
      };
      quizAnswers.get(quiz.id)?.push(result);
      return HttpResponse.json(result);
    }
  ),

  http.post("/api/quizzes/:id/complete", ({ params }) => {
    const quiz = quizzes.find((q) => q.id === params.id);
    if (!quiz) return error(404, "quiz não encontrado");
    if (quiz.status !== "in_progress") {
      return error(400, "quiz precisa estar in_progress");
    }
    const answers = quizAnswers.get(quiz.id) ?? [];
    const correct = answers.filter((a) => a.is_correct).length;
    quiz.score = Math.round((correct / quiz.total_questions) * 100);
    quiz.status = "completed";
    quiz.completed_at = now();
    return HttpResponse.json(quiz);
  }),

  http.post("/api/quizzes/:id/restart", ({ params }) => {
    const quiz = quizzes.find((q) => q.id === params.id);
    if (!quiz) return error(404, "quiz não encontrado");
    quiz.status = "in_progress";
    quiz.score = null;
    quiz.completed_at = null;
    quizAnswers.set(quiz.id, []);
    return HttpResponse.json(quiz);
  }),

  http.delete("/api/quizzes/:id", ({ params }) => {
    const idx = quizzes.findIndex((q) => q.id === params.id);
    if (idx === -1) return error(404, "quiz não encontrado");
    quizzes.splice(idx, 1);
    quizAnswers.delete(params.id as UUID);
    return new HttpResponse(null, { status: 204 });
  }),
];

// =============================================================================
// Aggregate
// =============================================================================

export const handlers = [
  ...authHandlers,
  ...subjectsHandlers,
  ...sessionsHandlers,
  ...quizzesHandlers,
];
