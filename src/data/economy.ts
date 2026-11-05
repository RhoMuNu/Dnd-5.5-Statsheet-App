import { defaultCombatState, type Character } from "./characters";
import { isIncapacitated } from "./conditions";

export type TurnState = { enabled: boolean; key: string; active: boolean; actionUsed: boolean; bonusUsed: boolean; reactionUsed: boolean; attacksRemaining: number; slotTurn: string; surgeUsed: boolean; surgeAction: boolean; sneakTurn: string };
export const freshTurn = (key = "local-1"): TurnState => ({ enabled: true, key, active: true, actionUsed: false, bonusUsed: false, reactionUsed: false, attacksRemaining: 0, slotTurn: "", surgeUsed: false, surgeAction: false, sneakTurn: "" });
export function turnState(character: Character): TurnState { return { ...freshTurn(), enabled: false, ...character.combat?.turn }; }
export function attacksPerAction(character: Character) {
  const levels = Object.keys(character.classLevels ?? {}).length ? character.classLevels : { [character.characterClass]: character.level };
  const fighter = levels.Fighter ?? 0;
  if (fighter >= 20) return 4;
  if (fighter >= 11) return 3;
  return Object.entries(levels).some(([name, level]) => ["Barbarian", "Fighter", "Monk", "Paladin", "Ranger"].includes(name) && level >= 5) ? 2 : 1;
}
export function spendTurn(character: Character, kind: "action" | "magic" | "bonus" | "reaction" | "attack", slot = false): Partial<Character> {
  const turn = turnState(character);
  if (!turn.enabled) return {};
  if (isIncapacitated(character)) throw new Error("You cannot act while incapacitated.");
  if (!turn.active && kind !== "reaction") throw new Error("Wait for your turn; only reactions are available now.");
  if (slot && turn.slotTurn === turn.key) throw new Error("You can expend only one spell slot to cast a spell on a turn.");
  if (kind === "bonus") {
    if (turn.bonusUsed) throw new Error("Your Bonus Action is already spent.");
    turn.bonusUsed = true;
  } else if (kind === "reaction") {
    if (turn.reactionUsed) throw new Error("Your Reaction is already spent until the start of your next turn.");
    turn.reactionUsed = true;
  } else if (kind === "attack" && turn.attacksRemaining > 0) turn.attacksRemaining--;
  else {
    if (turn.surgeAction && kind !== "magic") turn.surgeAction = false;
    else if (turn.actionUsed) throw new Error(kind === "magic" && turn.surgeAction ? "Action Surge cannot grant a Magic action in the 2024 rules." : "Your Action is already spent.");
    else turn.actionUsed = true;
    if (kind === "attack") turn.attacksRemaining = attacksPerAction(character) - 1;
  }
  if (slot) turn.slotTurn = turn.key;
  return { combat: { ...defaultCombatState(), ...character.combat, turn } };
}
export function spellTurnCost(character: Character, castingTime: string, slot: boolean): Partial<Character> {
  if (!turnState(character).enabled) return {};
  const time = castingTime.toLowerCase();
  const kind = /bonus/.test(time) ? "bonus" : /reaction/.test(time) ? "reaction" : /^(1\s+)?action$/.test(time.trim()) ? "magic" : null;
  if (!kind) throw new Error("This casting time requires extended casting; resolve it outside turn tracking with the DM.");
  return spendTurn(character, kind, slot);
}
export function useActionSurge(character: Character): Partial<Character> {
  const turn = turnState(character), fighter = character.classLevels.Fighter ?? (character.characterClass === "Fighter" ? character.level : 0);
  const maximum = fighter >= 17 ? 2 : fighter >= 2 ? 1 : 0, used = character.resourceUses["fighter.action-surge"] ?? 0;
  if (isIncapacitated(character) || !turn.enabled || !turn.active || turn.surgeUsed || used >= maximum) throw new Error("Action Surge is not available now.");
  return { resourceUses: { ...character.resourceUses, "fighter.action-surge": used + 1 }, combat: { ...defaultCombatState(), ...character.combat, turn: { ...turn, surgeUsed: true, surgeAction: true } } };
}
