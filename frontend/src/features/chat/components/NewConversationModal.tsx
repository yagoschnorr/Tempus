import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import type { Subject, UUID } from "@/lib/api/types";

interface Props {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  /** Pré-seleciona se o usuário já estava com filtro ativo na sidebar. */
  defaultSubjectId?: UUID | null;
  onConfirm: (subjectId: UUID) => void;
}

export function NewConversationModal({
  open,
  onClose,
  subjects,
  defaultSubjectId,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(defaultSubjectId ?? "");
    setError(null);
  }, [open, defaultSubjectId]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Escolha uma matéria para iniciar a conversa.");
      return;
    }
    onConfirm(selected as UUID);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova conversa">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ink-400">
          O chat busca trechos nos PDFs da matéria selecionada e responde com
          citações da origem.
        </p>

        <label className="block text-sm">
          <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
            Matéria
          </span>
          <select
            autoFocus
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-100 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">Selecione…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!selected}>
            Iniciar conversa
          </Button>
        </div>
      </form>
    </Modal>
  );
}
