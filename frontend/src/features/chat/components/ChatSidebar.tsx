import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import type { ChatSession, Subject, UUID } from "@/lib/api/types";

interface Props {
  sessions: ChatSession[];
  subjects: Subject[];
  filter: UUID | null;
  onFilterChange: (subjectId: UUID | null) => void;
  activeSessionId: UUID | null;
  loading?: boolean;
  onSelect: (id: UUID) => void;
  onNew: () => void;
  onRename: (id: UUID, title: string) => Promise<void> | void;
  onDelete: (id: UUID) => Promise<void> | void;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(diff)) return "";
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function ChatSidebar({
  sessions,
  subjects,
  filter,
  onFilterChange,
  activeSessionId,
  loading,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: Props) {
  const [renaming, setRenaming] = useState<UUID | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function startRename(s: ChatSession) {
    setRenaming(s.id);
    setRenameValue(s.title);
  }

  async function commitRename(id: UUID) {
    const next = renameValue.trim();
    if (next && next !== sessions.find((s) => s.id === id)?.title) {
      await onRename(id, next);
    }
    setRenaming(null);
  }

  return (
    <aside className="w-full lg:w-72 shrink-0 flex flex-col border-r border-ink-700 bg-ink-900/40">
      <div className="p-3 space-y-2 border-b border-ink-700">
        <Button onClick={onNew} className="w-full">
          <Plus size={14} /> Nova conversa
        </Button>
        <select
          value={filter ?? ""}
          onChange={(e) => onFilterChange(e.target.value || null)}
          className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-xs text-ink-200 focus:outline-none focus:border-brand-500"
          aria-label="Filtrar conversas por matéria"
        >
          <option value="">Todas as matérias</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Spinner />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-ink-500 px-3 py-6 text-center">
            Sem conversas ainda.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => {
              const active = s.id === activeSessionId;
              const isRenaming = renaming === s.id;
              return (
                <li key={s.id}>
                  <div
                    className={`group rounded-lg px-3 py-2 cursor-pointer transition flex items-center gap-2 ${
                      active
                        ? "bg-brand-500/15 border border-brand-500/30"
                        : "border border-transparent hover:bg-ink-800"
                    }`}
                    onClick={() => !isRenaming && onSelect(s.id)}
                  >
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(s.id);
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        className="flex-1 bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100 focus:outline-none focus:border-brand-500"
                      />
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm truncate ${
                              active ? "text-ink-100 font-medium" : "text-ink-200"
                            }`}
                          >
                            {s.title}
                          </p>
                          <p className="text-[10px] text-ink-500 mt-0.5">
                            {relativeTime(s.last_message_at)}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            aria-label="Renomear conversa"
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(s);
                            }}
                            className="p-1 rounded hover:bg-ink-700 text-ink-400 hover:text-ink-100"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label="Excluir conversa"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Excluir esta conversa?")) {
                                void onDelete(s.id);
                              }
                            }}
                            className="p-1 rounded hover:bg-ink-700 text-ink-400 hover:text-danger-500"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
