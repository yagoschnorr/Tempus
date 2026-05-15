import { Pause, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";

export default function TimerPage() {
  const [running, setRunning] = useState(true);
  const [mode, setMode] = useState<"pomodoro" | "livre">("pomodoro");

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-section mb-1">Cronômetro</p>
          <h1 className="text-3xl font-bold text-ink-100">Sessão em andamento</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="pill bg-success-500/15 text-success-400 border border-success-500/20">
              Modo foco ativo
            </span>
            <span className="text-sm text-ink-400">
              Pomodoro · 50/10 ·{" "}
              <span className="text-brand-300 font-medium">Cálculo 2</span> · 3ª sessão de hoje
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="card p-8 lg:col-span-2 flex flex-col items-center">
          <p className="label-section mb-4">Tempo restante</p>
          <div className="relative w-64 h-64 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="#23232C"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="url(#g)"
                strokeWidth="6"
                strokeDasharray="289"
                strokeDashoffset="60"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#AE8EF2" />
                  <stop offset="100%" stopColor="#6C3FD6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="text-center">
              <span className="text-5xl font-bold text-ink-100 tabular-nums">24:18</span>
              <p className="text-xs text-ink-400 mt-1">Pausa em 24min · Sessão 3 de 4</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <Button variant="secondary" size="lg">
              <RotateCcw size={16} /> Reiniciar
            </Button>
            <Button size="lg" onClick={() => setRunning((r) => !r)}>
              {running ? (
                <>
                  <Pause size={16} /> Pausar
                </>
              ) : (
                <>
                  <Play size={16} /> Retomar
                </>
              )}
            </Button>
          </div>
        </section>

        <aside className="card p-6 space-y-5">
          <div>
            <p className="label-section mb-2">Modo</p>
            <div className="flex bg-ink-900 rounded-lg p-1 border border-ink-700">
              {(["pomodoro", "livre"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-1.5 rounded-md text-sm capitalize transition ${
                    mode === m ? "bg-brand-500/20 text-brand-200" : "text-ink-400"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label-section mb-2">Matéria</p>
            <select className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-ink-200 focus:border-brand-500 focus:outline-none">
              <option>Cálculo 2</option>
              <option>POO</option>
              <option>Banco de Dados II</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="label-section mb-2">Foco</p>
              <div className="flex items-baseline gap-1 bg-ink-900 border border-ink-700 rounded-lg px-3 py-2">
                <span className="text-2xl font-semibold text-ink-100">50</span>
                <span className="text-xs text-ink-400">min</span>
              </div>
            </div>
            <div>
              <p className="label-section mb-2">Pausa</p>
              <div className="flex items-baseline gap-1 bg-ink-900 border border-ink-700 rounded-lg px-3 py-2">
                <span className="text-2xl font-semibold text-ink-100">10</span>
                <span className="text-xs text-ink-400">min</span>
              </div>
            </div>
          </div>

          <div>
            <p className="label-section mb-2">Objetivo desta sessão</p>
            <textarea
              rows={3}
              className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-sm text-ink-200 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none resize-none"
              defaultValue="Entender por que o Jacobiano aparece na mudança de variáveis e resolver 3 exercícios do capítulo 15 do Stewart sem consultar a solução."
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
