"use client";

import { motion } from "framer-motion";
import { FieldError } from "./ui/FieldError";

interface Option {
  id: string;
  label: string;
}

interface IdealTypeQuestionCardProps {
  questionId: string;
  legend: string;
  options: Option[];
  mustMatchChecked: boolean;
  mustMatchDisabled: boolean;
  onMustMatchToggle: (questionId: string) => void;
  error?: string;
}

export function IdealTypeQuestionCard({
  questionId,
  legend,
  options,
  mustMatchChecked,
  mustMatchDisabled,
  onMustMatchToggle,
  error,
}: IdealTypeQuestionCardProps) {
  const name = `ideal_${questionId}`;

  return (
    <fieldset className="rounded-2xl border-2 border-brand-100 bg-white/60 p-4">
      <legend className="block text-sm font-bold text-brand-700">{legend}</legend>
      <p className="mt-1 text-xs text-brand-400">해당하는 항목을 모두 선택해주세요</p>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
        {options.map((option) => (
          <motion.label
            key={option.id}
            whileTap={{ scale: 0.95 }}
            className="group relative flex cursor-pointer items-center justify-center rounded-full border-2 border-brand-100 bg-white px-4 py-2.5 text-center text-sm font-medium text-brand-700 transition has-checked:border-brand-500 has-checked:bg-brand-500 has-checked:text-white has-checked:shadow-md"
          >
            <input type="checkbox" name={name} value={option.id} className="peer sr-only" />
            <span className="leading-snug">{option.label}</span>
          </motion.label>
        ))}
      </div>
      <FieldError message={error} />

      <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/60 px-3 py-2 text-xs font-bold text-brand-600 transition has-checked:border-coral-400 has-checked:bg-coral-300/10 has-checked:text-coral-600">
        <input
          type="checkbox"
          name="mustMatchQuestionIds"
          value={questionId}
          checked={mustMatchChecked}
          disabled={mustMatchDisabled}
          onChange={() => onMustMatchToggle(questionId)}
          className="h-4 w-4 accent-coral-500"
        />
        <span>⭐ 이 조건은 꼭 반영해주세요</span>
      </label>
    </fieldset>
  );
}
