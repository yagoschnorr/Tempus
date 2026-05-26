import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { getErrorMessage } from "@/lib/api/client";
import type { Document, Subject, UploadDocumentInput } from "@/lib/api/types";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

interface Props {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  onSubmit: (input: UploadDocumentInput) => Promise<Document>;
}

export function UploadDocumentModal({ open, onClose, subjects, onSubmit }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setSubjectId("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Selecione um arquivo PDF");
      return;
    }
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Apenas arquivos PDF são aceitos");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("Arquivo muito grande (máximo 25 MB)");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        file,
        subject_id: subjectId || undefined,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível enviar o documento"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar documento">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
            Arquivo (PDF, até 25 MB)
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-200 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-500 file:text-white hover:file:bg-brand-400 file:cursor-pointer"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
            Matéria (opcional)
          </span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-100 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
          >
            <option value="">Sem matéria</option>
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
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
