import { useState } from "react";
import { CheckCircle2, Pause, Play, Play as PlayIcon, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { useSubjects } from "@/features/subjects/hooks/useSubjects";
import { useTimer } from "./hooks/useTimer";

const RING_LEN = 289; // circunferência do círculo r=46

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export default function TimerPage() {
  const { subjects, loading: loadingSubjects } = useSubjects();
  const timer = useTimer();

  const [subjectId, setSubjectId] = useState<string>("");
  const [focusMin, setFocusMin] = useState(50);
  const [breakMin] = useState(10); // mantido visível mas ainda não usado pelo backend
  const [goal, setGoal] = useState("");

  const idle = timer.status === "idle";
  const running = timer.status === "running";
  const paused = timer.status === "paused";
  const finished = timer.status === "completed" || timer.status === "abandoned";

  const planned = timer.session?.planned_duration_seconds ?? focusMin * 60;
  const progress = planned > 0 ? timer.secondsRemaining / planned : 0;
  const ringOffset = RING_LEN * (1 - progress);

  const currentSubject = subjects.find(
    (s) => s.id === (timer.session?.subject_id ?? subjectId)
  );

  async function handleStart() {
    await timer.start({
      subject_id: subjectId || undefined,
      planned_duration_seconds: focusMin * 60,
    });
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-section mb-1">Cronômetro</p>
          <h1 className="text-3xl font-bold text-ink-100">
            {idle && "Pronta pra começar"}
            {running && "Sessão em andamento"}
            {paused && "Sessão pausada"}
            {finished && (timer.status === "completed" ? "Sessão concluída" : "Sessão abandonada")}
          </h1>
          {currentSubject && (
            <div className="flex items-center gap-3 mt-2">
              <span className="pill bg-success-500/15 text-success-400 border border-success-500/20">
                {running ? "Modo foco ativo" : timer.status}
              </span>
              <span className="text-sm text-ink-400">
                Pomodoro · {focusMin}/{breakMin} ·{" "}
                <span className="text-brand-300 font-medium">{currentSubject.name}</span>
              </span>
            </div>
          )}
        </div>
      </header>

      {timer.error && (
        <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-4 py-3">
          {timer.error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* === Painel central: anel + controles === */}
        <section className="card p-8 lg:col-span-2 flex flex-col items-center">
          <p className="label-section mb-4">
            {idle ? "Tempo planejado" : finished ? "Tempo registrado" : "Tempo restante"}
          </p>

          <div className="relative w-64 h-64 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#23232C" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="url(#g)"
                strokeWidth="6"
                strokeDasharray={RING_LEN}
                strokeDashoffset={idle ? 0 : ringOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#AE8EF2" />
                  <stop offset="100%" stopColor="#6C3FD6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="text-center">
              <span className="text-5xl font-bold text-ink-100 tabular-nums">
                {formatTime(idle ? focusMin * 60 : timer.secondsRemaining)}
              </span>
              <p className="text-xs text-ink-400 mt-1">
                {idle && `Sessão de ${focusMin} minutos`}
                {paused && "Pausada"}
                {running && "Em andamento"}
                {finished && (timer.status === "completed" ? "Concluída ✓" : "Abandonada")}
              </p>
            </div>
          </div>

          {/* Controles dependem do estado */}
          <div className="flex items-center gap-3 mt-8">
            {idle && (
              <Button size="lg" onClick={handleStart}>
                <PlayIcon size={16} /> Iniciar sessão
              </Button>
            )}

            {running && (
              <>
                <Button variant="secondary" size="lg" onClick={() => timer.pause()}>
                  <Pause size={16} /> Pausar
                </Button>
                <Button size="lg" onClick={() => timer.complete()}>
                  <CheckCircle2 size={16} /> Concluir
                </Button>
                <Button variant="ghost" size="lg" onClick={() => timer.abandon()}>
                  <X size={16} /> Abandonar
                </Button>
              </>
            )}

            {paused && (
              <>
                <Button size="lg" onClick={() => timer.resume()}>
                  <Play size={16} /> Retomar
                </Button>
                <Button variant="secondary" size="lg" onClick={() => timer.complete()}>
                  <CheckCircle2 size={16} /> Concluir
                </Button>
                <Button variant="ghost" size="lg" onClick={() => timer.abandon()}>
                  <X size={16} /> Abandonar
                </Button>
              </>
            )}

            {finished && (
              <Button size="lg" onClick={timer.reset}>
                <RotateCcw size={16} /> Nova sessão
              </Button>
            )}
          </div>
        </section>

        {/* === Lateral: setup quando idle, resumo quando rodando === */}
        <aside className="card p-6 space-y-5">
          <div>
            <p className="label-section mb-2">Matéria</p>
            {loadingSubjects ? (
              <div className="flex items-center gap-2 text-ink-400 text-sm">
                <Spinner size={14} /> Carregando...
              </div>
            ) : (
              <select
                disabled={!idle}
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-ink-200 focus:border-brand-500 focus:outline-none disabled:opacity-60"
              >
                <option value="">— Sem matéria —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="label-section mb-2">Foco</p>
              <input
                type="number"
                min={1}
                max={120}
                value={focusMin}
                disabled={!idle}
                onChange={(e) => setFocusMin(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-2xl font-semibold text-ink-100 focus:border-brand-500 focus:outline-none disabled:opacity-60"
              />
              <p className="text-xs text-ink-400 mt-1">minutos</p>
            </div>
            <div>
              <p className="label-section mb-2">Pausa</p>
              <div className="flex items-baseline gap-1 bg-ink-900 border border-ink-700 rounded-lg px-3 py-2">
                <span className="text-2xl font-semibold text-ink-100">{breakMin}</span>
                <span className="text-xs text-ink-400">min</span>
              </div>
            </div>
          </div>

          <div>
            <p className="label-section mb-2">Objetivo desta sessão</p>
            <textarea
              rows={3}
              value={goal}
              disabled={!idle}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Ex.: resolver 3 exercícios do capítulo 15..."
              className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-sm text-ink-200 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none resize-none disabled:opacity-60"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
