import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Plus } from "lucide-react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import type { Note, Notebook, UUID } from "@/lib/api/types";
import { notebooksApi } from "./api";
import { useNotes } from "./hooks/useNotes";
import { NoteEditor } from "./components/NoteEditor";
import { NewNoteModal } from "./components/NewNoteModal";
import { NoteSummaryModal } from "./components/NoteSummaryModal";
import { DeleteNoteDialog } from "./components/DeleteNoteDialog";
import { getErrorMessage } from "@/lib/api/client";
import { formatRelativeTime } from "./relativeTime";

export default function NotebookDetailPage() {
  const { id } = useParams<{ id: UUID }>();
  const navigate = useNavigate();

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [notebookError, setNotebookError] = useState<string | null>(null);
  const [notebookLoading, setNotebookLoading] = useState(true);

  const { notes, loading, error, create, update, remove, summarize } = useNotes(
    id ?? null
  );

  const [activeId, setActiveId] = useState<UUID | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Note | null>(null);
  const [summary, setSummary] = useState<{
    open: boolean;
    loading: boolean;
    text: string | null;
    error: string | null;
  }>({ open: false, loading: false, text: null, error: null });
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  // Carrega o notebook (precisamos do título + cor pro header).
  // Reuso o list endpoint pra evitar criar GET /notebooks/{id} dedicado agora.
  useEffect(() => {
    if (!id) return;
    setNotebookLoading(true);
    setNotebookError(null);
    notebooksApi
      .list()
      .then((all) => {
        const found = all.find((n) => n.id === id);
        if (!found) {
          setNotebookError("Caderno não encontrado");
        } else {
          setNotebook(found);
        }
      })
      .catch((err) => {
        setNotebookError(getErrorMessage(err, "Não foi possível carregar o caderno"));
      })
      .finally(() => setNotebookLoading(false));
  }, [id]);

  // Seleciona a primeira folha por padrão (ou mantém a atual se ainda existe).
  useEffect(() => {
    if (notes.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !notes.some((n) => n.id === activeId)) {
      setActiveId(notes[0].id);
    }
  }, [notes, activeId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId]
  );

  async function handleCreateNote(title: string) {
    const note = await create({ title });
    setActiveId(note.id);
    setToast({ kind: "success", message: "Folha criada" });
  }

  async function handleDeleteNote() {
    if (!toDelete) return;
    await remove(toDelete.id);
    setToast({ kind: "success", message: "Folha excluída" });
  }

  // ---- Render -----------------------------------------------------------

  if (notebookLoading) {
    return (
      <div className="flex items-center gap-3 text-ink-400">
        <Spinner /> Carregando caderno...
      </div>
    );
  }

  if (notebookError || !notebook) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Link to="/notebooks" className="text-sm text-ink-400 hover:text-ink-200 inline-flex items-center gap-1.5">
          <ArrowLeft size={14} /> Voltar para cadernos
        </Link>
        <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-4 py-3">
          {notebookError ?? "Caderno não encontrado"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-6xl">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 mb-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate("/notebooks")}
            className="text-sm text-ink-400 hover:text-ink-200 inline-flex items-center gap-1.5 mb-1"
          >
            <ArrowLeft size={14} /> Cadernos
          </button>
          <h1
            className="text-2xl font-bold text-ink-100 truncate"
            style={{ borderBottom: `2px solid ${notebook.color}` }}
          >
            {notebook.title}
          </h1>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus size={16} /> Nova folha
        </Button>
      </header>

      {/* Sidebar + Editor */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar */}
        <aside className="w-64 card p-3 overflow-y-auto shrink-0">
          {loading && (
            <div className="flex items-center gap-2 text-ink-400 text-sm p-2">
              <Spinner /> Carregando...
            </div>
          )}

          {error && !loading && (
            <p className="text-xs text-danger-500 p-2">{error}</p>
          )}

          {!loading && notes.length === 0 && (
            <div className="text-center text-ink-400 text-sm p-4">
              <p className="mb-3">Nenhuma folha ainda.</p>
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <Plus size={14} /> Criar
              </Button>
            </div>
          )}

          <ul className="space-y-1">
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  onClick={() => setActiveId(note.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition ${
                    note.id === activeId
                      ? "bg-brand-500/15 text-ink-100 border border-brand-500/30"
                      : "text-ink-300 hover:bg-ink-900 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="shrink-0 text-ink-500" />
                    <span className="font-medium text-sm truncate">{note.title}</span>
                  </div>
                  <span className="text-xs text-ink-500 ml-6">
                    {formatRelativeTime(note.updated_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Editor */}
        <section className="flex-1 card p-6 min-w-0">
          {activeNote ? (
            <NoteEditor
              note={activeNote}
              onSave={update}
              onDelete={() => setToDelete(activeNote)}
              onSummarize={summarize}
              onSummaryStart={() =>
                setSummary({ open: true, loading: true, text: null, error: null })
              }
              onSummaryReady={(text) =>
                setSummary({ open: true, loading: false, text, error: null })
              }
              onSummaryError={(message) =>
                setSummary({ open: true, loading: false, text: null, error: message })
              }
              onSavedToast={() => setToast({ kind: "success", message: "Folha salva" })}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-ink-400 text-sm">
              {notes.length === 0
                ? "Crie sua primeira folha para começar."
                : "Selecione uma folha à esquerda."}
            </div>
          )}
        </section>
      </div>

      <NewNoteModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSubmit={handleCreateNote}
      />

      <DeleteNoteDialog
        note={toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDeleteNote}
      />

      <NoteSummaryModal
        open={summary.open}
        loading={summary.loading}
        summary={summary.text}
        error={summary.error}
        onClose={() => setSummary((s) => ({ ...s, open: false }))}
      />

      {toast && <Toast kind={toast.kind} message={toast.message} />}
    </div>
  );
}
