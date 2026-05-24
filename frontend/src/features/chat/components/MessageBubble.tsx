import { Sparkles, User as UserIcon } from "lucide-react";
import type { ChatMessage } from "@/lib/api/types";
import { SourceCard } from "./SourceCard";

interface Props {
  message: ChatMessage;
  /** Map document_id → nome legível, opcional. */
  documentNames?: Record<string, string>;
}

export function MessageBubble({ message, documentNames }: Props) {
  const isUser = message.role === "user";
  return (
    <article className="flex gap-3" aria-label={isUser ? "Pergunta" : "Resposta da IA"}>
      <div
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser
            ? "bg-ink-900 border border-ink-700 text-ink-200"
            : "bg-brand-500/15 border border-brand-500/30 text-brand-300"
        }`}
      >
        {isUser ? <UserIcon size={14} /> : <Sparkles size={14} />}
      </div>
      <div className="flex-1 space-y-3">
        <p className="text-ink-100 leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
        {message.sources.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {message.sources.map((src) => (
              <SourceCard
                key={src.id}
                source={src}
                documentName={documentNames?.[src.document_id]}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
