import { useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { getErrorMessage } from "@/lib/api/client";
import type { Document } from "@/lib/api/types";

interface Props {
  document: Document | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteDocumentDialog({ document, onClose, onConfirm }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível excluir"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={Boolean(document)} onClose={onClose} title="Excluir documento">
      <div className="space-y-4">
        <p className="text-sm text-ink-300">
          Tem certeza que deseja excluir{" "}
          <span className="text-ink-100 font-medium">{document?.filename}</span>?
          Os trechos indexados serão removidos e o documento não poderá mais ser
          usado em quizzes ou chat.
        </p>

        {error && (
          <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Excluindo..." : "Excluir"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
