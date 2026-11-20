import { useId } from "react";

type Option<T extends string> = { value: T; label: string };

/** A row of mutually exclusive choices. Real radio inputs keep native keyboard (arrow keys) and screen-reader behaviour. */
export function SegmentedControl<T extends string>({ label, value, options, onChange, disabled = false, compact = false }: { label: string; value: T; options: Option<T>[]; onChange: (value: T) => void; disabled?: boolean; compact?: boolean }) {
  const name = useId();
  return <fieldset className={`segmented${compact ? " segmented-compact" : ""}`} disabled={disabled}>
    <legend>{label}</legend>
    <div className="segmented-options">
      {options.map((option) => <label key={option.value} className={value === option.value ? "selected" : ""}>
        <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

export const ROLL_MODE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "advantage", label: "Advantage" },
  { value: "disadvantage", label: "Disadvantage" },
] as const satisfies readonly Option<"normal" | "advantage" | "disadvantage">[];
