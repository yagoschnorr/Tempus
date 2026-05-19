export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className="inline-block animate-spin rounded-full border-2 border-ink-700 border-t-brand-500"
      style={{ width: size, height: size }}
    />
  );
}
