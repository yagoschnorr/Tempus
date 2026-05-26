const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1) return "0 B";
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  const formatted = exponent === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${UNITS[exponent]}`;
}
