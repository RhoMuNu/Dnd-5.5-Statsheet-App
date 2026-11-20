import { useState, type InputHTMLAttributes } from "react";

type NumberFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
  value: number;
  min?: number;
  max?: number;
  /** Require whole numbers (the default). */
  integer?: boolean;
  onValue: (value: number) => void;
};

/**
 * A number input that can be cleared and retyped. Valid values are applied as you type;
 * an empty or out-of-range entry is kept on screen until the field loses focus, then the saved value returns.
 */
export function NumberField({ value, min, max, integer = true, onValue, onBlur, ...props }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input {...props} type="number" min={min} max={max} value={draft ?? (Number.isFinite(value) ? String(value) : "")}
    onChange={(event) => {
      const text = event.target.value;
      setDraft(text);
      const parsed = Number(text);
      if (text.trim() === "" || !Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) return;
      if ((min !== undefined && parsed < min) || (max !== undefined && parsed > max)) return;
      onValue(parsed);
    }}
    onBlur={(event) => { setDraft(null); onBlur?.(event); }} />;
}
