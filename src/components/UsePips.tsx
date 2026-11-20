/**
 * Tappable uses for slots and limited features. Filled pips are available; tapping one spends a use,
 * tapping an empty pip restores one. Large pools fall back to the − / + counter.
 */
export const MAX_PIPS = 8;

export function UsePips({ label, total, used, onChange, disabled = false }: { label: string; total: number; used: number; onChange: (used: number) => void; disabled?: boolean }) {
  const available = Math.max(0, total - used);
  return <div className="use-pips" role="group" aria-label={`${label}: ${available} of ${total} available`}>
    {Array.from({ length: total }, (_, index) => {
      const filled = index < available;
      return <button type="button" key={index} className={`use-pip${filled ? " filled" : ""}`} disabled={disabled}
        aria-label={`${label} ${index + 1} of ${total}, ${filled ? "available. Spend one" : "spent. Restore one"}`}
        onClick={() => onChange(Math.min(total, Math.max(0, used + (filled ? 1 : -1))))} />;
    })}
    <span className="use-pips-count" aria-hidden="true">{available}/{total}</span>
  </div>;
}
