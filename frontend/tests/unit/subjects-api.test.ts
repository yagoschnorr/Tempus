import { describe, it, expect } from "vitest";
import { subjectsApi } from "@/features/subjects/api";
import { ApiError } from "@/lib/api/client";

describe("subjectsApi", () => {
  it("list devolve as 3 matérias do seed", async () => {
    const list = await subjectsApi.list();
    expect(list).toHaveLength(3);
    expect(list.map((s) => s.name)).toContain("Cálculo I");
  });

  it("create adiciona matéria nova", async () => {
    const created = await subjectsApi.create({
      name: "Física",
      color: "#ff0000",
      weekly_goal_minutes: 240,
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Física");

    const list = await subjectsApi.list();
    expect(list.some((s) => s.id === created.id)).toBe(true);
  });

  it("create rejeita nome duplicado com ApiError 409", async () => {
    await expect(subjectsApi.create({ name: "Cálculo I" })).rejects.toMatchObject({
      status: 409,
    });
    await expect(subjectsApi.create({ name: "Cálculo I" })).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it("update altera campos da matéria", async () => {
    const updated = await subjectsApi.update("s-1", { name: "Cálculo II" });
    expect(updated.name).toBe("Cálculo II");

    const fresh = await subjectsApi.get("s-1");
    expect(fresh.name).toBe("Cálculo II");
  });

  it("remove deleta a matéria", async () => {
    await subjectsApi.remove("s-2");
    const list = await subjectsApi.list();
    expect(list.some((s) => s.id === "s-2")).toBe(false);
  });
});
