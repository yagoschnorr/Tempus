import { describe, it, expect } from "vitest";
import { notebooksApi } from "@/features/notebooks/api";
import { ApiError } from "@/lib/api/client";

describe("notebooksApi — notebooks CRUD", () => {
  it("list inicia vazio", async () => {
    const list = await notebooksApi.list();
    expect(list).toEqual([]);
  });

  it("create devolve notebook com defaults + agregados zerados", async () => {
    const nb = await notebooksApi.create({ title: "Diário de Cálculo" });
    expect(nb.id).toBeTruthy();
    expect(nb.title).toBe("Diário de Cálculo");
    expect(nb.color).toBe("#0F6E56");
    expect(nb.pinned).toBe(false);
    expect(nb.notes_count).toBe(0);
    expect(nb.last_activity_at).toBe(nb.updated_at);
  });

  it("create rejeita title vazio (422)", async () => {
    await expect(notebooksApi.create({ title: "   " })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("update PATCH altera campos parciais", async () => {
    const nb = await notebooksApi.create({ title: "Original" });
    const updated = await notebooksApi.update(nb.id, {
      title: "Renomeado",
      color: "#a855f7",
    });
    expect(updated.title).toBe("Renomeado");
    expect(updated.color).toBe("#a855f7");
  });

  it("update com pinned: true fixa o notebook", async () => {
    const nb = await notebooksApi.create({ title: "Para fixar" });
    const pinned = await notebooksApi.update(nb.id, { pinned: true });
    expect(pinned.pinned).toBe(true);
  });

  it("list ordena fixados primeiro, depois por last_activity desc", async () => {
    const a = await notebooksApi.create({ title: "A" });
    await notebooksApi.create({ title: "B" });
    await notebooksApi.create({ title: "C" });
    await notebooksApi.update(a.id, { pinned: true });

    const list = await notebooksApi.list();
    // A fixado vem primeiro; B e C não-fixados, C foi criado por último então
    // tem last_activity mais recente.
    expect(list.map((n) => n.title)).toEqual(["A", "C", "B"]);
  });

  it("remove apaga e GET 404 nas notes filhas", async () => {
    const nb = await notebooksApi.create({ title: "Para apagar" });
    await notebooksApi.remove(nb.id);
    await expect(notebooksApi.listNotes(nb.id)).rejects.toBeInstanceOf(
      ApiError
    );
  });
});

describe("notebooksApi — notes CRUD + agregados", () => {
  it("createNote anexa à lista do notebook", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    const note = await notebooksApi.createNote(nb.id, {
      title: "Folha 1",
      content: "conteúdo",
    });
    expect(note.notebook_id).toBe(nb.id);
    expect(note.title).toBe("Folha 1");

    const list = await notebooksApi.listNotes(nb.id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(note.id);
  });

  it("notes_count agregado reflete N notes criadas", async () => {
    const nb = await notebooksApi.create({ title: "Multi" });
    await notebooksApi.createNote(nb.id, { title: "1" });
    await notebooksApi.createNote(nb.id, { title: "2" });
    await notebooksApi.createNote(nb.id, { title: "3" });

    const [out] = await notebooksApi.list();
    expect(out.notes_count).toBe(3);
  });

  it("last_activity_at avança após criar uma note", async () => {
    const nb = await notebooksApi.create({ title: "Acompanha" });
    const initial = nb.last_activity_at;

    // Espera 1ms pra garantir timestamp distinto (Date.now resolution = 1ms).
    await new Promise((r) => setTimeout(r, 5));
    await notebooksApi.createNote(nb.id, { title: "Folha nova" });

    const [out] = await notebooksApi.list();
    expect(out.last_activity_at > initial).toBe(true);
  });

  it("updateNote altera title/content", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    const note = await notebooksApi.createNote(nb.id, { title: "Folha" });
    const updated = await notebooksApi.updateNote(note.id, {
      title: "Folha v2",
      content: "novo conteúdo",
    });
    expect(updated.title).toBe("Folha v2");
    expect(updated.content).toBe("novo conteúdo");
  });

  it("removeNote remove e summary devolve 404", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    const note = await notebooksApi.createNote(nb.id, { title: "Folha" });
    await notebooksApi.removeNote(note.id);

    await expect(notebooksApi.summarizeNote(note.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("summarizeNote 422 quando content vazio", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    const note = await notebooksApi.createNote(nb.id, { title: "Vazia" });

    await expect(notebooksApi.summarizeNote(note.id)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("summarizeNote devolve resumo quando há content", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    const note = await notebooksApi.createNote(nb.id, {
      title: "Com texto",
      content: "Texto longo sobre cálculo diferencial",
    });
    const res = await notebooksApi.summarizeNote(note.id);
    expect(res.summary).toContain("Texto longo");
  });
});
