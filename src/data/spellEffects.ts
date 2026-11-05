import { effectDice, effectTotal } from "./effects";
import type { Character } from "./characters";
import { calculateCharacterStats } from "./calculations";
import { castCharacterSpell, healCharacter, rollD20, rollDie, spellSlotKey } from "./gameplay";
import { isIncapacitated, exhaustionLevel, type RollMode } from "./conditions";

type SpellFormula = { name: string; level: number; count: number; die: number; perSlot: number; ability: boolean; kind: "healing" | "damage"; type: string; cantripScaling?: boolean; attack?: boolean; note: string };
// Opt-in formulas from the free 2024 spell descriptions. Targeting and saves stay explicit.
export const SPELL_FORMULAS: SpellFormula[] = [
  { name: "Cure Wounds", level: 1, count: 2, die: 8, perSlot: 2, ability: true, kind: "healing", type: "HP", note: "One touched creature." },
  { name: "Healing Word", level: 1, count: 2, die: 4, perSlot: 2, ability: true, kind: "healing", type: "HP", note: "One visible creature within range." },
  { name: "Fire Bolt", level: 0, count: 1, die: 10, perSlot: 0, ability: false, kind: "damage", type: "Fire", cantripScaling: true, attack: true, note: "Make a ranged spell attack; apply damage only on a hit." },
  { name: "Sacred Flame", level: 0, count: 1, die: 8, perSlot: 0, ability: false, kind: "damage", type: "Radiant", cantripScaling: true, note: "Target makes a Dexterity save; no damage on success. Cover does not help this save." },
  { name: "Guiding Bolt", level: 1, count: 4, die: 6, perSlot: 1, ability: false, kind: "damage", type: "Radiant", attack: true, note: "Ranged spell attack. On a hit, the next qualifying attack against the target has advantage before your next turn ends." },
  { name: "Thunderwave", level: 1, count: 2, die: 8, perSlot: 1, ability: false, kind: "damage", type: "Thunder", note: "Constitution save; half damage on success; push 10 feet on failure." },
  { name: "Shatter", level: 2, count: 3, die: 8, perSlot: 1, ability: false, kind: "damage", type: "Thunder", note: "Constitution save; half damage on success. Check the spell for target exceptions." },
  { name: "Fireball", level: 3, count: 8, die: 6, perSlot: 1, ability: false, kind: "damage", type: "Fire", note: "Each affected creature makes a Dexterity save; half damage on success." },
];

export function resolveSpellCast(character: Character, id: string, slotKey: string | undefined, className: string, healSelf: boolean, die = rollDie, mode: RollMode = "normal", targetAC: number | null = null) {
  const spell = character.spells.find((entry) => entry.id === id);
  if (!spell?.prepared || isIncapacitated(character)) throw new Error("Cannot cast this spell now.");
  const stats = calculateCharacterStats(character);
  const slot = stats.spellSlots.find((entry) => spellSlotKey(entry.pool, entry.spellLevel) === slotKey);
  if (spell.level > 0 && (!slot || slot.spellLevel < spell.level || (character.resourceUses[slotKey!] ?? 0) >= slot.total)) throw new Error("Choose an available spell slot.");
  const updates = castCharacterSpell(character, id, slotKey);
  const formula = SPELL_FORMULAS.find((entry) => entry.name === spell.automation && entry.level === spell.level);
  if (!formula) return { updates, summary: `${spell.name} cast. Resolve its effects with the DM.` };
  const caster = stats.spellcastingProgressions.find((entry) => entry.className === className);
  if (!caster) throw new Error("Choose the class whose spellcasting ability applies.");
  const ability = caster.attackBonus + 2 * exhaustionLevel(character) - stats.proficiencyBonus - effectTotal(character, "attack");
  const scaling = formula.cantripScaling ? 1 + [5, 11, 17].filter((level) => stats.totalLevel >= level).length : 1;
  const count = formula.count * scaling + formula.perSlot * Math.max(0, (slot?.spellLevel ?? spell.level) - formula.level);
  const attack = formula.attack ? rollD20(character, "attack", mode, "", false, false, die) : null;
  const attackEffect = attack ? effectDice(character, "attack", die) : { total: 0, rolls: [] };
  const attackTotal = attack ? attack.natural + caster.attackBonus + attackEffect.total : null;
  const critical = attack?.natural === 20;
  const missed = attack?.natural === 1 || (attack !== null && !critical && targetAC !== null && attackTotal! < targetAC);
  const rolls = Array.from({ length: count * (critical ? 2 : 1) }, () => die(formula.die));
  const bonus = formula.ability ? ability : 0;
  const total = missed ? 0 : Math.max(0, rolls.reduce((sum, value) => sum + value, 0) + bonus);
  const result = { ...updates };
  if (formula.kind === "healing" && healSelf) Object.assign(result, healCharacter({ ...character, ...updates }, total));
  const attackSummary = attack ? `Attack [${attack.rolls.join(", ")}] + ${caster.attackBonus}${attackEffect.rolls.length ? ` + effects [${attackEffect.rolls.join(", ")}]` : ""} = ${attackTotal} · ${critical ? "critical" : missed ? "miss" : targetAC === null ? "compare to target AC" : "hit"}. ` : "";
  return { updates: result, summary: `${attackSummary}${spell.name}: ${count * (critical ? 2 : 1)}d${formula.die}${bonus ? ` ${bonus >= 0 ? "+" : "−"} ${Math.abs(bonus)}` : ""} [${rolls.join(", ")}] = ${total} ${formula.type} ${formula.kind}${healSelf && formula.kind === "healing" ? " · applied to your HP" : ""}. ${formula.note} Spell attack ${caster.attackBonus >= 0 ? "+" : ""}${caster.attackBonus}; save DC ${caster.saveDC}.` };
}
