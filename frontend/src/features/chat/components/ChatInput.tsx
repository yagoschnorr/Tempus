import { Send } from "lucide-react";
import { FormEvent, KeyboardEvent, useState } from "react";
import { Button } from "@/components/Button";

interface Props {
  disabled?: boolean;
  /** Se vazio, mostra placeholder pedindo seleção de matéria. */
  blockedReason?: string;
  onSubmit: (text: string) => void;
}

export function ChatInput({ disabled, blockedReason, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const isBlocked = !!blockedReason;
  const trimmed = value.trim();
  const canSend = !disabled && !isBlocked && trimmed.length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    onSubmit(trimmed);
    setValue("");
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSubmit(trimmed);
        setValue("");
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-ink-700 p-3 flex items-end gap-2"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        placeholder={blockedReason ?? "Pergunte sobre seus documentos…"}
        disabled={disabled || isBlocked}
        rows={1}
        className="flex-1 rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-none disabled:opacity-60 max-h-40"
      />
      <Button type="submit" size="md" disabled={!canSend}>
        <Send size={14} />
        Enviar
      </Button>
    </form>
  );
}
