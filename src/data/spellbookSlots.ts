import { spellSlotKey } from "./gameplay";

export function spellbookSlotRows(slots: { spellLevel: number; total: number; pool: string }[], uses: Record<string, number>) {
  return slots.map((slot) => {
    const key = spellSlotKey(slot.pool, slot.spellLevel);
    const recorded = uses[key];
    const used = Number.isFinite(recorded) ? Math.min(slot.total, Math.max(0, Math.trunc(recorded))) : 0;
    return { ...slot, key, remaining: slot.total - used };
  }).sort((a, b) => a.spellLevel - b.spellLevel || a.pool.localeCompare(b.pool));
}
