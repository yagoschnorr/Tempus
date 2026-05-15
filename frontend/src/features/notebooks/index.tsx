import { BookOpen, Pin, Plus } from "lucide-react";
import { Button } from "@/components/Button";

const pinned = [
  { name: "Cálculo 2 — Diário", notes: 24, lastEdit: "há 2h" },
  { name: "Estrutura de Dados", notes: 31, lastEdit: "há 1 sem." },
];

const all = [
  { name: "POO — Padrões de projeto", notes: 12, lastEdit: "ontem" },
  { name: "Banco de Dados II", notes: 9, lastEdit: "há 3 dias" },
  { name: "Inteligência Artificial", notes: 6, lastEdit: "há 1 sem." },
  { name: "Redes", notes: 3, lastEdit: "há 2 sem." },
];

export default function NotebooksPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-section mb-1">Cadernos</p>
          <h1 className="text-3xl font-bold text-ink-100">Cadernos</h1>
          <p className="text-ink-400 mt-1 max-w-2xl">
            Suas anotações organizadas por tema — escrita rica, com formatação simples.
          </p>
        </div>
        <Button>
          <Plus size={16} /> Novo caderno
        </Button>
      </header>

      <section>
        <p className="label-section mb-3">Fixados</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pinned.map((p) => (
            <article
              key={p.name}
              className="card p-5 hover:border-brand-500/40 transition cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="pill bg-brand-500/15 text-brand-300 border border-brand-500/20">
                  <Pin size={10} /> Fixado
                </span>
                <span className="text-xs text-ink-500 uppercase tracking-wider">
                  {p.lastEdit}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-ink-100 mb-1">{p.name}</h3>
              <p className="text-sm text-ink-400">{p.notes} anotações</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <p className="label-section mb-3">Todos os cadernos ({pinned.length + all.length})</p>
        <div className="card divide-y divide-ink-700">
          {all.map((n) => (
            <article
              key={n.name}
              className="p-4 flex items-center gap-4 hover:bg-ink-900 cursor-pointer transition"
            >
              <div className="w-9 h-9 rounded-lg bg-ink-900 border border-ink-700 flex items-center justify-center text-ink-400">
                <BookOpen size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-ink-100 font-medium">{n.name}</p>
                <p className="text-xs text-ink-500">{n.notes} anotações</p>
              </div>
              <span className="text-xs text-ink-500 uppercase tracking-wider">{n.lastEdit}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
