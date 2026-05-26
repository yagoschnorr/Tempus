import { FormEvent, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { getErrorMessage } from "@/lib/api/client";
import type {
  CreateStudyPlanInput,
  StudyPlan,
  StudyPlanPriority,
  Subject,
  UUID,
} from "@/lib/api/types";

interface SubjectRow {
  subject_id: UUID | "";
  priority: StudyPlanPriority;
}

interface Props {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  onSubmit: (input: CreateStudyPlanInput) => Promise<StudyPlan>;
}

export function GenerateStudyPlanModal({
  open,
  onClose,
  subjects,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState("4");
  const [rows, setRows] = useState<SubjectRow[]>([
    { subject_id: "", priority: "medium" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setExamDate("");
    setDailyHours("4");
    setRows([{ subject_id: "", priority: "medium" }]);
    setError(null);
  }, [open]);

  function addRow() {
    setRows((prev) => [...prev, { subject_id: "", priority: "medium" }]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<SubjectRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setError("Título é obrigatório");
      return;
    }
    const hours = parseFloat(dailyHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setError("Horas/dia deve ser maior que zero");
      return;
    }
    const filled = rows.filter((r) => r.subject_id !== "");
    if (filled.length === 0) {
      setError("Selecione pelo menos uma matéria");
      return;
    }
    const ids = filled.map((r) => r.subject_id);
    if (new Set(ids).size !== ids.length) {
      setError("Matéria duplicada — cada matéria só pode aparecer uma vez");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        exam_date: examDate || undefined,
        daily_hours_available: hours,
        subjects: filled.map((r) => ({
          subject_id: r.subject_id as UUID,
          priority: r.priority,
        })),
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível gerar o plano"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Criar plano de estudos">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Título"
          name="title"
          placeholder="Ex.: Plano para a prova de Cálculo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
              Data da prova (opcional)
            </span>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-100 focus:outline-none focus:border-brand-500 transition"
            />
          </label>

          <label className="block text-sm">
            <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
              Horas por dia
            </span>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={dailyHours}
              onChange={(e) => setDailyHours(e.target.value)}
              className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-100 focus:outline-none focus:border-brand-500 transition"
            />
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="block text-ink-300 font-medium text-xs uppercase tracking-wider">
              Matérias e prioridades
            </span>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  aria-label={`Matéria ${idx + 1}`}
                  value={row.subject_id}
                  onChange={(e) =>
                    updateRow(idx, {
                      subject_id: e.target.value as UUID | "",
                    })
                  }
                  className="flex-1 rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-brand-500 transition"
                >
                  <option value="">Selecione uma matéria</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Prioridade ${idx + 1}`}
                  value={row.priority}
                  onChange={(e) =>
                    updateRow(idx, {
                      priority: e.target.value as StudyPlanPriority,
                    })
                  }
                  className="rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-brand-500 transition"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="text-ink-500 hover:text-danger-400 transition p-1 rounded"
                    aria-label={`Remover matéria ${idx + 1}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Gerando..." : "Gerar plano"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
