import { useEffect, useRef, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { getErrorMessage } from "@/lib/api/client";
import type { Note, NoteSummary, UUID } from "@/lib/api/types";
import { formatRelativeTime } from "../relativeTime";

interface Props {
  note: Note;
  onSave: (id: UUID, input: { title?: string; content?: string }) => Promise<Note>;
  onDelete: () => void;
  onSummarize: (id: UUID) => Promise<NoteSummary>;
  onSummaryReady: (summary: string) => void;
  onSummaryError: (message: string) => void;
  onSummaryStart: () => void;
  /** Aciona o save em sucesso (toast). */
  onSavedToast: () => void;
}

/**
 * Editor de uma folha. Mantém um buffer local (title/content) e expõe um
 * estado "dirty" — quando o buffer diverge da prop `note`, o botão Salvar
 * habilita e aparece o indicador "alterações não salvas".
 *
 * Trocar a prop `note` (selecionar outra folha) reseta o buffer.
 */
export function NoteEditor({
  note,
  onSave,
  onDelete,
  onSummarize,
  onSummaryReady,
  onSummaryError,
  onSummaryStart,
  onSavedToast,
}: Props) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reseta o buffer quando muda de folha. Usar id como key garante reset
  // mesmo se outras propriedades coincidem.
  const lastNoteIdRef = useRef<UUID>(note.id);
  useEffect(() => {
    if (lastNoteIdRef.current !== note.id) {
      setTitle(note.title);
      setContent(note.content);
      setError(null);
      lastNoteIdRef.current = note.id;
    }
  }, [note.id, note.title, note.content]);

  const dirty = title !== note.title || content !== note.content;

  async function handleSave() {
    if (!dirty || saving) return;
    if (!title.trim()) {
      setError("Título não pode ficar vazio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(note.id, {
        title: title.trim() !== note.title ? title.trim() : undefined,
        content: content !== note.content ? content : undefined,
      });
      onSavedToast();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível salvar"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSummarize() {
    onSummaryStart();
    try {
      const res = await onSummarize(note.id);
      onSummaryReady(res.summary);
    } catch (err) {
      onSummaryError(getErrorMessage(err, "Não foi possível gerar o resumo"));
    }
  }

  return (
    <div className="flex flex-col h-full">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título da folha"
        aria-label="Título da folha"
        className="w-full bg-transparent text-2xl font-bold text-ink-100 placeholder:text-ink-500 focus:outline-none mb-2"
      />

      <p className="text-xs text-ink-500 mb-4">
        Última edição {formatRelativeTime(note.updated_at)}
        {dirty && (
          <span className="ml-2 text-warning-500">• alterações não salvas</span>
        )}
      </p>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Comece a escrever..."
        aria-label="Conteúdo da folha"
        className="flex-1 w-full bg-transparent text-ink-100 placeholder:text-ink-500 focus:outline-none resize-none leading-relaxed text-sm min-h-[300px]"
      />

      {error && (
        <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2 mt-3">
          {error}
        </p>
      )}

      <div className="flex justify-between items-center mt-4 pt-4 border-t border-ink-700">
        <Button
          type="button"
          variant="ghost"
          onClick={onDelete}
          className="text-danger-500 hover:text-danger-500"
        >
          <Trash2 size={14} /> Excluir folha
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={handleSummarize}>
            <Sparkles size={14} /> Resumir com IA
          </Button>
          <Button type="button" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
