import type { Character } from "./characters";

export const CONDITIONS = ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"] as const;
export type Condition = typeof CONDITIONS[number];
export type RollMode = "normal" | "advantage" | "disadvantage";
export const CONDITION_NOTES: Record<Condition, string> = {
  Blinded: "Cannot see. Sight-dependent checks fail; attacks have disadvantage; incoming attacks have advantage.",
  Charmed: "Cannot attack the charmer; the charmer has advantage on social checks against you.",
  Deafened: "Cannot hear; hearing-dependent checks fail.",
  Frightened: "Disadvantage on attacks and checks while the source is in sight; cannot approach it willingly.",
  Grappled: "Speed 0; attacks against creatures other than the grappler have disadvantage.",
  Incapacitated: "No actions, bonus actions, or reactions; concentration ends; initiative has disadvantage.",
  Invisible: "Initiative has advantage; attack advantage applies against creatures that cannot see you.",
  Paralyzed: "Incapacitated; speed 0; Strength/Dexterity saves fail. Incoming hits within 5 feet are critical.",
  Petrified: "Incapacitated; speed 0; Strength/Dexterity saves fail; resistance to all damage; immune to Poisoned.",
  Poisoned: "Attacks and ability checks have disadvantage.",
  Prone: "Attacks have disadvantage; crawl or spend half your speed to stand. Incoming attacks depend on distance.",
  Restrained: "Speed 0; attacks and Dexterity saves have disadvantage; incoming attacks have advantage.",
  Stunned: "Incapacitated; Strength/Dexterity saves fail; incoming attacks have advantage.",
  Unconscious: "Incapacitated and prone; speed 0; Strength/Dexterity saves fail; nearby incoming hits are critical.",
};
export function activeConditions(character: Character): Condition[] {
  const result = new Set<Condition>(character.combat?.conditions ?? []);
  if (character.currentHitPoints === 0 && !character.combat?.dead) result.add("Unconscious");
  if (result.has("Unconscious")) result.add("Prone");
  if (["Paralyzed", "Petrified", "Stunned", "Unconscious"].some((name) => result.has(name as Condition))) result.add("Incapacitated");
  if (result.has("Petrified")) result.delete("Poisoned");
  return [...result];
}
export function isIncapacitated(character: Character): boolean {
  return character.combat?.dead === true || exhaustionLevel(character) >= 6 || activeConditions(character).includes("Incapacitated");
}
export function exhaustionLevel(character: Character): number {
  return Math.max(0, Math.min(6, Math.trunc(character.combat?.exhaustion ?? 0)));
}
export function automaticSaveFailure(character: Character, ability: string): boolean {
  return ["Strength", "Dexterity"].includes(ability) && activeConditions(character).some((condition) => ["Paralyzed", "Petrified", "Stunned", "Unconscious"].includes(condition));
}
export function effectiveRollMode(character: Character, kind: "attack" | "check" | "initiative" | "save", requested: RollMode, ability = "", extraAdvantage = false, extraDisadvantage = false): RollMode {
  const conditions = activeConditions(character);
  const advantage = requested === "advantage" || extraAdvantage || (kind === "initiative" && conditions.includes("Invisible"));
  const disadvantage = requested === "disadvantage" || extraDisadvantage
    || (["attack", "check", "initiative"].includes(kind) && conditions.includes("Poisoned"))
    || (kind === "attack" && conditions.some((condition) => ["Blinded", "Prone", "Restrained"].includes(condition)))
    || (kind === "initiative" && conditions.includes("Incapacitated"))
    || (kind === "save" && ability === "Dexterity" && conditions.includes("Restrained"));
  return advantage === disadvantage ? "normal" : advantage ? "advantage" : "disadvantage";
}
