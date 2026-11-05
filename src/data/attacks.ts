import { effectDice, effectTotal } from "./effects";
import type { Character, CharacterAttack } from "./characters";
import { calculateCharacterStats } from "./calculations";
import { exhaustionLevel, isIncapacitated, type RollMode } from "./conditions";
import { rollD20, rollDie } from "./gameplay";

// Weapon dice and properties: 2024 Basic Rules, Equipment.
export const WEAPON_PRESETS = [
  { name: "Dagger", count: 1, die: 4, type: "Piercing", finesse: true },
  { name: "Club", count: 1, die: 4, type: "Bludgeoning" },
  { name: "Handaxe", count: 1, die: 6, type: "Slashing" },
  { name: "Javelin", count: 1, die: 6, type: "Piercing" },
  { name: "Mace", count: 1, die: 6, type: "Bludgeoning" },
  { name: "Quarterstaff", count: 1, die: 6, type: "Bludgeoning", notes: "Two hands: change damage die to d8." },
  { name: "Spear", count: 1, die: 6, type: "Piercing", notes: "Two hands: change damage die to d8." },
  { name: "Shortbow", count: 1, die: 6, type: "Piercing", ranged: true },
  { name: "Light Crossbow", count: 1, die: 8, type: "Piercing", ranged: true },
  { name: "Longbow", count: 1, die: 8, type: "Piercing", ranged: true },
  { name: "Heavy Crossbow", count: 1, die: 10, type: "Piercing", ranged: true },
  { name: "Hand Crossbow", count: 1, die: 6, type: "Piercing", ranged: true },
  { name: "Longsword", count: 1, die: 8, type: "Slashing", notes: "Two hands: change damage die to d10." },
  { name: "Battleaxe", count: 1, die: 8, type: "Slashing", notes: "Two hands: change damage die to d10." },
  { name: "Warhammer", count: 1, die: 8, type: "Bludgeoning", notes: "Two hands: change damage die to d10." },
  { name: "Rapier", count: 1, die: 8, type: "Piercing", finesse: true },
  { name: "Scimitar", count: 1, die: 6, type: "Slashing", finesse: true },
  { name: "Shortsword", count: 1, die: 6, type: "Piercing", finesse: true },
  { name: "Greatsword", count: 2, die: 6, type: "Slashing" },
  { name: "Greataxe", count: 1, die: 12, type: "Slashing" },
  { name: "Maul", count: 2, die: 6, type: "Bludgeoning" },
  { name: "Glaive", count: 1, die: 10, type: "Slashing" },
  { name: "Halberd", count: 1, die: 10, type: "Slashing" },
  { name: "Unarmed Strike", count: 0, die: 4, type: "Bludgeoning", notes: "Base damage is 1 + Strength. Edit for Martial Arts or other features." },
] as const;

export function makeWeaponAttack(character: Character, name: string, id: string): CharacterAttack {
  const preset = WEAPON_PRESETS.find((item) => item.name === name) ?? WEAPON_PRESETS[0];
  const dex = character.abilityScores.Dexterity > character.abilityScores.Strength;
  return { id, name: preset.name, ability: ("ranged" in preset || ("finesse" in preset && dex)) ? "Dexterity" : "Strength",
    proficient: true, diceCount: preset.count, dieSize: preset.die, damageType: preset.type, attackBonus: 0,
    damageBonus: preset.name === "Unarmed Strike" ? 1 : 0, addAbilityToDamage: true,
    notes: "notes" in preset ? preset.notes : "" };
}
export function attackNumbers(character: Character, attack: CharacterAttack) {
  const stats = calculateCharacterStats(character);
  return { toHit: stats.abilityModifiers[attack.ability] + (attack.proficient ? stats.proficiencyBonus : 0) + attack.attackBonus - 2 * exhaustionLevel(character) + effectTotal(character, "attack"),
    damageBonus: (attack.addAbilityToDamage ? stats.abilityModifiers[attack.ability] : 0) + attack.damageBonus + effectTotal(character, "damage") };
}
export function rollWeaponAttack(character: Character, attack: CharacterAttack, mode: RollMode, targetAC: number | null, extraAdvantage = false, extraDisadvantage = false, die = rollDie) {
  if (isIncapacitated(character)) throw new Error("Cannot attack while incapacitated or dead.");
  const result = rollD20(character, "attack", mode, "", extraAdvantage, extraDisadvantage, die);
  const bonus = attackNumbers(character, attack).toHit;
  const extra = effectDice(character, "attack", die);
  const total = result.natural + bonus + extra.total;
  const critical = result.natural === 20;
  const hit = result.natural === 1 ? false : critical ? true : targetAC === null ? null : total >= targetAC;
  return { ...result, effectRolls: extra.rolls, effectBonus: extra.total, bonus, total, critical, hit };
}
export function rollWeaponDamage(character: Character, attack: CharacterAttack, critical: boolean, sneakAttack = false, rage = false, die = rollDie) {
  const stats = calculateCharacterStats(character);
  const rogue = stats.classBreakdown.find((entry) => entry.name === "Rogue")?.level ?? 0;
  const barbarian = stats.classBreakdown.find((entry) => entry.name === "Barbarian")?.level ?? 0;
  const multiplier = critical ? 2 : 1;
  const rolls = Array.from({ length: attack.diceCount * multiplier }, () => die(attack.dieSize));
  const sneak = Array.from({ length: sneakAttack ? Math.ceil(rogue / 2) * multiplier : 0 }, () => die(6));
  const rageBonus = rage && barbarian > 0 && attack.ability === "Strength" ? barbarian >= 16 ? 4 : barbarian >= 9 ? 3 : 2 : 0;
  const bonus = attackNumbers(character, attack).damageBonus + rageBonus;
  return { rolls, sneak, bonus, total: Math.max(0, [...rolls, ...sneak].reduce((sum, roll) => sum + roll, 0) + bonus) };
}
