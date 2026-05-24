// Formata um ISO timestamp em rótulo relativo em PT-BR: "agora", "há 5min",
// "há 2h", "ontem", "há 3 dias", "há 2 sem.", "há 4 meses", "há 2 anos".
// Não usa Intl.RelativeTimeFormat para evitar variações entre locales/runtimes
// e manter os rótulos curtos exatamente como aparecem na tela.
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffSec = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));

  if (diffSec < 60) return "agora";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin}min`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `há ${diffHour}h`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "ontem";
  if (diffDay < 7) return `há ${diffDay} dias`;

  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `há ${diffWeek} sem.`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `há ${diffMonth} ${diffMonth === 1 ? "mês" : "meses"}`;

  const diffYear = Math.floor(diffDay / 365);
  return `há ${diffYear} ${diffYear === 1 ? "ano" : "anos"}`;
}
