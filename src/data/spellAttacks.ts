import type { Character } from "./characters";
import { calculateCharacterStats } from "./calculations";
import { isIncapacitated, type RollMode } from "./conditions";
import { effectDice } from "./effects";
import { inventoryArmor } from "./equipment";
import { rollD20, rollDie } from "./gameplay";

// A single attack roll, independent of slot/action spending. Used by the initial
// cast and by explicitly requested remaining rays or ongoing-spell attacks.
export function rollSpellAttack(character: Character, spellId: string, className: string, mode: RollMode = "normal", targetAC: number | null = null, die = rollDie) {
  const spell = character.spells.find((entry) => entry.id === spellId);
  if (!spell?.prepared || isIncapacitated(character)) throw new Error("Cannot make this spell attack now.");
  if (character.armorSource === "inventory" && inventoryArmor(character).untrained) throw new Error("You cannot cast spells while wearing armor without training.");
  if (!["normal", "advantage", "disadvantage"].includes(mode)) throw new Error("Choose a valid spell attack roll mode.");
  if (targetAC !== null && (!Number.isInteger(targetAC) || targetAC < 0)) throw new Error("Enter a valid target AC or leave it blank.");
  if (spell.className && spell.className !== className) throw new Error("Choose the class this spell belongs to.");
  const caster = calculateCharacterStats(character).spellcastingProgressions.find((entry) => entry.className === className);
  if (!caster) throw new Error("Choose the class whose spellcasting ability applies.");
  const attack = rollD20(character, "attack", mode, "", false, false, die);
  const effects = effectDice(character, "attack", die);
  const total = attack.natural + caster.attackBonus + effects.total;
  const critical = attack.natural === 20;
  const missed = attack.natural === 1 || (!critical && targetAC !== null && total < targetAC);
  const outcome = critical ? "critical hit" : missed ? "miss" : targetAC === null ? "compare to target AC" : "hit";
  return { natural: attack.natural, critical, total, missed, rolls: attack.rolls, bonus: caster.attackBonus, summary: `${spell.name} · ${className} spell attack [${attack.rolls.join(", ")}] ${caster.attackBonus >= 0 ? "+" : "−"} ${Math.abs(caster.attackBonus)}${effects.rolls.length ? ` + effects [${effects.rolls.join(", ")}]` : ""} = ${total} · ${outcome}. Resolve damage and extra effects at the table${critical ? "; double eligible damage dice for this critical hit" : ""}.` };
}
