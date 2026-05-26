import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  FileText,
  History,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { useSubjects } from "@/features/subjects/hooks/useSubjects";
import { useDocuments } from "@/features/documents/hooks/useDocuments";
import type { Quiz, QuizOption, QuizSourceType, QuizStatus } from "@/lib/api/types";
import { useQuiz } from "./hooks/useQuiz";
import { DeleteQuizDialog } from "./components/DeleteQuizDialog";

const OPTIONS: QuizOption[] = ["a", "b", "c", "d"];

const STATUS_LABEL: Record<QuizStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluído",
};

const STATUS_STYLE: Record<QuizStatus, string> = {
  pending: "bg-ink-800 text-ink-300 border border-ink-700",
  in_progress: "bg-info-500/15 text-info-500 border border-info-500/30",
  completed: "bg-success-500/15 text-success-400 border border-success-500/30",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default function QuizPage() {
  const { subjects } = useSubjects();
  const { documents } = useDocuments();
  const quiz = useQuiz();

  // Setup
  const [source, setSource] = useState<QuizSourceType>("general_topic");
  const [subjectId, setSubjectId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  const readyDocs = useMemo(
    () => documents.filter((d) => d.status === "ready"),
    [documents],
  );

  function toggleDoc(id: string) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // History interactions
  const [toDelete, setToDelete] = useState<Quiz | null>(null);
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleRestart(id: string) {
    setRestartingId(id);
    try {
      await quiz.restartQuiz(id);
    } catch {
      setToast({ kind: "error", message: "Não foi possível reiniciar o quiz" });
    } finally {
      setRestartingId(null);
    }
  }

  async function handleDelete(id: string) {
    await quiz.deleteQuiz(id);
    setToast({ kind: "success", message: "Quiz excluído" });
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (source === "general_topic" && !topic.trim()) return;
    if (source === "documents" && selectedDocs.size === 0) return;
    try {
      if (source === "documents") {
        await quiz.generate({
          source_type: "documents",
          document_ids: [...selectedDocs],
          topic_description: topic.trim() || undefined,
          total_questions: totalQuestions,
          subject_id: subjectId || undefined,
        });
      } else {
        await quiz.generate({
          source_type: "general_topic",
          topic_description: topic.trim(),
          total_questions: totalQuestions,
          subject_id: subjectId || undefined,
        });
      }
    } catch {
      /* erro já tratado no hook */
    }
  }

  // ========= Setup =========
  if (quiz.phase === "idle" || quiz.phase === "generating") {
    const generating = quiz.phase === "generating";
    return (
      <div className="space-y-6 max-w-4xl">
        <header>
          <p className="label-section mb-1">Quizzes</p>
          <h1 className="text-3xl font-bold text-ink-100">Criar quiz</h1>
          <p className="text-ink-400 mt-1 max-w-2xl">
            A IA gera perguntas a partir de um tema livre que você descreve ou
            do conteúdo dos seus documentos.
          </p>
        </header>

        {quiz.error && (
          <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-4 py-3">
            {quiz.error}
          </p>
        )}

        <form onSubmit={handleGenerate} className="card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-ink-100 flex items-center gap-2">
            <Sparkles size={16} className="text-brand-400" /> Origem das perguntas
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSource("general_topic")}
              className={`text-left p-4 rounded-xl border transition ${
                source === "general_topic"
                  ? "border-brand-500/50 bg-brand-500/10"
                  : "border-ink-700 bg-ink-900 hover:border-ink-600"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-ink-100">Tema geral</span>
                {source === "general_topic" && (
                  <span className="pill bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    selecionado
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-400">
                Descreva um tema — a IA cria o quiz do zero.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSource("documents")}
              className={`text-left p-4 rounded-xl border transition ${
                source === "documents"
                  ? "border-brand-500/50 bg-brand-500/10"
                  : "border-ink-700 bg-ink-900 hover:border-ink-600"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-ink-100 flex items-center gap-2">
                  <FileText size={14} /> Documentos
                </span>
                {source === "documents" && (
                  <span className="pill bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    selecionado
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-400">
                A IA gera perguntas baseadas no conteúdo dos PDFs.
              </p>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="block text-sm">
              <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
                Matéria (opcional)
              </span>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={generating}
                className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-100 focus:border-brand-500 focus:outline-none disabled:opacity-60"
              >
                <option value="">— Sem matéria —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
                Número de perguntas
              </span>
              <select
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(parseInt(e.target.value))}
                disabled={generating}
                className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-100 focus:border-brand-500 focus:outline-none disabled:opacity-60"
              >
                <option value={5}>5 perguntas</option>
                <option value={10}>10 perguntas</option>
                <option value={15}>15 perguntas</option>
              </select>
            </label>
          </div>

          {source === "documents" && (
            <div>
              <p className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
                Documentos (selecione 1 ou mais)
              </p>
              {readyDocs.length === 0 ? (
                <p className="text-sm text-ink-400 bg-ink-900 border border-ink-700 rounded-lg px-3 py-3">
                  Nenhum documento pronto. Faça upload em "Documentos" e
                  aguarde o processamento terminar.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {readyDocs.map((d) => {
                    const subj = subjects.find((s) => s.id === d.subject_id);
                    const isSelected = selectedDocs.has(d.id);
                    return (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => toggleDoc(d.id)}
                        disabled={generating}
                        className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition disabled:opacity-60 ${
                          isSelected
                            ? "border-brand-500/50 bg-brand-500/10"
                            : "border-ink-700 bg-ink-900 hover:border-ink-600"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-brand-500 border-brand-500"
                              : "border-ink-600"
                          }`}
                        >
                          {isSelected && (
                            <Check size={10} className="text-white" />
                          )}
                        </span>
                        <FileText
                          size={14}
                          className="text-ink-400 shrink-0"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-ink-100 truncate">
                            {d.filename}
                          </span>
                          {subj && (
                            <span className="block text-xs text-ink-400">
                              {subj.name}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {readyDocs.length > 0 && (
                <p className="text-xs text-ink-500 mt-2">
                  {selectedDocs.size} documento
                  {selectedDocs.size === 1 ? "" : "s"} selecionado
                  {selectedDocs.size === 1 ? "" : "s"}
                </p>
              )}
            </div>
          )}

          <label className="block text-sm">
            <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
              {source === "documents"
                ? "Tópico de foco (opcional)"
                : "Sobre o que é o quiz?"}
            </span>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={generating}
              required={source === "general_topic"}
              placeholder={
                source === "documents"
                  ? "Ex.: foque em integrais por substituição (deixe em branco para usar tudo)"
                  : "Ex.: Derivadas e regras de derivação (cadeia, produto, quociente)"
              }
              className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-100 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none resize-none disabled:opacity-60"
            />
          </label>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={
                generating ||
                (source === "general_topic" && !topic.trim()) ||
                (source === "documents" && selectedDocs.size === 0)
              }
            >
              {generating ? (
                <>
                  <Spinner size={14} /> Gerando perguntas...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Gerar quiz
                </>
              )}
            </Button>
          </div>
        </form>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink-100 flex items-center gap-2">
                <History size={16} className="text-brand-400" /> Quizzes anteriores
              </h2>
              <p className="text-sm text-ink-400">
                Refaça um quiz para treinar de novo ou apague o que não precisa mais.
              </p>
            </div>
          </div>

          {quiz.historyLoading && quiz.history.length === 0 && (
            <div className="flex items-center gap-3 text-ink-400">
              <Spinner /> Carregando histórico...
            </div>
          )}

          {!quiz.historyLoading && quiz.history.length === 0 && (
            <div className="card p-8 text-center text-ink-400 text-sm">
              Você ainda não gerou nenhum quiz. Use o formulário acima para criar o
              primeiro.
            </div>
          )}

          {quiz.history.length > 0 && (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quiz.history.map((q) => {
                const isRestarting = restartingId === q.id;
                const subject = subjects.find((s) => s.id === q.subject_id);
                return (
                  <li
                    key={q.id}
                    className="card p-4 flex flex-col gap-3 hover:border-brand-500/40 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-ink-100 truncate">{q.title}</h3>
                        <p className="text-xs text-ink-400 mt-0.5">
                          {dateFormatter.format(new Date(q.created_at))} ·{" "}
                          {q.total_questions} perguntas
                          {subject && <> · {subject.name}</>}
                        </p>
                      </div>
                      <span className={`pill shrink-0 ${STATUS_STYLE[q.status]}`}>
                        {STATUS_LABEL[q.status]}
                      </span>
                    </div>

                    {q.status === "completed" && q.score !== null && (
                      <p className="text-sm text-ink-300">
                        Nota:{" "}
                        <span className="text-ink-100 font-semibold tabular-nums">
                          {q.score}%
                        </span>
                      </p>
                    )}

                    <div className="flex justify-end gap-1 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRestart(q.id)}
                        disabled={isRestarting || restartingId !== null}
                        aria-label={`Refazer ${q.title}`}
                      >
                        {isRestarting ? (
                          <>
                            <Spinner size={12} /> Reiniciando...
                          </>
                        ) : (
                          <>
                            <RotateCcw size={14} /> Refazer
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setToDelete(q)}
                        disabled={restartingId !== null}
                        aria-label={`Excluir ${q.title}`}
                        className="text-danger-500 hover:text-danger-500"
                      >
                        <Trash2 size={14} /> Excluir
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <DeleteQuizDialog
          quiz={toDelete}
          onClose={() => setToDelete(null)}
          onConfirm={() => (toDelete ? handleDelete(toDelete.id) : Promise.resolve())}
        />

        {toast && <Toast kind={toast.kind} message={toast.message} />}
      </div>
    );
  }

  // ========= Respondendo =========
  if (quiz.phase === "in_progress" && quiz.currentQuestion && quiz.quiz) {
    const q = quiz.currentQuestion;
    const answered = quiz.answerResult !== null;
    const optionTexts: Record<QuizOption, string> = {
      a: q.option_a,
      b: q.option_b,
      c: q.option_c,
      d: q.option_d,
    };

    return (
      <div className="space-y-6 max-w-3xl">
        <header className="space-y-2">
          <p className="label-section">{quiz.quiz.title}</p>
          <h1 className="text-2xl font-semibold text-ink-100">
            Pergunta {quiz.currentIndex + 1} de {quiz.quiz.total_questions}
          </h1>
          <div className="h-1.5 bg-ink-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
              style={{
                width: `${((quiz.currentIndex + (answered ? 1 : 0)) / quiz.quiz.total_questions) * 100}%`,
              }}
            />
          </div>
        </header>

        <article className="card p-6 space-y-5">
          <p className="text-lg text-ink-100">{q.question_text}</p>

          <div className="space-y-2">
            {OPTIONS.map((opt) => {
              const isPicked = answered && quiz.answerResult?.correct_answer === opt;
              const wasMistake =
                answered &&
                quiz.answerResult?.is_correct === false &&
                quiz.answerResult?.correct_answer !== opt;

              const base =
                "w-full text-left p-3 rounded-lg border transition flex items-start gap-3";
              const visual = !answered
                ? "border-ink-700 bg-ink-900 hover:border-brand-500/50 cursor-pointer"
                : isPicked
                ? "border-success-500/50 bg-success-500/10"
                : wasMistake
                ? "border-ink-700 bg-ink-900 opacity-60"
                : "border-ink-700 bg-ink-900 opacity-60";

              return (
                <button
                  key={opt}
                  type="button"
                  disabled={answered}
                  onClick={() => quiz.answerCurrent(opt)}
                  className={`${base} ${visual}`}
                >
                  <span className="w-6 h-6 rounded-md bg-ink-800 text-ink-300 text-xs font-semibold flex items-center justify-center uppercase shrink-0">
                    {opt}
                  </span>
                  <span className="flex-1 text-sm text-ink-100">{optionTexts[opt]}</span>
                </button>
              );
            })}
          </div>

          {answered && quiz.answerResult && (
            <div
              className={`rounded-lg p-4 border ${
                quiz.answerResult.is_correct
                  ? "border-success-500/30 bg-success-500/10"
                  : "border-danger-500/30 bg-danger-500/10"
              }`}
            >
              <p className="font-medium text-ink-100 flex items-center gap-2 mb-2">
                {quiz.answerResult.is_correct ? (
                  <>
                    <Check size={16} className="text-success-400" /> Correto!
                  </>
                ) : (
                  <>
                    <X size={16} className="text-danger-500" /> Resposta correta:{" "}
                    <span className="uppercase">{quiz.answerResult.correct_answer}</span>
                  </>
                )}
              </p>
              <p className="text-sm text-ink-300">{quiz.answerResult.explanation}</p>
            </div>
          )}

          {answered && (
            <div className="flex justify-end">
              {quiz.isLast ? (
                <Button onClick={() => quiz.complete()}>
                  Concluir quiz <Check size={16} />
                </Button>
              ) : (
                <Button onClick={quiz.next}>
                  Próxima <ChevronRight size={16} />
                </Button>
              )}
            </div>
          )}
        </article>
      </div>
    );
  }

  // ========= Resultado =========
  if (quiz.phase === "completed" && quiz.quiz) {
    const correctCount = quiz.results.filter((r) => r.is_correct).length;
    const total = quiz.quiz.total_questions;

    return (
      <div className="space-y-6 max-w-3xl">
        <header>
          <p className="label-section mb-1">Quizzes</p>
          <h1 className="text-3xl font-bold text-ink-100">Resultado</h1>
        </header>

        <section className="card p-8 text-center space-y-3">
          <p className="text-sm text-ink-400">{quiz.quiz.title}</p>
          <p className="text-6xl font-bold text-ink-100 tabular-nums">
            {quiz.quiz.score}%
          </p>
          <p className="text-ink-300">
            {correctCount} de {total} corretas
          </p>
        </section>

        <section className="card p-6 space-y-3">
          <h2 className="label-section">Detalhamento</h2>
          {quiz.results.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-3 py-2 border-b border-ink-800 last:border-b-0"
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  r.is_correct
                    ? "bg-success-500/15 text-success-400"
                    : "bg-danger-500/15 text-danger-500"
                }`}
              >
                {r.is_correct ? <Check size={12} /> : <X size={12} />}
              </span>
              <div className="flex-1 text-sm">
                <p className="text-ink-200">
                  Pergunta {i + 1} — resposta correta:{" "}
                  <span className="uppercase font-semibold">{r.correct_answer}</span>
                </p>
                <p className="text-ink-400 mt-1">{r.explanation}</p>
              </div>
            </div>
          ))}
        </section>

        <div className="flex justify-end">
          <Button onClick={quiz.reset}>
            <RotateCcw size={16} /> Novo quiz
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
