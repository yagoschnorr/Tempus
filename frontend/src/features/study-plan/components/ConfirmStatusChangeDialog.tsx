import { useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { getErrorMessage } from "@/lib/api/client";
import type { StudyPlan, StudyPlanStatus } from "@/lib/api/types";

interface Props {
  plan: StudyPlan | null;
  targetStatus: StudyPlanStatus | null;
  hasOtherActive: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

interface Config {
  title: string;
  body: (planTitle: string, hasOtherActive: boolean) => string;
  ctaLabel: string;
}

const config: Record<StudyPlanStatus, Config> = {
  active: {
    title: "Reativar plano",
    body: (planTitle, hasOtherActive) =>
      hasOtherActive
        ? `Reativar "${planTitle}"? O plano ativo atual será arquivado automaticamente.`
        : `Reativar "${planTitle}"?`,
    ctaLabel: "Reativar",
  },
  archived: {
    title: "Arquivar plano",
    body: (planTitle) =>
      `Arquivar "${planTitle}"? Ele sai do ativo, mas pode ser reativado depois.`,
    ctaLabel: "Arquivar",
  },
  completed: {
    title: "Marcar como concluído",
    body: (planTitle) =>
      `Marcar "${planTitle}" como concluído? Ele sai do ativo, mas pode ser reativado depois.`,
    ctaLabel: "Concluir",
  },
};

export function ConfirmStatusChangeDialog({
  plan,
  targetStatus,
  hasOtherActive,
  onClose,
  onConfirm,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível atualizar o plano"));
    } finally {
      setSubmitting(false);
    }
  }

  const open = Boolean(plan && targetStatus);
  const cfg = targetStatus ? config[targetStatus] : null;

  return (
    <Modal open={open} onClose={onClose} title={cfg?.title ?? ""}>
      <div className="space-y-4">
        {plan && cfg && (
          <p className="text-sm text-ink-300">
            {cfg.body(plan.title, hasOtherActive)}
          </p>
        )}

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
          <Button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Salvando..." : cfg?.ctaLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
