import type { Character } from "../data/characters";
import { Hint } from "./Hint";
import { calculateCharacterStats } from "../data/calculations";
import { NumberField } from "./NumberField";

export function HealthPanel({ character, onChange, readOnly, manual = false }: { character: Character; onChange?: (updates: Partial<Character>) => void; readOnly: boolean; manual?: boolean }) {
  const stats = calculateCharacterStats(character);
  const maximum = Math.max(0, stats.maxHitPoints ?? 0);
  const current = Math.min(maximum, Math.max(0, character.currentHitPoints ?? maximum));
  const barValue = Math.min(maximum, Math.max(0, current));
  const hpPercent = maximum > 0 ? barValue / maximum * 100 : 0;
  return <section className="sheet-panel sheet-health-panel" aria-label="Hit points"><div className="sheet-health-heading"><h3>Hit points</h3><Hint label="How hit points work">Drag or tap the bar, use − / +, or enter your final HP below. Temporary HP stays separate. {manual ? "Resolve damage, healing, and other combat effects at the table." : "Use Take damage / Heal below to apply combat rules."}</Hint><strong aria-live="polite">{current} / {stats.maxHitPoints ?? "—"} HP{character.temporaryHitPoints > 0 && <span> + {character.temporaryHitPoints} temp</span>}</strong></div>
      <div className="sheet-health-controls"><button type="button" className="button-danger" aria-label="Decrease current HP by 1" disabled={readOnly || !onChange || current <= 0} onClick={() => onChange?.({ currentHitPoints: Math.max(0, current - 1) })}>−</button><input className="sheet-health-range" type="range" aria-label="Current HP health bar" aria-valuetext={current + " of " + (stats.maxHitPoints ?? "unknown maximum") + " hit points"} min={0} max={maximum || 1} step={1} value={barValue} disabled={readOnly || !onChange || maximum === 0} style={{ background: "linear-gradient(to right, #c56b73 " + hpPercent + "%, #38222e " + hpPercent + "%)" }} onChange={(event) => onChange?.({ currentHitPoints: Number(event.target.value) })} /><button type="button" className="button-healing" aria-label="Increase current HP by 1" disabled={readOnly || !onChange || maximum === 0 || current >= maximum} onClick={() => onChange?.({ currentHitPoints: current + 1 })}>+</button></div>
      <div className="play-controls"><label>Current HP<NumberField min={0} max={maximum} value={current} disabled={readOnly || !onChange || maximum === 0} onValue={(value) => onChange?.({ currentHitPoints: value })} /></label><label>Temporary HP<NumberField min={0} max={9999} value={character.temporaryHitPoints} disabled={readOnly || !onChange} onValue={(value) => onChange?.({ temporaryHitPoints: value })} /></label></div></section>;
}
