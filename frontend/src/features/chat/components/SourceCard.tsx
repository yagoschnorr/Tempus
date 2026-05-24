import { FileText } from "lucide-react";
import type { ChatSource } from "@/lib/api/types";

interface Props {
  source: ChatSource;
  documentName?: string;
}

/**
 * Card de citação renderizado abaixo da resposta da IA.
 * Mostra nome do PDF (quando conhecido), página e um trecho. O nome do PDF
 * vem de um lookup externo (lista de documents) — se ausente, mostra UUID curto.
 */
export function SourceCard({ source, documentName }: Props) {
  const label =
    documentName ??
    `Documento ${source.document_id.slice(0, 6)}`;
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/70 p-3 text-xs space-y-1.5">
      <div className="flex items-center gap-2 text-ink-300">
        <FileText size={14} className="text-brand-400 shrink-0" />
        <span className="font-medium truncate">{label}</span>
        {source.page_number != null && (
          <span className="text-ink-500 shrink-0">· p. {source.page_number}</span>
        )}
      </div>
      <p className="text-ink-400 leading-relaxed line-clamp-3">{source.snippet}</p>
    </div>
  );
}
