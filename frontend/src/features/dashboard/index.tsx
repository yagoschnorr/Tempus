import { ArrowDown, ArrowUp, Clock, Flame, Layers, Target, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

interface Metric {
  label: string;
  value: string;
  unit?: string;
  delta: number;
  deltaLabel: string;
  icon: LucideIcon;
}

const metrics: Metric[] = [
  {
    label: "Horas na semana",
    value: "25.6",
    unit: "h",
    delta: 12,
    deltaLabel: "vs semana anterior",
    icon: Clock,
  },
  {
    label: "Sequência",
    value: "14",
    unit: "dias",
    delta: 3,
    deltaLabel: "vs semana anterior",
    icon: Flame,
  },
  {
    label: "Acertos em quizzes",
    value: "88",
    unit: "%",
    delta: 6,
    deltaLabel: "pts vs semana anterior",
    icon: Target,
  },
  {
    label: "Matérias ativas",
    value: "6",
    delta: -1,
    deltaLabel: "vs semana anterior",
    icon: Layers,
  },
];

function todayLabel() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = (user?.name ?? "estudante").split(" ")[0];

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="space-y-2">
        <p className="text-sm text-ink-400 capitalize">{todayLabel()}</p>
        <h1 className="text-3xl font-bold text-ink-100">
          Boa tarde, {firstName} ·{" "}
          <span className="text-brand-400">14 dias em foco</span>
        </h1>
        <p className="text-ink-400 max-w-2xl">
          Você passou da metade da meta semanal. Prova de Cálculo 2 em 4 dias — a IA já sugeriu
          ajustes no seu plano.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          const positive = m.delta >= 0;
          return (
            <div key={m.label} className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="label-section">{m.label}</span>
                <Icon size={16} className="text-ink-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-ink-100">{m.value}</span>
                {m.unit && <span className="text-ink-400 text-sm">{m.unit}</span>}
              </div>
              <div
                className={`flex items-center gap-1 text-xs ${
                  positive ? "text-success-400" : "text-danger-500"
                }`}
              >
                {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                <span className="font-semibold">
                  {positive ? "+" : ""}
                  {m.delta}
                </span>
                <span className="text-ink-500">{m.deltaLabel}</span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-100">
              Progresso em quizzes (UC14)
            </h2>
            <p className="text-sm text-ink-400">
              Média de acertos por semana
            </p>
          </div>
          <div className="pill bg-brand-500/15 text-brand-300 border border-brand-500/20">
            últimas 12 semanas
          </div>
        </div>
        <div className="h-48 flex items-end gap-2">
          {[62, 58, 65, 70, 68, 75, 72, 80, 78, 84, 82, 88].map((v, i, arr) => {
            const isLast = i === arr.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`w-full rounded-t-md transition-all ${
                    isLast
                      ? "bg-gradient-to-t from-brand-600 to-brand-400 shadow-glow"
                      : "bg-brand-500/30"
                  }`}
                  style={{ height: `${v}%` }}
                />
                <span className={`text-[10px] ${isLast ? "text-brand-300 font-semibold" : "text-ink-500"}`}>
                  {v}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
