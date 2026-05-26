import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Calendar,
  CheckCircle2,
  Eye,
  Plus,
  RotateCw,
} from "lucide-react";
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
  if (!dateStr) return { formatted: "Sem data definida", relative: null };
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
    activePlans,
    loading,
    error,
    refresh,
    updateStatus,
    generate,
  } = useStudyPlans();
  const { subjects } = useSubjects();
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

  function askChange(plan: StudyPlan, target: StudyPlanStatus) {
    setPendingChange({ plan, target });
  }

  async function handleConfirmStatusChange() {
    if (!pendingChange) return;
    const { plan, target } = pendingChange;
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
            {activePlans.length > 0 ? (
              <span className={`pill ${statusClass.active}`}>
                {activePlans.length} ativo
                {activePlans.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="pill bg-ink-700/30 text-ink-400 border border-ink-600/40">
                Sem plano ativo
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-ink-100">Plano de estudos</h1>
          <p className="text-ink-400 mt-1 max-w-2xl">
            Conte para a IA o que você precisa estudar — ela monta um plano
            realista. Você pode ter quantos planos quiser rodando em paralelo.
          </p>
        </div>
        <Button onClick={() => setIsGenerateOpen(true)}>
          <Plus size={16} /> Criar plano
        </Button>
      </header>

      {error && (
        <div className="card p-4 border-danger-500/30 bg-danger-500/10 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-danger-400 text-sm">{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {loading && plans.length === 0 && !error && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-3 bg-ink-800 rounded w-1/3 mb-3" />
              <div className="h-2 bg-ink-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && plans.length === 0 && !error && (
        <div className="card p-8 text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-lg bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-300">
            <Calendar size={20} />
          </div>
          <p className="text-ink-200 font-medium">Nenhum plano ainda</p>
          <p className="text-ink-400 text-sm">
            Crie um plano de estudos para organizar suas matérias por
            prioridade.
          </p>
        </div>
      )}

      {activePlans.length > 0 && (
        <section className="space-y-3">
          <p className="label-section">Planos ativos</p>
          {activePlans.map((plan) => {
            const examInfo = formatExamDate(plan.exam_date);
            return (
              <article key={plan.id} className="card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`pill ${statusClass.active}`}>
                        {statusLabels.active}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-ink-100">
                      {plan.title}
                    </h3>
                    <p className="text-sm text-ink-400 mt-1">
                      Prova: {examInfo.formatted}
                      {examInfo.relative && ` (${examInfo.relative})`} ·{" "}
                      {plan.daily_hours_available}h/dia ·{" "}
                      {plan.subjects.length} matéria
                      {plan.subjects.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewingPlan(plan)}
                      className="flex items-center gap-1 text-xs text-ink-300 hover:text-ink-100 transition px-2 py-1 rounded"
                      aria-label={`Ver detalhes de ${plan.title}`}
                    >
                      <Eye size={14} /> Ver
                    </button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => askChange(plan, "archived")}
                    >
                      <Archive size={14} /> Arquivar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => askChange(plan, "completed")}
                    >
                      <CheckCircle2 size={14} /> Concluir
                    </Button>
                  </div>
                </div>

                {plan.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {plan.subjects.map((s) => {
                      const subject = subjectsById.get(s.subject_id);
                      return (
                        <span
                          key={s.subject_id}
                          className={`pill border text-xs ${priorityClass[s.priority]}`}
                        >
                          {subject?.name ?? "Matéria removida"} ·{" "}
                          {priorityLabels[s.priority]}
                        </span>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </section>
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
        hasOtherActive={false}
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
