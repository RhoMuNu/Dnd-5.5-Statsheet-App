import { ABILITIES, type AbilityName, type Character, type SkillName } from "./characters";
import { calculateCharacterStats } from "./calculations";
import { effectDice, effectTotal } from "./effects";
import { automaticSaveFailure, exhaustionLevel, type RollMode } from "./conditions";
import { rollD20 } from "./gameplay";
import type { DieRoller } from "./physicalDice";

/** A d20 check: "Initiative", "Save: Wisdom", a skill name such as "Perception", or a plain ability check such as "Strength check". */
export type CheckName = string;

const savedAbility = (check: CheckName) => check.startsWith("Save: ") ? check.slice(6) as AbilityName : null;
const checkedAbility = (check: CheckName) => { const ability = check.endsWith(" check") ? check.slice(0, -6) as AbilityName : null; return ability && ABILITIES.includes(ability) ? ability : null; };
const signed = (value: number) => `${value >= 0 ? "+" : "−"} ${Math.abs(value)}`;

export function checkBonus(character: Character, check: CheckName): number {
  const stats = calculateCharacterStats(character);
  if (check === "Initiative") return stats.initiative;
  const save = savedAbility(check);
  if (save) return stats.savingThrows[save];
  const ability = checkedAbility(check);
  if (ability) return stats.abilityModifiers[ability] + effectTotal(character, "check") - 2 * exhaustionLevel(character);
  return stats.skillBonuses[check as SkillName];
}

/** Saves that conditions make fail outright need no roll. */
export function automaticCheckFailure(character: Character, check: CheckName): boolean {
  const save = savedAbility(check);
  return !!save && automaticSaveFailure(character, save);
}

/** Rolls the check with the sheet's bonuses, condition effects and bonus dice, returning a one-line summary. */
export function resolveCheckRoll(character: Character, check: CheckName, mode: RollMode, die: DieRoller): string {
  const save = savedAbility(check), ability = checkedAbility(check);
  const result = rollD20(character, check === "Initiative" ? "initiative" : save ? "save" : "check", mode, save ?? ability ?? check, false, false, die);
  const bonus = checkBonus(character, check);
  const extra = save ? effectDice(character, "save", die) : { total: 0, rolls: [] };
  return `${check}: ${result.rolls.join(", ")}${result.rolls.length > 1 ? ` → ${result.natural}` : ""} ${signed(bonus)}${extra.rolls.length ? ` + effects [${extra.rolls.join(", ")}]` : ""} = ${result.natural + bonus + extra.total}`;
}
