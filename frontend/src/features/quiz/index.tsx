import { FileText, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";

const metrics = [
  { label: "Quizzes feitos", value: "42" },
  { label: "Média de acertos", value: "81%" },
  { label: "Esta semana", value: "+7" },
];

const subjects = ["Cálculo 2", "POO", "Banco de Dados II", "Redes", "Estrutura de Dados", "Inteligência Art."];

export default function QuizPage() {
  const [source, setSource] = useState<"documents" | "general">("documents");

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-section mb-1">Quizzes · Geral</p>
          <h1 className="text-3xl font-bold text-ink-100">Quizzes</h1>
          <p className="text-ink-400 mt-1 max-w-2xl">
            Teste o que você estudou. A IA cria perguntas a partir dos seus PDFs ou de um tema
            livre.
          </p>
        </div>
        <Button>
          <Plus size={16} /> Criar quiz
        </Button>
      </header>

      <section className="grid grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="card p-5">
            <p className="label-section mb-2">{m.label}</p>
            <p className="text-3xl font-bold text-ink-100">{m.value}</p>
          </div>
        ))}
      </section>

      <section className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-100 flex items-center gap-2">
            <Sparkles size={16} className="text-brand-400" /> Criar novo quiz
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => setSource("documents")}
            className={`text-left p-4 rounded-xl border transition ${
              source === "documents"
                ? "border-brand-500/50 bg-brand-500/10"
                : "border-ink-700 bg-ink-900 hover:border-ink-600"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-ink-100">Baseado nos meus documentos</span>
              {source === "documents" && (
                <span className="pill bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  selecionado
                </span>
              )}
            </div>
            <p className="text-sm text-ink-400">
              A IA lê seus PDFs e gera perguntas com referência direta ao trecho de origem. Ideal
              para revisão da prova.
            </p>
          </button>

          <button
            onClick={() => setSource("general")}
            className={`text-left p-4 rounded-xl border transition ${
              source === "general"
                ? "border-brand-500/50 bg-brand-500/10"
                : "border-ink-700 bg-ink-900 hover:border-ink-600"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-ink-100">Tema geral</span>
              {source === "general" && (
                <span className="pill bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  selecionado
                </span>
              )}
            </div>
            <p className="text-sm text-ink-400">
              Descreva um tema livre — a IA cria o quiz do zero. Útil quando você ainda não tem
              material na biblioteca.
            </p>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <div>
            <p className="label-section mb-2">Matéria</p>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s, i) => (
                <span
                  key={s}
                  className={`pill cursor-pointer border ${
                    i === 0
                      ? "bg-brand-500/15 text-brand-300 border-brand-500/30"
                      : "bg-ink-900 text-ink-300 border-ink-700 hover:border-ink-600"
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {source === "documents" && (
            <div>
              <p className="label-section mb-2">Documentos da matéria</p>
              <div className="card-soft p-3 flex items-center gap-3">
                <FileText size={16} className="text-brand-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-100 truncate">
                    Integrais Triplas - Notas de aula.pdf
                  </p>
                  <p className="text-xs text-ink-500">24 pág · 2.4 MB</p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-ink-700 bg-ink-900 text-brand-500 focus:ring-brand-500"
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
