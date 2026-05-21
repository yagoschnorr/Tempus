import { InputHTMLAttributes, forwardRef } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, className = "", id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label className="block text-sm">
      {label && (
        <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
          {label}
        </span>
      )}
      <input
        ref={ref}
        id={inputId}
        {...rest}
        className={`w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-100 placeholder:text-ink-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition ${className}`}
      />
      {hint && !error && <span className="block mt-1 text-xs text-ink-500">{hint}</span>}
      {error && <span className="block mt-1 text-xs text-danger-500">{error}</span>}
    </label>
  );
});
