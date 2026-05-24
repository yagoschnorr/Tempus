import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { getErrorMessage } from "@/lib/api/client";
import type { CreateNotebookInput, Notebook } from "@/lib/api/types";

const PALETTE = [
  "#0F6E56", "#8257E6", "#22C55E", "#06B6D4",
  "#F59E0B", "#EC4899", "#3B82F6", "#A855F7",
];

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Notebook | null;
  onSubmit: (input: CreateNotebookInput) => Promise<unknown>;
}

export function NotebookFormModal({ open, onClose, initial, onSubmit }: Props) {
  const editing = Boolean(initial);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setColor(initial?.color ?? PALETTE[0]);
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Título é obrigatório");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        color,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível salvar"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar caderno" : "Novo caderno"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Título"
          name="title"
          placeholder="Ex.: Diário de Cálculo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
            placeholder="Tópicos do caderno, contexto, etc."
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
            {submitting ? "Salvando..." : editing ? "Salvar alterações" : "Criar caderno"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
