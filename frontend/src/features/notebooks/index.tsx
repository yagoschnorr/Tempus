import { useEffect, useMemo, useState } from "react";
import { BookOpen, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import type { Notebook } from "@/lib/api/types";
import { useNotebooks } from "./hooks/useNotebooks";
import { NotebookFormModal } from "./components/NotebookFormModal";
import { DeleteNotebookDialog } from "./components/DeleteNotebookDialog";
import { formatRelativeTime } from "./relativeTime";

type FormState = { mode: "create" } | { mode: "edit"; notebook: Notebook } | null;

function notesLabel(n: number) {
  if (n === 0) return "sem folhas";
  return `${n} ${n === 1 ? "folha" : "folhas"}`;
}

export default function NotebooksPage() {
  const { notebooks, loading, error, create, update, remove, togglePin } =
    useNotebooks();

  const [formState, setFormState] = useState<FormState>(null);
  const [toDelete, setToDelete] = useState<Notebook | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const { pinned, others } = useMemo(() => {
    const pinned: Notebook[] = [];
    const others: Notebook[] = [];
    for (const nb of notebooks) {
      (nb.pinned ? pinned : others).push(nb);
    }
    return { pinned, others };
  }, [notebooks]);

  async function handleSubmit(input: Parameters<typeof create>[0]) {
    if (formState?.mode === "edit") {
      await update(formState.notebook.id, input);
      setToast({ kind: "success", message: "Caderno atualizado" });
    } else {
      await create(input);
      setToast({ kind: "success", message: "Caderno criado" });
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await remove(toDelete.id);
      setToast({ kind: "success", message: "Caderno excluído" });
    } catch {
      setToast({ kind: "error", message: "Não foi possível excluir" });
      throw new Error("delete failed");
    }
  }

  async function handleTogglePin(nb: Notebook) {
    try {
      await togglePin(nb.id);
    } catch {
      setToast({ kind: "error", message: "Não foi possível fixar o caderno" });
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-section mb-1">Cadernos</p>
          <h1 className="text-3xl font-bold text-ink-100">Cadernos</h1>
          <p className="text-ink-400 mt-1 max-w-2xl">
            Suas anotações organizadas por tema — escrita rica, com formatação simples.
          </p>
        </div>
        <Button onClick={() => setFormState({ mode: "create" })}>
          <Plus size={16} /> Novo caderno
        </Button>
      </header>

      {loading && (
        <div className="flex items-center gap-3 text-ink-400">
          <Spinner /> Carregando cadernos...
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {!loading && !error && notebooks.length === 0 && (
        <div className="card p-10 text-center text-ink-400">
          <p className="mb-3">Você ainda não tem nenhum caderno.</p>
          <Button onClick={() => setFormState({ mode: "create" })}>
            <Plus size={16} /> Criar o primeiro
          </Button>
        </div>
      )}

      {!loading && pinned.length > 0 && (
        <section>
          <p className="label-section mb-3">Fixados</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinned.map((nb) => (
              <NotebookCard
                key={nb.id}
                notebook={nb}
                onEdit={() => setFormState({ mode: "edit", notebook: nb })}
                onDelete={() => setToDelete(nb)}
                onTogglePin={() => handleTogglePin(nb)}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && others.length > 0 && (
        <section>
          <p className="label-section mb-3">
            Todos os cadernos ({notebooks.length})
          </p>
          <div className="card divide-y divide-ink-700">
            {others.map((nb) => (
              <NotebookRow
                key={nb.id}
                notebook={nb}
                onEdit={() => setFormState({ mode: "edit", notebook: nb })}
                onDelete={() => setToDelete(nb)}
                onTogglePin={() => handleTogglePin(nb)}
              />
            ))}
          </div>
        </section>
      )}

      <NotebookFormModal
        open={formState !== null}
        onClose={() => setFormState(null)}
        initial={formState?.mode === "edit" ? formState.notebook : null}
        onSubmit={handleSubmit}
      />

      <DeleteNotebookDialog
        notebook={toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
      />

      {toast && <Toast kind={toast.kind} message={toast.message} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card "Fixado" (grid maior) e Row (lista compacta) — mesmo dado, layouts
// diferentes pra reproduzir o design original (Fixados em destaque, demais
// em lista densa).
// ---------------------------------------------------------------------------

interface ItemProps {
  notebook: Notebook;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

function NotebookCard({ notebook, onEdit, onDelete, onTogglePin }: ItemProps) {
  return (
    <article className="card p-5 hover:border-brand-500/40 transition group relative">
      <div className="flex items-center justify-between mb-2">
        <span className="pill bg-brand-500/15 text-brand-300 border border-brand-500/20">
          <Pin size={10} /> Fixado
        </span>
        <span className="text-xs text-ink-500 uppercase tracking-wider">
          {formatRelativeTime(notebook.last_activity_at)}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-ink-100 mb-1">{notebook.title}</h3>
      <p className="text-sm text-ink-400">{notesLabel(notebook.notes_count)}</p>

      <NotebookActions
        notebook={notebook}
        onEdit={onEdit}
        onDelete={onDelete}
        onTogglePin={onTogglePin}
      />
    </article>
  );
}

function NotebookRow({ notebook, onEdit, onDelete, onTogglePin }: ItemProps) {
  return (
    <article className="p-4 flex items-center gap-4 hover:bg-ink-900 transition group">
      <div
        className="w-9 h-9 rounded-lg border border-ink-700 flex items-center justify-center text-ink-400"
        style={{ backgroundColor: `${notebook.color}20` }}
      >
        <BookOpen size={16} style={{ color: notebook.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-ink-100 font-medium truncate">{notebook.title}</p>
        <p className="text-xs text-ink-500">{notesLabel(notebook.notes_count)}</p>
      </div>
      <span className="text-xs text-ink-500 uppercase tracking-wider hidden sm:block">
        {formatRelativeTime(notebook.last_activity_at)}
      </span>
      <NotebookActions
        notebook={notebook}
        onEdit={onEdit}
        onDelete={onDelete}
        onTogglePin={onTogglePin}
      />
    </article>
  );
}

function NotebookActions({
  notebook,
  onEdit,
  onDelete,
  onTogglePin,
}: ItemProps) {
  return (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition mt-2 justify-end">
      <Button
        size="sm"
        variant="ghost"
        onClick={onTogglePin}
        aria-label={notebook.pinned ? `Desafixar ${notebook.title}` : `Fixar ${notebook.title}`}
      >
        {notebook.pinned ? <PinOff size={14} /> : <Pin size={14} />}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onEdit}
        aria-label={`Editar ${notebook.title}`}
      >
        <Pencil size={14} />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        aria-label={`Excluir ${notebook.title}`}
        className="text-danger-500 hover:text-danger-500"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}
