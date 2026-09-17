import type { InputHTMLAttributes } from "react";
import { FieldError } from "./FieldError";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextInput({ label, hint, error, id, ...inputProps }: TextInputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-brand-700">
        {label}
      </label>
      {hint && <p className="mt-1 text-xs text-brand-400">{hint}</p>}
      <input
        id={id}
        className="mt-2 w-full rounded-2xl border-2 border-brand-100 bg-white px-4 py-3 text-base text-foreground outline-none transition placeholder:text-brand-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        {...inputProps}
      />
      <FieldError message={error} />
    </div>
  );
}
