import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { getErrorMessage } from "@/lib/api/client";
import type { CreateSubjectInput, Subject } from "@/lib/api/types";

const PALETTE = [
  "#8257E6", "#22C55E", "#06B6D4", "#F59E0B",
  "#EC4899", "#A855F7", "#3B82F6", "#10B981",
];

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Subject | null;
  onSubmit: (input: CreateSubjectInput) => Promise<unknown>;
}

export function SubjectFormModal({ open, onClose, initial, onSubmit }: Props) {
  const editing = Boolean(initial);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [hours, setHours] = useState<string>("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setColor(initial?.color ?? PALETTE[0]);
    setHours(
      initial?.weekly_goal_minutes
        ? String(initial.weekly_goal_minutes / 60)
        : ""
    );
    setDescription(initial?.description ?? "");
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    const minutes = hours ? Math.round(parseFloat(hours) * 60) : 0;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        color,
        description: description.trim() || undefined,
        weekly_goal_minutes: minutes,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível salvar"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editar matéria" : "Nova matéria"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome"
          name="name"
          placeholder="Ex.: Cálculo I"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />

        <div>
          <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
            Cor
          </span>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                className={`w-8 h-8 rounded-full border-2 transition ${
                  color === c ? "border-ink-100 scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c, boxShadow: `0 0 12px ${c}80` }}
              />
            ))}
          </div>
        </div>

        <Input
          label="Meta semanal (horas)"
          name="hours"
          type="number"
          min="0"
          step="0.5"
          placeholder="Ex.: 10"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />

        <label className="block text-sm">
          <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
            Descrição
          </span>
          <textarea
            name="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-100 placeholder:text-ink-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition resize-none"
            placeholder="Ementa, tópicos principais, observações..."
          />
        </label>

        {error && (
          <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Salvando..." : editing ? "Salvar alterações" : "Criar matéria"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
