import { FileText, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { useSubjects } from "@/features/subjects/hooks/useSubjects";
import type { Document, DocumentStatus, UUID } from "@/lib/api/types";
import { useDocuments } from "./hooks/useDocuments";
import { formatBytes } from "./format";
import { UploadDocumentModal } from "./components/UploadDocumentModal";

type SortOrder = "recent" | "size" | "alpha";

const statusClass: Record<DocumentStatus, string> = {
  ready: "bg-success-500/15 text-success-400 border border-success-500/20",
  processing: "bg-warning-500/15 text-warning-500 border border-warning-500/20",
  failed: "bg-danger-500/15 text-danger-500 border border-danger-500/20",
};

const statusLabel: Record<DocumentStatus, string> = {
  ready: "pronto",
  processing: "processando",
  failed: "falhou",
};

function sortDocuments(docs: Document[], order: SortOrder): Document[] {
  const arr = [...docs];
  switch (order) {
    case "recent":
      return arr.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    case "size":
      return arr.sort((a, b) => b.file_size_bytes - a.file_size_bytes);
    case "alpha":
      return arr.sort((a, b) => a.filename.localeCompare(b.filename));
  }
}

export default function DocumentsPage() {
  const {
    documents,
    loading,
    error,
    currentSubjectFilter,
    filterBySubject,
    uploadDocument,
  } = useDocuments();
  const { subjects } = useSubjects();
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const subjectsById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );

  const countsBySubject = useMemo(() => {
    const counts = new Map<UUID, number>();
    for (const d of documents) {
      if (!d.subject_id) continue;
      counts.set(d.subject_id, (counts.get(d.subject_id) ?? 0) + 1);
    }
    return counts;
  }, [documents]);

  const totalBytes = useMemo(
    () => documents.reduce((sum, d) => sum + d.file_size_bytes, 0),
    [documents],
  );

  const sortedDocuments = useMemo(
    () => sortDocuments(documents, sortOrder),
    [documents, sortOrder],
  );

  const isFiltered = currentSubjectFilter !== undefined;

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-section mb-1">Documentos · Biblioteca</p>
          <h1 className="text-3xl font-bold text-ink-100">Sua biblioteca</h1>
          <p className="text-ink-400 mt-1">
            {documents.length} documento{documents.length === 1 ? "" : "s"} · {formatBytes(totalBytes)} · todos pesquisáveis pela IA do Tempus.
          </p>
        </div>
        <Button onClick={() => setIsUploadOpen(true)}>
          <Plus size={16} /> Adicionar documento
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <section className="space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="rounded-lg bg-ink-900 border border-ink-700 px-3 py-1.5 text-sm text-ink-200"
            >
              <option value="recent">Mais recentes</option>
              <option value="size">Maior</option>
              <option value="alpha">Alfabético</option>
            </select>
          </div>

          {loading && documents.length === 0 ? (
            <p className="text-ink-400 text-sm">Carregando documentos...</p>
          ) : error ? (
            <p className="text-danger-400 text-sm">{error}</p>
          ) : sortedDocuments.length === 0 ? (
            <p className="text-ink-400 text-sm">
              Nenhum documento ainda — adicione um PDF para a IA conseguir te ajudar.
            </p>
          ) : (
            sortedDocuments.map((d) => {
              const subject = d.subject_id ? subjectsById.get(d.subject_id) : null;
              return (
                <article
                  key={d.id}
                  className="card p-4 flex items-center gap-4 hover:border-brand-500/40 transition cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-500/15 border border-brand-500/20 flex items-center justify-center text-brand-300">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-ink-100 font-medium truncate">{d.filename}</p>
                    <p className="text-xs text-ink-400 mt-0.5">
                      <span className="text-brand-300">{subject?.name ?? "Sem matéria"}</span> · {d.total_pages ?? "—"} pág · {formatBytes(d.file_size_bytes)}
                    </p>
                  </div>
                  <span className={`pill ${statusClass[d.status]}`}>
                    {statusLabel[d.status]}
                  </span>
                </article>
              );
            })
          )}
        </section>

        <aside className="space-y-6">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="label-section">Matérias</p>
              {isFiltered && (
                <button
                  onClick={() => filterBySubject(undefined)}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Limpar
                </button>
              )}
            </div>
            <ul className="space-y-1.5 text-sm">
              <li
                onClick={() => filterBySubject(undefined)}
                className={`flex items-center justify-between cursor-pointer ${
                  !isFiltered
                    ? "text-ink-100 font-medium"
                    : "text-ink-300 hover:text-ink-100"
                }`}
              >
                Todas
                {!isFiltered && (
                  <span className="text-ink-500">{documents.length}</span>
                )}
              </li>
              {subjects.map((s) => {
                const isActive = currentSubjectFilter === s.id;
                return (
                  <li
                    key={s.id}
                    onClick={() => filterBySubject(s.id)}
                    className={`flex items-center justify-between cursor-pointer ${
                      isActive
                        ? "text-ink-100 font-medium"
                        : "text-ink-300 hover:text-ink-100"
                    }`}
                  >
                    {s.name}
                    {!isFiltered && (
                      <span className="text-ink-500">
                        {countsBySubject.get(s.id) ?? 0}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>

      <UploadDocumentModal
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        subjects={subjects}
        onSubmit={uploadDocument}
      />
    </div>
  );
}
