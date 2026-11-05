import { spendTurn, turnState } from "./economy";
import { hasFeat } from "./advancement";
import { subclassIs } from "./rulesCatalog";
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
  { name: "Greatclub", count: 1, die: 8, type: "Bludgeoning" },
  { name: "Light Hammer", count: 1, die: 4, type: "Bludgeoning" },
  { name: "Sickle", count: 1, die: 4, type: "Slashing" },
  { name: "Dart", count: 1, die: 4, type: "Piercing", ranged: true, finesse: true },
  { name: "Sling", count: 1, die: 4, type: "Bludgeoning", ranged: true },
  { name: "Flail", count: 1, die: 8, type: "Bludgeoning" },
  { name: "Lance", count: 1, die: 10, type: "Piercing", notes: "Two-Handed unless mounted; edit the two-handed setting when mounted." },
  { name: "Morningstar", count: 1, die: 8, type: "Piercing" },
  { name: "Pike", count: 1, die: 10, type: "Piercing" },
  { name: "Trident", count: 1, die: 8, type: "Piercing", notes: "Two hands: change damage die to d10." },
  { name: "War Pick", count: 1, die: 8, type: "Piercing", notes: "Two hands: change damage die to d10." },
  { name: "Whip", count: 1, die: 4, type: "Slashing", finesse: true },
  { name: "Blowgun", count: 0, die: 4, type: "Piercing", ranged: true },
  { name: "Musket", count: 1, die: 12, type: "Piercing", ranged: true },
  { name: "Pistol", count: 1, die: 10, type: "Piercing", ranged: true },
  { name: "Unarmed Strike", count: 0, die: 4, type: "Bludgeoning", notes: "Base damage is 1 + Strength. Edit for Martial Arts or other features." },
] as const;

export function makeWeaponAttack(character: Character, name: string, id: string): CharacterAttack {
  const preset = WEAPON_PRESETS.find((item) => item.name === name) ?? WEAPON_PRESETS[0];
  const dex = character.abilityScores.Dexterity > character.abilityScores.Strength;
  return { id, name: preset.name, ability: ("finesse" in preset ? dex : "ranged" in preset) ? "Dexterity" : "Strength",
    proficient: true, diceCount: preset.count, dieSize: preset.die, damageType: preset.type, attackBonus: 0,
    damageBonus: preset.count === 0 ? 1 : 0, addAbilityToDamage: true,
    ranged: "ranged" in preset, twoHanded: ["Greatsword", "Greataxe", "Maul", "Glaive", "Halberd", "Longbow", "Shortbow", "Light Crossbow", "Heavy Crossbow", "Greatclub", "Lance", "Pike", "Musket"].includes(preset.name),
    notes: "notes" in preset ? preset.notes : "" };
}
export function attackNumbers(character: Character, attack: CharacterAttack) {
  const stats = calculateCharacterStats(character);
  return { toHit: stats.abilityModifiers[attack.ability] + (attack.proficient ? stats.proficiencyBonus : 0) + attack.attackBonus - 2 * exhaustionLevel(character) + effectTotal(character, "attack") + (attack.ranged && hasFeat(character, "Archery") ? 2 : 0),
    damageBonus: ((attack.addAbilityToDamage || (attack.offHand && (hasFeat(character, "Two-Weapon Fighting") || stats.abilityModifiers[attack.ability] < 0))) ? stats.abilityModifiers[attack.ability] : 0) + attack.damageBonus + effectTotal(character, "damage") };
}
export function rollWeaponAttack(character: Character, attack: CharacterAttack, mode: RollMode, targetAC: number | null, extraAdvantage = false, extraDisadvantage = false, die = rollDie, cost: "attack" | "bonus" | "reaction" = attack.offHand ? "bonus" : "attack") {
  if (isIncapacitated(character)) throw new Error("Cannot attack while incapacitated or dead.");
  const updates = spendTurn(character, cost);
  const result = rollD20(character, "attack", mode, attack.ability, extraAdvantage, extraDisadvantage, die);
  const bonus = attackNumbers(character, attack).toHit;
  const extra = effectDice(character, "attack", die);
  const total = result.natural + bonus + extra.total;
  const critical = result.natural >= (subclassIs(character, "Fighter", "Champion", 15) ? 18 : subclassIs(character, "Fighter", "Champion") ? 19 : 20);
  const hit = result.natural === 1 ? false : critical ? true : targetAC === null ? null : total >= targetAC;
  return { ...result, updates, effectRolls: extra.rolls, effectBonus: extra.total, bonus, total, critical, hit };
}
export function rollWeaponDamage(character: Character, attack: CharacterAttack, critical: boolean, sneakAttack = false, rage = false, die = rollDie) {
  const stats = calculateCharacterStats(character);
  const rogue = stats.classBreakdown.find((entry) => entry.name === "Rogue")?.level ?? 0;
  const barbarian = stats.classBreakdown.find((entry) => entry.name === "Barbarian")?.level ?? 0;
  const turn = turnState(character);
  if (sneakAttack && turn.enabled && turn.sneakTurn === turn.key) throw new Error("Sneak Attack has already been used this turn.");
  const updates: Partial<Character> = sneakAttack && turn.enabled && character.combat ? { combat: { ...character.combat, turn: { ...turn, sneakTurn: turn.key } } } : {};
  const multiplier = critical ? 2 : 1;
  const rolls = Array.from({ length: attack.diceCount * multiplier }, () => { const roll = die(attack.dieSize, `${character.name}: ${attack.name} damage${critical ? " · critical" : ""}`); return attack.twoHanded && hasFeat(character, "Great Weapon Fighting") ? Math.max(3, roll) : roll; });
  const sneak = Array.from({ length: sneakAttack ? Math.ceil(rogue / 2) * multiplier : 0 }, () => die(6, `${character.name}: Sneak Attack damage${critical ? " · critical" : ""}`));
  const rageBonus = rage && barbarian > 0 && attack.ability === "Strength" ? barbarian >= 16 ? 4 : barbarian >= 9 ? 3 : 2 : 0;
  const bonus = attackNumbers(character, attack).damageBonus + rageBonus;
  return { updates, rolls, sneak, bonus, total: Math.max(0, [...rolls, ...sneak].reduce((sum, roll) => sum + roll, 0) + bonus) };
}
