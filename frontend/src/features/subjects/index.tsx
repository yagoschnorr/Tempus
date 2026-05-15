import { Plus } from "lucide-react";
import { Button } from "@/components/Button";

const subjects = [
  { name: "Cálculo 2", color: "#8257E6", weeklyGoal: 600, docs: 4, quizzes: 12 },
  { name: "POO", color: "#22C55E", weeklyGoal: 300, docs: 2, quizzes: 5 },
  { name: "Banco de Dados II", color: "#06B6D4", weeklyGoal: 420, docs: 4, quizzes: 8 },
  { name: "Redes", color: "#F59E0B", weeklyGoal: 180, docs: 1, quizzes: 3 },
  { name: "Estrutura de Dados", color: "#EC4899", weeklyGoal: 360, docs: 4, quizzes: 7 },
  { name: "Inteligência Art.", color: "#A855F7", weeklyGoal: 240, docs: 4, quizzes: 6 },
];

function hoursLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export default function SubjectsPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-section mb-1">Organização</p>
          <h1 className="text-3xl font-bold text-ink-100">Matérias</h1>
          <p className="text-ink-400 mt-1">
            Organize seus estudos por matéria — cada uma com meta semanal própria e cor.
          </p>
        </div>
        <Button>
          <Plus size={16} /> Nova matéria
        </Button>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((s) => (
          <article
            key={s.name}
            className="card p-5 hover:border-brand-500/40 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: s.color, boxShadow: `0 0 12px ${s.color}80` }}
              />
              <span className="pill bg-ink-900 text-ink-300 border border-ink-700">
                meta {hoursLabel(s.weeklyGoal)}/sem
              </span>
            </div>
            <h3 className="text-lg font-semibold text-ink-100 mb-2">{s.name}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink-500">Documentos</p>
                <p className="text-ink-100 font-medium">{s.docs}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Quizzes</p>
                <p className="text-ink-100 font-medium">{s.quizzes}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
