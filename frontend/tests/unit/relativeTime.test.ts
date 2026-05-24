import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "@/features/notebooks/relativeTime";

const NOW = new Date("2026-05-24T12:00:00Z");

function isoMinusSeconds(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString();
}

describe("formatRelativeTime", () => {
  it('< 60s → "agora"', () => {
    expect(formatRelativeTime(isoMinusSeconds(0), NOW)).toBe("agora");
    expect(formatRelativeTime(isoMinusSeconds(59), NOW)).toBe("agora");
  });

  it("minutos → \"há Xmin\"", () => {
    expect(formatRelativeTime(isoMinusSeconds(60), NOW)).toBe("há 1min");
    expect(formatRelativeTime(isoMinusSeconds(60 * 45), NOW)).toBe("há 45min");
  });

  it("horas → \"há Xh\"", () => {
    expect(formatRelativeTime(isoMinusSeconds(60 * 60), NOW)).toBe("há 1h");
    expect(formatRelativeTime(isoMinusSeconds(60 * 60 * 5), NOW)).toBe("há 5h");
  });

  it('1 dia → "ontem"', () => {
    expect(formatRelativeTime(isoMinusSeconds(60 * 60 * 24), NOW)).toBe("ontem");
  });

  it("2–6 dias → \"há X dias\"", () => {
    expect(formatRelativeTime(isoMinusSeconds(60 * 60 * 24 * 3), NOW)).toBe(
      "há 3 dias"
    );
  });

  it("semanas → \"há X sem.\"", () => {
    expect(formatRelativeTime(isoMinusSeconds(60 * 60 * 24 * 14), NOW)).toBe(
      "há 2 sem."
    );
  });

  it("meses → singular/plural correto", () => {
    expect(formatRelativeTime(isoMinusSeconds(60 * 60 * 24 * 35), NOW)).toBe(
      "há 1 mês"
    );
    expect(formatRelativeTime(isoMinusSeconds(60 * 60 * 24 * 90), NOW)).toBe(
      "há 3 meses"
    );
  });

  it("anos → singular/plural correto", () => {
    expect(formatRelativeTime(isoMinusSeconds(60 * 60 * 24 * 400), NOW)).toBe(
      "há 1 ano"
    );
    expect(formatRelativeTime(isoMinusSeconds(60 * 60 * 24 * 365 * 3), NOW)).toBe(
      "há 3 anos"
    );
  });

  it("timestamps no futuro caem em \"agora\" (clamp a 0)", () => {
    const future = new Date(NOW.getTime() + 60 * 1000).toISOString();
    expect(formatRelativeTime(future, NOW)).toBe("agora");
  });
});
