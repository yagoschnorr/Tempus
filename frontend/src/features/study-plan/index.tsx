import { Archive, Calendar, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";

const initialSubjects = [
  { name: "Cálculo 2", priority: "Alta", hours: 7 },
  { name: "POO", priority: "Média", hours: 4 },
  { name: "Banco de Dados II", priority: "Alta", hours: 6 },
  { name: "Redes", priority: "Baixa", hours: 2 },
];

const priorityClass: Record<string, string> = {
  Alta: "bg-danger-500/15 text-danger-500 border-danger-500/20",
  Média: "bg-warning-500/15 text-warning-500 border-warning-500/20",
  Baixa: "bg-info-500/15 text-info-500 border-info-500/20",
};

export default function StudyPlanPage() {
  const [style, setStyle] = useState<"Light" | "Equilibrado" | "Intenso">("Equilibrado");

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <p className="label-section">Plano de estudos</p>
            <span className="pill bg-success-500/15 text-success-400 border border-success-500/20">
              Ativo
            </span>
          </div>
          <h1 className="text-3xl font-bold text-ink-100">Plano de estudos</h1>
          <p className="text-ink-400 mt-1 max-w-2xl">
            Conte para a IA o que você precisa estudar — ela monta um plano realista e adapta
            conforme o seu progresso.
          </p>
        </div>
        <Button variant="secondary">
          <Archive size={16} /> Arquivar atual
        </Button>
      </header>

      <section className="card p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <p className="label-section mb-2">Data da próxima prova</p>
          <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5">
            <Calendar size={14} className="text-ink-500" />
            <input
              type="date"
              defaultValue="2026-05-17"
              className="bg-transparent text-ink-100 outline-none flex-1 text-sm"
            />
          </div>
          <p className="text-xs text-ink-500 mt-1">opcional · daqui 4 dias</p>
        </div>

        <div>
          <p className="label-section mb-2">Horas disponíveis por dia</p>
          <div className="flex items-baseline gap-1 bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5">
            <span className="text-2xl font-semibold text-ink-100">4h 30min</span>
          </div>
          <p className="text-xs text-ink-500 mt-1">a IA respeita esse limite</p>
        </div>

        <div>
          <p className="label-section mb-2">Estilo de plano</p>
          <div className="flex bg-ink-900 rounded-lg p-1 border border-ink-700">
            {(["Light", "Equilibrado", "Intenso"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                  style === s ? "bg-brand-500/20 text-brand-200" : "text-ink-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-700 flex items-center justify-between">
          <p className="label-section">Matérias do plano</p>
          <button className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300">
            <Plus size={14} /> Adicionar matéria
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-ink-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Matéria</th>
              <th className="text-left px-5 py-3 font-medium">Prioridade</th>
              <th className="text-left px-5 py-3 font-medium">Horas / semana</th>
            </tr>
          </thead>
          <tbody>
            {initialSubjects.map((s) => (
              <tr key={s.name} className="border-t border-ink-700 hover:bg-ink-900">
                <td className="px-5 py-3 text-ink-100 font-medium">{s.name}</td>
                <td className="px-5 py-3">
                  <span className={`pill border ${priorityClass[s.priority]}`}>{s.priority}</span>
                </td>
                <td className="px-5 py-3 text-ink-300">{s.hours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
