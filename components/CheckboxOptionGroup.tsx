"use client";

import { motion } from "framer-motion";
import { FieldError } from "./ui/FieldError";

interface Option {
  id: string;
  label: string;
}

interface CheckboxOptionGroupProps {
  legend: string;
  hint?: string;
  name: string;
  options: Option[];
  error?: string;
}

export function CheckboxOptionGroup({
  legend,
  hint,
  name,
  options,
  error,
}: CheckboxOptionGroupProps) {
  return (
    <fieldset>
      <legend className="block text-sm font-bold text-brand-700">{legend}</legend>
      {hint && <p className="mt-1 text-xs text-brand-400">{hint}</p>}

      {/* 옵션 배열 길이에 따라 자동으로 늘어나거나 줄어드는 grid 컨테이너 */}
      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
        {options.map((option) => (
          <motion.label
            key={option.id}
            whileTap={{ scale: 0.95 }}
            className="group relative flex cursor-pointer items-center justify-center rounded-full border-2 border-brand-100 bg-white px-4 py-2.5 text-center text-sm font-medium text-brand-700 transition has-checked:border-brand-500 has-checked:bg-brand-500 has-checked:text-white has-checked:shadow-md"
          >
            <input
              type="checkbox"
              name={name}
              value={option.id}
              className="peer sr-only"
            />
            <span className="leading-snug">{option.label}</span>
          </motion.label>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}
