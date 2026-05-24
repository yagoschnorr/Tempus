import { Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";

interface Props {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  summary: string | null;
  error: string | null;
}

export function NoteSummaryModal({ open, onClose, loading, summary, error }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Resumo da folha">
      <div className="space-y-4">
        <p className="text-xs text-ink-400 flex items-center gap-1.5">
          <Sparkles size={12} /> Gerado pela IA
        </p>

        {loading && (
          <div className="flex items-center gap-3 text-ink-400 py-6">
            <Spinner /> Gerando resumo...
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!loading && summary && (
          <div className="text-ink-200 text-sm whitespace-pre-wrap leading-relaxed">
            {summary}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
