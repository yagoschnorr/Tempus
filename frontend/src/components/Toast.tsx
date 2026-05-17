interface Props {
  kind?: "success" | "error" | "info";
  message: string;
}

const styles = {
  success: "border-success-500/30 bg-success-500/10 text-success-400",
  error: "border-danger-500/30 bg-danger-500/10 text-danger-500",
  info: "border-info-500/30 bg-info-500/10 text-info-500",
};

export function Toast({ kind = "info", message }: Props) {
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg border backdrop-blur text-sm font-medium ${styles[kind]}`}
    >
      {message}
    </div>
  );
}
