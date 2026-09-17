import { FieldError } from "./FieldError";

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioPillGroupProps {
  legend: string;
  name: string;
  options: RadioOption[];
  defaultValue?: string;
  error?: string;
}

export function RadioPillGroup({
  legend,
  name,
  options,
  defaultValue,
  error,
}: RadioPillGroupProps) {
  return (
    <fieldset>
      <legend className="block text-sm font-bold text-brand-700">{legend}</legend>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="group relative flex cursor-pointer flex-col rounded-2xl border-2 border-brand-100 bg-white px-4 py-3 transition has-checked:border-brand-500 has-checked:bg-brand-50"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              required
              className="peer sr-only"
            />
            <span className="text-sm font-bold text-brand-700 peer-checked:text-brand-700">
              {option.label}
            </span>
            {option.description && (
              <span className="mt-0.5 text-xs text-brand-400">
                {option.description}
              </span>
            )}
            <span className="pointer-events-none absolute right-3 top-3 h-4 w-4 rounded-full border-2 border-brand-200 bg-white transition group-has-checked:border-brand-500 group-has-checked:bg-brand-500" />
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}
