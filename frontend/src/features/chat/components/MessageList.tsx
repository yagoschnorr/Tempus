import { useEffect, useRef } from "react";
import { Spinner } from "@/components/Spinner";
import type { ChatMessage } from "@/lib/api/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
  sending?: boolean;
  documentNames?: Record<string, string>;
}

export function MessageList({ messages, sending, documentNames }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll para o fim sempre que uma nova mensagem chega ou começa um envio.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} documentNames={documentNames} />
      ))}
      {sending && (
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <Spinner /> A IA está pensando…
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
