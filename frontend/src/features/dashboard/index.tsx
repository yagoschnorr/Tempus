import { AlertCircle, BookOpen, Clock, Flame, Target } from "lucide-react";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth/AuthContext";
import { useSubjects } from "@/features/subjects/hooks/useSubjects";
import { useStudyPlans } from "@/features/study-plan/hooks/useStudyPlans";
import { useDashboard } from "./hooks/useDashboard";

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function todayLabel() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return Number.NaN;
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useDashboard();
  const { subjects } = useSubjects();
  const { activePlan } = useStudyPlans();

  const firstName = (user?.name ?? "estudante").split(" ")[0];
  const hour = new Date().getHours();

  const examDays =
    activePlan?.exam_date ? daysUntil(activePlan.exam_date) : null;

  const allZero =
    data !== null &&
    data.minutes_today === 0 &&
    data.minutes_week === 0 &&
    data.sessions_today === 0 &&
    data.sessions_week === 0 &&
    data.current_streak === 0 &&
    data.avg_quiz_score_week === null;

  const cards = data
    ? [
        {
          label: "Horas na semana",
          value: (data.minutes_week / 60).toFixed(1),
          unit: "h",
          icon: Clock,
          hint:
            data.sessions_week > 0
              ? `${data.sessions_week} ${data.sessions_week === 1 ? "sessão" : "sessões"}`
              : "ainda sem sessões",
        },
        {
          label: "Sessões hoje",
          value: String(data.sessions_today),
          unit: data.sessions_today === 1 ? "sessão" : "sessões",
          icon: BookOpen,
          hint: data.minutes_today > 0 ? `${data.minutes_today} min` : "",
        },
        {
          label: "Sequência",
          value: String(data.current_streak),
          unit: data.current_streak === 1 ? "dia" : "dias",
          icon: Flame,
          hint: data.current_streak > 0 ? "em foco" : "comece hoje",
        },
        {
          label: "Média em quizzes",
          value:
            data.avg_quiz_score_week != null
              ? data.avg_quiz_score_week.toFixed(0)
              : "—",
          unit: data.avg_quiz_score_week != null ? "%" : "",
          icon: Target,
          hint:
            data.avg_quiz_score_week != null
              ? "esta semana"
              : "sem quizzes esta semana",
        },
      ]
    : [];

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="space-y-2">
        <p className="text-sm text-ink-400 capitalize">{todayLabel()}</p>
        <h1 className="text-3xl font-bold text-ink-100">
          {greeting(hour)}, {firstName}
          {data && data.current_streak > 0 && (
            <>
              {" · "}
              <span className="text-brand-400">
                {data.current_streak} dia
                {data.current_streak === 1 ? "" : "s"} em foco
              </span>
            </>
          )}
        </h1>
        {activePlan && examDays !== null && Number.isFinite(examDays) && examDays >= 0 && (
          <p className="text-ink-400 max-w-2xl">
            {examDays === 0
              ? `Prova de "${activePlan.title}" é hoje.`
              : examDays === 1
                ? `Prova de "${activePlan.title}" amanhã.`
                : `Prova de "${activePlan.title}" em ${examDays} dias.`}
          </p>
        )}
        {subjects.length > 0 && (
          <p className="text-xs text-ink-500">
            {subjects.length} matéria{subjects.length === 1 ? "" : "s"}{" "}
            cadastrada{subjects.length === 1 ? "" : "s"}
          </p>
        )}
      </header>

      {error && (
        <div className="card p-4 border-danger-500/30 bg-danger-500/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-danger-400 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {loading && !data && !error && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card p-5 space-y-3 animate-pulse">
              <div className="h-3 bg-ink-800 rounded w-1/2" />
              <div className="h-8 bg-ink-800 rounded w-2/3" />
              <div className="h-2 bg-ink-800 rounded w-1/3" />
            </div>
          ))}
        </section>
      )}

      {data && !error && allZero && (
        <div className="card p-8 text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-lg bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-300">
            <Flame size={20} />
          </div>
          <p className="text-ink-200 font-medium">
            Comece sua primeira sessão
          </p>
          <p className="text-ink-400 text-sm">
            Suas métricas aparecem aqui após você completar sessões de estudo.
          </p>
        </div>
      )}

      {data && !error && !allZero && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="label-section">{c.label}</span>
                  <Icon size={16} className="text-ink-500" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-ink-100">
                    {c.value}
                  </span>
                  {c.unit && (
                    <span className="text-ink-400 text-sm">{c.unit}</span>
                  )}
                </div>
                {c.hint && <p className="text-xs text-ink-500">{c.hint}</p>}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
