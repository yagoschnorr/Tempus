import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import type { Subject } from "@/lib/api/types";
import { useSubjects } from "./hooks/useSubjects";
import { SubjectFormModal } from "./components/SubjectFormModal";
import { DeleteSubjectDialog } from "./components/DeleteSubjectDialog";

function hoursLabel(min: number) {
  if (!min) return "sem meta";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

type FormState = { mode: "create" } | { mode: "edit"; subject: Subject } | null;

export default function SubjectsPage() {
  const { subjects, loading, error, createSubject, updateSubject, deleteSubject } =
    useSubjects();

  const [formState, setFormState] = useState<FormState>(null);
  const [toDelete, setToDelete] = useState<Subject | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleCreate(input: Parameters<typeof createSubject>[0]) {
    await createSubject(input);
    setToast({ kind: "success", message: "Matéria criada" });
  }

  async function handleUpdate(
    id: string,
    input: Parameters<typeof updateSubject>[1]
  ) {
    await updateSubject(id, input);
    setToast({ kind: "success", message: "Matéria atualizada" });
  }

  async function handleDelete(id: string) {
    await deleteSubject(id);
    setToast({ kind: "success", message: "Matéria excluída" });
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-section mb-1">Organização</p>
          <h1 className="text-3xl font-bold text-ink-100">Matérias</h1>
          <p className="text-ink-400 mt-1">
            Organize seus estudos por matéria — cada uma com meta semanal própria e cor.
          </p>
        </div>
        <Button onClick={() => setFormState({ mode: "create" })}>
          <Plus size={16} /> Nova matéria
        </Button>
      </header>

      {loading && (
        <div className="flex items-center gap-3 text-ink-400">
          <Spinner /> Carregando matérias...
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {!loading && !error && subjects.length === 0 && (
        <div className="card p-10 text-center text-ink-400">
          <p className="mb-3">Você ainda não tem nenhuma matéria.</p>
          <Button onClick={() => setFormState({ mode: "create" })}>
            <Plus size={16} /> Criar a primeira
          </Button>
        </div>
      )}

      {!loading && subjects.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s) => (
            <article
              key={s.id}
              className="card p-5 hover:border-brand-500/40 transition group"
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: s.color ?? "#534AB7",
                    boxShadow: `0 0 12px ${s.color ?? "#534AB7"}80`,
                  }}
                />
                <span className="pill bg-ink-900 text-ink-300 border border-ink-700">
                  meta {hoursLabel(s.weekly_goal_minutes ?? 0)}/sem
                </span>
              </div>

              <h3 className="text-lg font-semibold text-ink-100 mb-1">{s.name}</h3>
              <p className="text-sm text-ink-400 line-clamp-2 min-h-[2.5rem]">
                {s.description || "Sem descrição."}
              </p>

              <div className="flex justify-end gap-1 mt-4 opacity-0 group-hover:opacity-100 transition">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFormState({ mode: "edit", subject: s })}
                  aria-label={`Editar ${s.name}`}
                >
                  <Pencil size={14} /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setToDelete(s)}
                  aria-label={`Excluir ${s.name}`}
                  className="text-danger-500 hover:text-danger-500"
                >
                  <Trash2 size={14} /> Excluir
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      <SubjectFormModal
        open={formState !== null}
        onClose={() => setFormState(null)}
        initial={formState?.mode === "edit" ? formState.subject : null}
        onSubmit={(input) =>
          formState?.mode === "edit"
            ? handleUpdate(formState.subject.id, input)
            : handleCreate(input)
        }
      />

      <DeleteSubjectDialog
        subject={toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => (toDelete ? handleDelete(toDelete.id) : Promise.resolve())}
      />

      {toast && <Toast kind={toast.kind} message={toast.message} />}
    </div>
  );
}
