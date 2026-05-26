import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Plus,
  RotateCw,
} from "lucide-react";
import Markdown from "react-markdown";
import { Button } from "@/components/Button";
import { Toast } from "@/components/Toast";
import { useSubjects } from "@/features/subjects/hooks/useSubjects";
import type {
  StudyPlan,
  StudyPlanPriority,
  StudyPlanStatus,
} from "@/lib/api/types";
import { useStudyPlans } from "./hooks/useStudyPlans";
import { GenerateStudyPlanModal } from "./components/GenerateStudyPlanModal";
import { ConfirmStatusChangeDialog } from "./components/ConfirmStatusChangeDialog";
import { ViewPlanContentDialog } from "./components/ViewPlanContentDialog";
import { markdownComponents } from "./markdown";

const statusLabels: Record<StudyPlanStatus, string> = {
  active: "Ativo",
  archived: "Arquivado",
  completed: "Concluído",
};

const statusClass: Record<StudyPlanStatus, string> = {
  active: "bg-success-500/15 text-success-400 border border-success-500/20",
  archived: "bg-ink-700/30 text-ink-400 border border-ink-600/40",
  completed: "bg-info-500/15 text-info-400 border border-info-500/20",
};

const priorityLabels: Record<StudyPlanPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const priorityClass: Record<StudyPlanPriority, string> = {
  high: "bg-danger-500/15 text-danger-500 border-danger-500/20",
  medium: "bg-warning-500/15 text-warning-500 border-warning-500/20",
  low: "bg-info-500/15 text-info-500 border-info-500/20",
};

function formatExamDate(
  dateStr: string | null,
): { formatted: string; relative: string | null } {
  if (!dateStr) return { formatted: "Não definida", relative: null };
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return { formatted: dateStr, relative: null };
  const date = new Date(y, m - 1, d);
  const formatted = date.toLocaleDateString("pt-BR");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  let relative: string | null = null;
  if (diffDays > 1) relative = `daqui ${diffDays} dias`;
  else if (diffDays === 1) relative = "amanhã";
  else if (diffDays === 0) relative = "hoje";
  else if (diffDays === -1) relative = "ontem";
  else relative = `${Math.abs(diffDays)} dias atrás`;
  return { formatted, relative };
}

export default function StudyPlanPage() {
  const {
    plans,
    activePlan,
    loading,
    error,
    refresh,
    updateStatus,
    generate,
  } = useStudyPlans();
  const { subjects } = useSubjects();
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    plan: StudyPlan;
    target: StudyPlanStatus;
  } | null>(null);
  const [viewingPlan, setViewingPlan] = useState<StudyPlan | null>(null);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const previousPlans = useMemo(
    () =>
      plans
        .filter((p) => p.status !== "active")
        .sort((a, b) => b.generated_at.localeCompare(a.generated_at)),
    [plans],
  );

  const subjectsById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );

  const examDateInfo = activePlan ? formatExamDate(activePlan.exam_date) : null;

  function askChange(plan: StudyPlan, target: StudyPlanStatus) {
    setPendingChange({ plan, target });
  }

  async function handleConfirmStatusChange() {
    if (!pendingChange) return;
    const { plan, target } = pendingChange;
    // Reativar com outro plano ativo: arquiva o atual primeiro pra não deixar
    // dois planos active simultâneos (o backend não restringe, então a UX faz).
    if (target === "active" && activePlan && activePlan.id !== plan.id) {
      await updateStatus(activePlan.id, "archived");
    }
    await updateStatus(plan.id, target);
    setToast({
      kind: "success",
      message:
        target === "active"
          ? "Plano reativado"
          : target === "archived"
            ? "Plano arquivado"
            : "Plano marcado como concluído",
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <p className="label-section">Plano de estudos</p>
            {activePlan ? (
              <span className={`pill ${statusClass.active}`}>
                {statusLabels.active}
              </span>
            ) : (
              <span className="pill bg-ink-700/30 text-ink-400 border border-ink-600/40">
                Sem plano ativo
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-ink-100">
            {activePlan?.title ?? "Plano de estudos"}
          </h1>
          <p className="text-ink-400 mt-1 max-w-2xl">
            Conte para a IA o que você precisa estudar — ela monta um plano
            realista e adapta conforme o seu progresso.
          </p>
        </div>
        {activePlan ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => askChange(activePlan, "archived")}
            >
              <Archive size={16} /> Arquivar
            </Button>
            <Button onClick={() => askChange(activePlan, "completed")}>
              <CheckCircle2 size={16} /> Marcar como concluído
            </Button>
          </div>
        ) : (
          <Button onClick={() => setIsGenerateOpen(true)}>
            <Plus size={16} /> Criar plano
          </Button>
        )}
      </header>

      {error && (
        <div className="card p-4 border-danger-500/30 bg-danger-500/10 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-danger-400 text-sm">{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {loading && !activePlan && !error && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-3 bg-ink-800 rounded w-1/3 mb-3" />
              <div className="h-2 bg-ink-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && !activePlan && !error && (
        <div className="card p-8 text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-lg bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-300">
            <Calendar size={20} />
          </div>
          <p className="text-ink-200 font-medium">Nenhum plano ativo</p>
          <p className="text-ink-400 text-sm">
            Crie um plano de estudos para organizar suas matérias por
            prioridade.
          </p>
        </div>
      )}

      {activePlan && (
        <>
          <section className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="label-section mb-2">Data da próxima prova</p>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5">
                <Calendar size={14} className="text-ink-500" />
                <span className="text-ink-100 text-sm">
                  {examDateInfo!.formatted}
                </span>
              </div>
              {examDateInfo!.relative && (
                <p className="text-xs text-ink-500 mt-1">
                  {examDateInfo!.relative}
                </p>
              )}
            </div>

            <div>
              <p className="label-section mb-2">Horas disponíveis por dia</p>
              <div className="flex items-baseline gap-1 bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5">
                <span className="text-2xl font-semibold text-ink-100">
                  {activePlan.daily_hours_available}h
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-1">
                a IA respeita esse limite
              </p>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-700">
              <p className="label-section">Matérias do plano</p>
            </div>
            {activePlan.subjects.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-400">
                Nenhuma matéria associada a este plano.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-ink-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Matéria</th>
                    <th className="text-left px-5 py-3 font-medium">
                      Prioridade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activePlan.subjects.map((s) => {
                    const subject = subjectsById.get(s.subject_id);
                    return (
                      <tr
                        key={s.subject_id}
                        className="border-t border-ink-700 hover:bg-ink-900"
                      >
                        <td className="px-5 py-3 text-ink-100 font-medium">
                          {subject?.name ?? "Matéria removida"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`pill border ${priorityClass[s.priority]}`}
                          >
                            {priorityLabels[s.priority]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <button
              type="button"
              onClick={() => setShowMarkdown((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between border-b border-ink-700 text-left hover:bg-ink-900 transition"
            >
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-brand-300" />
                <p className="label-section">Texto gerado pela IA</p>
              </div>
              {showMarkdown ? (
                <ChevronUp size={16} className="text-ink-400" />
              ) : (
                <ChevronDown size={16} className="text-ink-400" />
              )}
            </button>
            {showMarkdown && (
              <div className="px-5 py-4 text-sm">
                <Markdown components={markdownComponents}>
                  {activePlan.plan_content}
                </Markdown>
              </div>
            )}
          </section>
        </>
      )}

      {previousPlans.length > 0 && (
        <section className="space-y-3">
          <p className="label-section">Planos anteriores</p>
          {previousPlans.map((p) => (
            <article
              key={p.id}
              className="card p-4 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="min-w-0">
                <p className="text-ink-100 font-medium truncate">{p.title}</p>
                <p className="text-xs text-ink-400 mt-0.5">
                  Gerado em{" "}
                  {new Date(p.generated_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`pill ${statusClass[p.status]}`}>
                  {statusLabels[p.status]}
                </span>
                <button
                  type="button"
                  onClick={() => setViewingPlan(p)}
                  className="flex items-center gap-1 text-xs text-ink-300 hover:text-ink-100 transition px-2 py-1 rounded"
                  aria-label={`Ver detalhes de ${p.title}`}
                >
                  <Eye size={14} /> Ver
                </button>
                <button
                  type="button"
                  onClick={() => askChange(p, "active")}
                  className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition px-2 py-1 rounded"
                  aria-label={`Reativar ${p.title}`}
                >
                  <RotateCw size={14} /> Reativar
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <GenerateStudyPlanModal
        open={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        subjects={subjects}
        onSubmit={generate}
      />

      <ConfirmStatusChangeDialog
        plan={pendingChange?.plan ?? null}
        targetStatus={pendingChange?.target ?? null}
        hasOtherActive={
          pendingChange?.target === "active" &&
          activePlan !== null &&
          activePlan.id !== pendingChange.plan.id
        }
        onClose={() => setPendingChange(null)}
        onConfirm={handleConfirmStatusChange}
      />

      <ViewPlanContentDialog
        plan={viewingPlan}
        onClose={() => setViewingPlan(null)}
      />

      {toast && <Toast kind={toast.kind} message={toast.message} />}
    </div>
  );
}
