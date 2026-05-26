import type { ReactNode } from "react";

export const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-xl font-bold text-ink-100 mb-3 mt-2">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-lg font-semibold text-ink-100 mt-4 mb-2">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-base font-semibold text-ink-100 mt-3 mb-1">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="text-ink-300 mb-2 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc list-inside text-ink-300 space-y-1 mb-2 ml-2">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal list-inside text-ink-300 space-y-1 mb-2 ml-2">
      {children}
    </ol>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="text-ink-100 font-semibold">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-ink-400">{children}</em>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="bg-ink-900 px-1.5 py-0.5 rounded text-xs font-mono text-brand-300">
      {children}
    </code>
  ),
};
