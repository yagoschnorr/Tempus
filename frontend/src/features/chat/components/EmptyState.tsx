import { MessageCircle } from "lucide-react";

interface Props {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 gap-3">
      <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
        <MessageCircle size={20} className="text-brand-300" />
      </div>
      <h2 className="text-lg font-semibold text-ink-100">{title}</h2>
      <p className="text-sm text-ink-400 max-w-sm">{description}</p>
    </div>
  );
}
