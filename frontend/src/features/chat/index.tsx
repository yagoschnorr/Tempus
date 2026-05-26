import { useEffect, useMemo, useState } from "react";
import { Toast } from "@/components/Toast";
import type { ChatSession, UUID } from "@/lib/api/types";
import { useSubjects } from "@/features/subjects/hooks/useSubjects";
import { ChatInput } from "./components/ChatInput";
import { ChatSidebar } from "./components/ChatSidebar";
import { EmptyState } from "./components/EmptyState";
import { MessageList } from "./components/MessageList";
import { NewConversationModal } from "./components/NewConversationModal";
import { useChat } from "./hooks/useChat";
import { useChatSessions } from "./hooks/useChatSessions";

/**
 * Tela do UC10 — Chat de dúvidas com IA via RAG por matéria.
 *
 * Estado central: `activeSessionId`.
 *   - `null` + `pendingSubjectId` setado → modo "nova conversa". O primeiro
 *     `ask()` cria a sessão no backend e devolve o id.
 *   - `UUID` → sessão existente carregada via GET /chat/sessions/{id}.
 */
export default function ChatPage() {
  const { subjects, loading: subjectsLoading } = useSubjects();
  const sessions = useChatSessions();

  const [activeSessionId, setActiveSessionId] = useState<UUID | null>(null);
  const [pendingSubjectId, setPendingSubjectId] = useState<UUID | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const chat = useChat({
    sessionId: activeSessionId,
    onSessionCreated: (id) => setActiveSessionId(id),
  });

  // Auto-dismiss do toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Mostra erros do hook como toast.
  useEffect(() => {
    if (chat.error) setToast({ kind: "error", message: chat.error });
  }, [chat.error]);
  useEffect(() => {
    if (sessions.error) setToast({ kind: "error", message: sessions.error });
  }, [sessions.error]);

  const activeSession: ChatSession | null = useMemo(() => {
    if (!activeSessionId) return null;
    return sessions.sessions.find((s) => s.id === activeSessionId) ?? null;
  }, [activeSessionId, sessions.sessions]);

  // subject_id "vigente": da sessão ativa OU do dropdown pendente em nova conversa.
  const effectiveSubjectId =
    activeSession?.subject_id ?? pendingSubjectId ?? null;
  const effectiveSubjectName = useMemo(() => {
    if (!effectiveSubjectId) return null;
    return subjects.find((s) => s.id === effectiveSubjectId)?.name ?? null;
  }, [effectiveSubjectId, subjects]);

  function handleNew() {
    setNewModalOpen(true);
  }

  function handleConfirmNew(subjectId: UUID) {
    setActiveSessionId(null);
    setPendingSubjectId(subjectId);
    chat.clear();
  }

  function handleSelect(id: UUID) {
    if (id === activeSessionId) return;
    setActiveSessionId(id);
  }

  async function handleDelete(id: UUID) {
    try {
      await sessions.remove(id);
      if (id === activeSessionId) {
        setActiveSessionId(null);
        chat.clear();
      }
      setToast({ kind: "success", message: "Conversa excluída" });
    } catch {
      setToast({ kind: "error", message: "Falha ao excluir conversa" });
    }
  }

  async function handleRename(id: UUID, title: string) {
    try {
      await sessions.rename(id, title);
    } catch {
      setToast({ kind: "error", message: "Falha ao renomear conversa" });
    }
  }

  async function handleAsk(question: string) {
    const result = await chat.ask(question, { subjectId: pendingSubjectId });
    if (result) {
      // Após resposta, recarrega a sidebar pra refletir last_message_at
      // e o título da sessão recém-criada.
      void sessions.refresh();
      setPendingSubjectId(null);
    }
  }

  const inputBlockedReason =
    !activeSessionId && !pendingSubjectId
      ? 'Clique em "Nova conversa" para começar.'
      : undefined;

  return (
    // Altura FIXA em dvh: ancorada na viewport (não no main, que é flex-1 de um
    // pai `min-h-full` e portanto pode crescer com o conteúdo). 4rem subtrai
    // apenas o `py-8` do <main>; o header da página e o card dividem o resto
    // via flex column + flex-1, dando o máximo de altura ao card.
    <div
      className="flex flex-col max-w-[1200px]"
      style={{ height: "calc(100dvh - 4rem)" }}
    >
      <header className="shrink-0 mb-4">
        <p className="label-section mb-1">Tirar dúvida com IA</p>
        <h1 className="text-2xl font-bold text-ink-100">
          Pergunte sobre seus documentos
        </h1>
      </header>

      <div className="card flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row">
        <ChatSidebar
          sessions={sessions.sessions}
          subjects={subjects}
          filter={sessions.filter}
          onFilterChange={sessions.setFilter}
          activeSessionId={activeSessionId}
          loading={sessions.loading || subjectsLoading}
          onSelect={handleSelect}
          onNew={handleNew}
          onRename={handleRename}
          onDelete={handleDelete}
        />

        <section className="flex-1 flex flex-col min-h-0">
          {!activeSessionId && !pendingSubjectId ? (
            <EmptyState
              title="Nenhuma conversa selecionada"
              description='Clique em "Nova conversa" na barra lateral ou escolha uma da lista para retomar.'
            />
          ) : (
            <>
              <header className="border-b border-ink-700 px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink-100 truncate">
                    {activeSession?.title ?? "Nova conversa"}
                  </h2>
                  {effectiveSubjectName && (
                    <p className="text-[11px] text-ink-500">
                      Matéria: {effectiveSubjectName}
                    </p>
                  )}
                </div>
              </header>
              <MessageList messages={chat.messages} sending={chat.sending} />
              <ChatInput
                disabled={chat.loading}
                blockedReason={inputBlockedReason}
                onSubmit={handleAsk}
              />
            </>
          )}
        </section>
      </div>

      <NewConversationModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        subjects={subjects}
        defaultSubjectId={sessions.filter}
        onConfirm={handleConfirmNew}
      />

      {toast && <Toast kind={toast.kind} message={toast.message} />}
    </div>
  );
}
