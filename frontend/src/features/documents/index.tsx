import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/Button";

const docs = [
  { name: "Integrais Triplas — Notas de aula.pdf", subject: "Cálculo 2", pages: 24, size: "2.4 MB", status: "ready" },
  { name: "Padrões GoF — Resumo.pdf", subject: "POO", pages: 18, size: "1.2 MB", status: "ready" },
  { name: "Normalização de bancos.pdf", subject: "Banco de Dados II", pages: 32, size: "3.1 MB", status: "ready" },
  { name: "Camada de transporte.pdf", subject: "Redes", pages: 12, size: "0.8 MB", status: "processing" },
];

const subjects = [
  { name: "Cálculo 2", count: 4 },
  { name: "POO", count: 2 },
  { name: "Banco de Dados II", count: 4 },
  { name: "Redes", count: 1 },
  { name: "Estrutura de Dados", count: 4 },
  { name: "Inteligência Art.", count: 4 },
];

const tags = ["prova", "revisão", "exercícios", "resumo"];

export default function DocumentsPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-section mb-1">Documentos · Biblioteca</p>
          <h1 className="text-3xl font-bold text-ink-100">Sua biblioteca</h1>
          <p className="text-ink-400 mt-1">
            8 documentos · 21 MB · todos pesquisáveis pela IA do Tempus.
          </p>
        </div>
        <Button>
          <Plus size={16} /> Adicionar documento
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <section className="space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <select className="rounded-lg bg-ink-900 border border-ink-700 px-3 py-1.5 text-sm text-ink-200">
              <option>Mais recentes</option>
              <option>Maior</option>
              <option>Alfabético</option>
            </select>
          </div>

          {docs.map((d) => (
            <article
              key={d.name}
              className="card p-4 flex items-center gap-4 hover:border-brand-500/40 transition cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-300">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-ink-100 font-medium truncate">{d.name}</p>
                <p className="text-xs text-ink-400 mt-0.5">
                  <span className="text-brand-300">{d.subject}</span> · {d.pages} pág · {d.size}
                </p>
              </div>
              <span
                className={`pill ${
                  d.status === "ready"
                    ? "bg-success-500/15 text-success-400 border border-success-500/20"
                    : "bg-warning-500/15 text-warning-500 border border-warning-500/20"
                }`}
              >
                {d.status === "ready" ? "pronto" : "processando"}
              </span>
            </article>
          ))}
        </section>

        <aside className="space-y-6">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="label-section">Matérias</p>
              <button className="text-xs text-brand-400 hover:text-brand-300">Limpar</button>
            </div>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center justify-between text-ink-100 font-medium">
                Todas <span className="text-ink-500">8</span>
              </li>
              {subjects.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between text-ink-300 hover:text-ink-100 cursor-pointer"
                >
                  {s.name} <span className="text-ink-500">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <p className="label-section mb-3">Tags</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="pill bg-ink-900 text-ink-300 border border-ink-700 cursor-pointer hover:border-brand-500/40"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
