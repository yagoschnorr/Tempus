import { http, HttpResponse } from "msw";
import type {
  AnswerInput,
  AnswerResult,
  AskRequest,
  AskResponse,
  AuthResponse,
  ChangePasswordInput,
  ChatMessage,
  ChatSession,
  ChatSessionDetail,
  CreateNoteInput,
  CreateNotebookInput,
  CreateQuizInput,
  CreateSessionInput,
  CreateSubjectInput,
  DeleteAccountInput,
  Note,
  NoteSummary,
  Notebook,
  Quiz,
  QuizOption,
  QuizQuestion,
  RenameSessionInput,
  StudySession,
  Subject,
  UpdateNoteInput,
  UpdateNotebookInput,
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
let chatSessions: ChatSession[] = [];
const chatMessages = new Map<UUID, ChatMessage[]>();
// Notebooks: representação "fria" (sem agregados). Os agregados notes_count
// e last_activity_at são calculados no momento da resposta a partir do mapa
// notesByNotebook — espelha o que o backend faz com COUNT/MAX em SQL.
interface NotebookRow {
  id: UUID;
  user_id: UUID;
  title: string;
  description: string | null;
  color: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}
let notebookRows: NotebookRow[] = [];
const notesByNotebook = new Map<UUID, Note[]>();
let counter = 100;

export const resetMockState = () => {
  subjects = seedSubjects();
  sessions = [];
  quizzes = [];
  quizAnswers.clear();
  chatSessions = [];
  chatMessages.clear();
  notebookRows = [];
  notesByNotebook.clear();
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

  // Endpoints de troca de email NÃO têm mock: o pattern `/api/auth/*` do
  // passthrough em browser.ts só cobre paths de 1 segmento (ex: `/api/auth/me`).
  // Para `/api/auth/me/email/change-request` cair direto no backend, basta
  // não ter handler aqui — MSW deixa requests sem match seguirem pra rede.
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
// Chat (UC10)
// =============================================================================

function buildTitle(question: string): string {
  const cleaned = question.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 60) return cleaned;
  return cleaned.slice(0, 59).trimEnd() + "…";
}

function mockAnswer(question: string): string {
  // Resposta determinística mas levemente "personalizada" pela pergunta.
  return (
    `Resposta simulada do mock para: "${question.slice(0, 80)}".\n\n` +
    "Esse texto vem do MSW; quando o backend real estiver disponível, " +
    "ele será substituído pela resposta da IA."
  );
}

const chatHandlers = [
  http.get("/api/chat/sessions", ({ request }) => {
    const url = new URL(request.url);
    const subjectId = url.searchParams.get("subject_id");
    const list = subjectId
      ? chatSessions.filter((s) => s.subject_id === subjectId)
      : chatSessions;
    const sorted = [...list].sort((a, b) =>
      b.last_message_at.localeCompare(a.last_message_at)
    );
    return HttpResponse.json(sorted);
  }),

  http.get("/api/chat/sessions/:id", ({ params }) => {
    const session = chatSessions.find((s) => s.id === params.id);
    if (!session) return error(404, "conversa não encontrada");
    const detail: ChatSessionDetail = {
      ...session,
      messages: chatMessages.get(session.id) ?? [],
    };
    return HttpResponse.json(detail);
  }),

  http.patch("/api/chat/sessions/:id", async ({ params, request }) => {
    const session = chatSessions.find((s) => s.id === params.id);
    if (!session) return error(404, "conversa não encontrada");
    const body = (await request.json()) as RenameSessionInput;
    if (!body?.title?.trim()) return error(400, "title é obrigatório");
    session.title = body.title.trim();
    return HttpResponse.json(session);
  }),

  http.delete("/api/chat/sessions/:id", ({ params }) => {
    const idx = chatSessions.findIndex((s) => s.id === params.id);
    if (idx === -1) return error(404, "conversa não encontrada");
    chatSessions.splice(idx, 1);
    chatMessages.delete(params.id as UUID);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/chat/ask", async ({ request }) => {
    const body = (await request.json()) as AskRequest;
    if (!body?.subject_id) {
      return error(422, "subject_id é obrigatório para iniciar uma conversa");
    }
    if (!body.question?.trim()) {
      return error(422, "question é obrigatório");
    }
    const sessionId = newId("cs") as UUID;
    const session: ChatSession = {
      id: sessionId,
      user_id: fakeUser.id,
      subject_id: body.subject_id,
      title: buildTitle(body.question),
      created_at: now(),
      last_message_at: now(),
    };
    chatSessions.unshift(session);

    const userMsg: ChatMessage = {
      id: newId("cm") as UUID,
      session_id: sessionId,
      role: "user",
      content: body.question,
      created_at: now(),
      sources: [],
    };
    const assistantMsg: ChatMessage = {
      id: newId("cm") as UUID,
      session_id: sessionId,
      role: "assistant",
      content: mockAnswer(body.question),
      created_at: now(),
      sources: [],
    };
    chatMessages.set(sessionId, [userMsg, assistantMsg]);

    const res: AskResponse = { session_id: sessionId, message: assistantMsg };
    return HttpResponse.json(res, { status: 201 });
  }),

  http.post("/api/chat/sessions/:id/ask", async ({ params, request }) => {
    const session = chatSessions.find((s) => s.id === params.id);
    if (!session) return error(404, "conversa não encontrada");
    const body = (await request.json()) as AskRequest;
    if (!body.question?.trim()) return error(422, "question é obrigatório");

    const list = chatMessages.get(session.id) ?? [];
    const userMsg: ChatMessage = {
      id: newId("cm") as UUID,
      session_id: session.id,
      role: "user",
      content: body.question,
      created_at: now(),
      sources: [],
    };
    const assistantMsg: ChatMessage = {
      id: newId("cm") as UUID,
      session_id: session.id,
      role: "assistant",
      content: mockAnswer(body.question),
      created_at: now(),
      sources: [],
    };
    list.push(userMsg, assistantMsg);
    chatMessages.set(session.id, list);
    session.last_message_at = assistantMsg.created_at;

    const res: AskResponse = {
      session_id: session.id,
      message: assistantMsg,
    };
    return HttpResponse.json(res);
  }),
];

// =============================================================================
// Notebooks + Notes
// =============================================================================

function notebookAggregates(notebookId: UUID): {
  notes_count: number;
  max_note_updated_at: string | null;
} {
  const list = notesByNotebook.get(notebookId) ?? [];
  if (list.length === 0) return { notes_count: 0, max_note_updated_at: null };
  const max = list.reduce(
    (acc, n) => (n.updated_at > acc ? n.updated_at : acc),
    list[0].updated_at
  );
  return { notes_count: list.length, max_note_updated_at: max };
}

function toNotebookOut(row: NotebookRow): Notebook {
  const { notes_count, max_note_updated_at } = notebookAggregates(row.id);
  const last_activity_at =
    max_note_updated_at && max_note_updated_at > row.updated_at
      ? max_note_updated_at
      : row.updated_at;
  return { ...row, notes_count, last_activity_at };
}

function findNote(noteId: UUID): { note: Note; notebookId: UUID } | null {
  for (const [notebookId, list] of notesByNotebook.entries()) {
    const note = list.find((n) => n.id === noteId);
    if (note) return { note, notebookId };
  }
  return null;
}

const notebooksHandlers = [
  http.get("/api/notebooks", () => {
    const outs = notebookRows.map(toNotebookOut);
    // Fixados primeiro; dentro de cada grupo, ordena por last_activity_at desc.
    outs.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.last_activity_at.localeCompare(a.last_activity_at);
    });
    return HttpResponse.json(outs);
  }),

  http.post("/api/notebooks", async ({ request }) => {
    const body = (await request.json()) as CreateNotebookInput;
    if (!body?.title?.trim()) return error(422, "title é obrigatório");
    const stamp = now();
    const row: NotebookRow = {
      id: newId("nb") as UUID,
      user_id: fakeUser.id,
      title: body.title.trim(),
      description: body.description ?? null,
      color: body.color ?? "#0F6E56",
      pinned: false,
      created_at: stamp,
      updated_at: stamp,
    };
    notebookRows.push(row);
    notesByNotebook.set(row.id, []);
    return HttpResponse.json(toNotebookOut(row), { status: 201 });
  }),

  http.patch("/api/notebooks/:id", async ({ params, request }) => {
    const row = notebookRows.find((n) => n.id === params.id);
    if (!row) return error(404, "Notebook não encontrado");
    const body = (await request.json()) as UpdateNotebookInput;
    if (body.title !== undefined) {
      if (!body.title.trim()) return error(422, "title não pode ser vazio");
      row.title = body.title.trim();
    }
    if (body.description !== undefined) row.description = body.description;
    if (body.color !== undefined) row.color = body.color;
    if (body.pinned !== undefined) row.pinned = body.pinned;
    row.updated_at = now();
    return HttpResponse.json(toNotebookOut(row));
  }),

  http.delete("/api/notebooks/:id", ({ params }) => {
    const idx = notebookRows.findIndex((n) => n.id === params.id);
    if (idx === -1) return error(404, "Notebook não encontrado");
    notebookRows.splice(idx, 1);
    notesByNotebook.delete(params.id as UUID);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/api/notebooks/:id/notes", ({ params }) => {
    if (!notebookRows.some((n) => n.id === params.id)) {
      return error(404, "Notebook não encontrado");
    }
    const list = notesByNotebook.get(params.id as UUID) ?? [];
    // Ordem espelha o backend: updated_at desc (note mais recente primeiro).
    const sorted = [...list].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at)
    );
    return HttpResponse.json(sorted);
  }),

  http.post("/api/notebooks/:id/notes", async ({ params, request }) => {
    if (!notebookRows.some((n) => n.id === params.id)) {
      return error(404, "Notebook não encontrado");
    }
    const body = (await request.json()) as CreateNoteInput;
    if (!body?.title?.trim()) return error(422, "title é obrigatório");
    const stamp = now();
    const note: Note = {
      id: newId("nt") as UUID,
      notebook_id: params.id as UUID,
      title: body.title.trim(),
      content: body.content ?? "",
      created_at: stamp,
      updated_at: stamp,
    };
    notesByNotebook.get(params.id as UUID)!.push(note);
    return HttpResponse.json(note, { status: 201 });
  }),

  http.patch("/api/notebooks/notes/:id", async ({ params, request }) => {
    const found = findNote(params.id as UUID);
    if (!found) return error(404, "Note não encontrada");
    const body = (await request.json()) as UpdateNoteInput;
    if (body.title !== undefined) {
      if (!body.title.trim()) return error(422, "title não pode ser vazio");
      found.note.title = body.title.trim();
    }
    if (body.content !== undefined) found.note.content = body.content;
    found.note.updated_at = now();
    return HttpResponse.json(found.note);
  }),

  http.delete("/api/notebooks/notes/:id", ({ params }) => {
    const found = findNote(params.id as UUID);
    if (!found) return error(404, "Note não encontrada");
    const list = notesByNotebook.get(found.notebookId)!;
    list.splice(list.indexOf(found.note), 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/notebooks/notes/:id/summary", ({ params }) => {
    const found = findNote(params.id as UUID);
    if (!found) return error(404, "Note não encontrada");
    if (!found.note.content.trim()) {
      return error(
        422,
        "A note está vazia; adicione conteúdo antes de gerar o resumo."
      );
    }
    const res: NoteSummary = {
      summary: `Resumo simulado: ${found.note.content.slice(0, 60)}…`,
    };
    return HttpResponse.json(res);
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
  ...chatHandlers,
  ...notebooksHandlers,
];
