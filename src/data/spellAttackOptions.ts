import type { CharacterSpell } from "./characters";

export const SPELL_ATTACK_ONLY = "Spell attack only";
export const MANUAL_SPELL_EFFECTS = "manual";
export function describesSpellAttack(description: string) {
  return /\b(?:melee|ranged) spell attacks?\b/i.test(description);
}
export function usesSpellAttackOnly(spell: CharacterSpell) {
  if (spell.automation === SPELL_ATTACK_ONLY) return true;
  if (spell.automation) return false;
  return describesSpellAttack(spell.description);
}
