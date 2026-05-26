// Este arquivo é gerado por `npm run gen:api` (openapi-typescript) a partir de
// http://localhost:8000/openapi.json. Não editar manualmente após o backend subir.
//
// Stubs temporários para destravar o frontend antes do contrato OpenAPI ficar pronto.

export type UUID = string;

// =============================================================================
// Comum
// =============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

// =============================================================================
// Auth / Users
// =============================================================================

export interface User {
  id: UUID;
  name: string;
  email: string;
  timezone: string;
  created_at: string;
}

export interface UpdateProfileInput {
  name?: string;
  timezone?: string;
}

export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
}

export interface DeleteAccountInput {
  password: string;
}

export interface EmailChangeRequestInput {
  new_email: string;
  current_password: string;
}

export interface EmailChangeConfirmInput {
  token: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
}

// =============================================================================
// Subjects
// =============================================================================

export interface Subject {
  id: UUID;
  name: string;
  color: string | null;
  description: string | null;
  weekly_goal_minutes: number | null;
  created_at: string;
}

export interface CreateSubjectInput {
  name: string;
  color?: string;
  description?: string;
  weekly_goal_minutes?: number;
}

export type UpdateSubjectInput = Partial<CreateSubjectInput>;

// =============================================================================
// Study Sessions
// =============================================================================

export type SessionStatus = "in_progress" | "paused" | "completed" | "abandoned";

export interface StudySession {
  id: UUID;
  user_id: UUID;
  subject_id: UUID | null;
  planned_duration_seconds: number;
  actual_duration_seconds: number;
  pause_duration_seconds: number;
  status: SessionStatus;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface CreateSessionInput {
  subject_id?: UUID;
  planned_duration_seconds: number;
  notes?: string;
}

export interface CompleteSessionInput {
  actual_duration_seconds: number;
  pause_duration_seconds: number;
  notes?: string;
}

// =============================================================================
// Quizzes
// =============================================================================

export type QuizStatus = "pending" | "in_progress" | "completed";
export type QuizSourceType = "documents" | "general_topic";
export type QuizOption = "a" | "b" | "c" | "d";

export interface QuizQuestion {
  id: UUID;
  quiz_id: UUID;
  question_index: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: QuizOption;
  explanation: string;
}

export interface Quiz {
  id: UUID;
  user_id: UUID;
  subject_id: UUID | null;
  title: string;
  source_type: QuizSourceType;
  topic_description: string | null;
  total_questions: number;
  score: number | null;
  status: QuizStatus;
  created_at: string;
  completed_at: string | null;
  questions?: QuizQuestion[];
}

export interface CreateQuizInput {
  subject_id?: UUID;
  source_type: QuizSourceType;
  topic_description?: string;
  document_ids?: UUID[];
  total_questions: number;
}

export interface AnswerInput {
  user_answer: QuizOption;
}

export interface AnswerResult {
  is_correct: boolean;
  correct_answer: QuizOption;
  explanation: string;
}

// =============================================================================
// Chat (UC10)
// =============================================================================

export type ChatRole = "user" | "assistant";

export interface ChatSource {
  id: UUID;
  document_id: UUID;
  chunk_id: UUID | null;
  page_number: number | null;
  snippet: string;
  score: number | null;
  rank: number;
}

export interface ChatMessage {
  id: UUID;
  session_id: UUID;
  role: ChatRole;
  content: string;
  created_at: string;
  sources: ChatSource[];
}

export interface ChatSession {
  id: UUID;
  user_id: UUID;
  subject_id: UUID | null;
  title: string;
  created_at: string;
  last_message_at: string;
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[];
}

export interface AskRequest {
  subject_id?: UUID;
  question: string;
}

export interface AskResponse {
  session_id: UUID;
  message: ChatMessage;
}

export interface RenameSessionInput {
  title: string;
}

// =============================================================================
// Notebooks + Notes
// =============================================================================

export interface Notebook {
  id: UUID;
  user_id: UUID;
  title: string;
  description: string | null;
  color: string;
  pinned: boolean;
  // Agregado calculado no backend: COUNT(notes) por notebook.
  notes_count: number;
  // Agregado calculado no backend: GREATEST(notebook.updated_at, MAX(notes.updated_at)).
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNotebookInput {
  title: string;
  description?: string;
  color?: string;
}

export interface UpdateNotebookInput {
  title?: string;
  description?: string | null;
  color?: string;
  pinned?: boolean;
}

export interface Note {
  id: UUID;
  notebook_id: UUID;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteInput {
  title: string;
  content?: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
}

export interface NoteSummary {
  summary: string;
}

// =============================================================================
// Documents
// =============================================================================

export type DocumentStatus = "processing" | "ready" | "failed";

export interface Document {
  id: UUID;
  user_id: UUID;
  subject_id: UUID | null;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  total_pages: number | null;
  total_chunks: number;
  status: DocumentStatus;
  error_message: string | null;
  uploaded_at: string;
  processed_at: string | null;
}

export interface UploadDocumentInput {
  file: File;
  subject_id?: UUID;
}
