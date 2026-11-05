import { activeEffects, effectTotal } from "./effects";
import { defaultCombatState, type Character } from "./characters";
import { calculateCharacterStats } from "./calculations";
import { activeConditions, exhaustionLevel, isIncapacitated, type Condition, effectiveRollMode, type RollMode } from "./conditions";

export const combatState = (character: Character) => ({ ...defaultCombatState(), ...character.combat });
export const spellSlotKey = (pool: string, level: number) => `spell-slot:${pool}:${level}`;
export function rollDie(sides: number): number {
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) throw new Error("Unsupported die size.");
  // Rejection sampling also works in LAN browsers without a secure context.
  const limit = Math.floor(0x100000000 / sides) * sides;
  const buffer = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % sides + 1;
}

export function applyDamage(character: Character, amount: number, critical = false): Partial<Character> {
  if (!Number.isInteger(amount) || amount <= 0) return {};
  const max = calculateCharacterStats(character).maxHitPoints;
  if (max === null) return {};
  const hp = Math.min(max, character.currentHitPoints ?? max);
  const combat = combatState(character);
  const remaining = Math.max(0, amount - character.temporaryHitPoints);
  const nextHp = Math.max(0, hp - remaining);
  if (nextHp === 0) combat.conditions = [...new Set([...combat.conditions, "Prone" as const])];
  if (hp === 0) {
    combat.stable = false;
    combat.deathFailures = Math.min(3, combat.deathFailures + (critical ? 2 : 1));
  }
  if ((remaining >= hp && remaining - hp >= max) || combat.deathFailures >= 3) combat.dead = true;
  if (combat.concentration) {
    if (nextHp === 0 || combat.dead) { combat.concentration = ""; combat.concentrationDC = null; }
    else combat.concentrationDC = Math.max(combat.concentrationDC ?? 0, Math.min(30, Math.max(10, Math.floor(amount / 2))));
  }
  return { currentHitPoints: nextHp, temporaryHitPoints: Math.max(0, character.temporaryHitPoints - amount), combat };
}

export function healCharacter(character: Character, amount: number): Partial<Character> {
  const max = calculateCharacterStats(character).maxHitPoints;
  const combat = combatState(character);
  if (max === null || combat.dead || !Number.isInteger(amount) || amount <= 0) return {};
  return { currentHitPoints: Math.min(max, (character.currentHitPoints ?? max) + amount),
    combat: { ...combat, deathSuccesses: 0, deathFailures: 0, stable: false } };
}

export function deathSave(character: Character, roll: number, extraBonus = 0): Partial<Character> {
  const combat = combatState(character);
  if (character.currentHitPoints !== 0 || combat.stable || combat.dead || !Number.isInteger(roll) || roll < 1 || roll > 20) return {};
  if (roll === 20) return healCharacter(character, 1);
  if (roll - 2 * exhaustionLevel(character) + effectTotal(character, "save") + extraBonus >= 10 && roll !== 1) combat.deathSuccesses += 1;
  else combat.deathFailures = Math.min(3, combat.deathFailures + (roll === 1 ? 2 : 1));
  if (combat.deathFailures >= 3) combat.dead = true;
  if (combat.deathSuccesses >= 3) { combat.stable = true; combat.deathSuccesses = 0; combat.deathFailures = 0; }
  return { combat };
}

export function restCharacter(character: Character, kind: "Short Rest" | "Long Rest"): Partial<Character> {
  const stats = calculateCharacterStats(character);
  const combat = combatState(character);
  if ((character.currentHitPoints ?? stats.maxHitPoints ?? 0) <= 0 || combat.dead) return {};
  const resourceUses = { ...character.resourceUses };
  const elapsedRounds = kind === "Long Rest" ? 4800 : 600;
  const effects = activeEffects(character).map((effect) => effect.rounds === null ? effect : { ...effect, rounds: effect.rounds - elapsedRounds }).filter((effect) => effect.rounds === null || effect.rounds > 0);
  for (const resource of stats.classResources) {
    if (!resource.key || resource.maxUses === undefined) continue;
    if (kind === "Long Rest") resourceUses[resource.key] = 0;
    else if (resource.recovery === "Short Rest") resourceUses[resource.key] = resource.shortRestRecovery === "all" ? 0 : Math.max(0, (resourceUses[resource.key] ?? 0) - 1);
  }
  for (const slot of stats.spellSlots) if (kind === "Long Rest" || slot.pool.startsWith("Pact Magic")) resourceUses[spellSlotKey(slot.pool, slot.spellLevel)] = 0;
  const customResources = character.customResources.map((resource) => {
    if ((kind === "Long Rest" && resource.recovery !== "manual") || (kind === "Short Rest" && resource.recovery === "short-all")) return { ...resource, used: 0 };
    if (kind === "Short Rest" && resource.recovery === "short-one") return { ...resource, used: Math.max(0, resource.used - 1) };
    return resource;
  });
  const restedCombat = kind === "Long Rest"
    ? { ...combat, effects, exhaustion: Math.max(0, combat.exhaustion - 1), hitDiceUsed: {}, deathSuccesses: 0, deathFailures: 0, stable: false, concentration: "", concentrationDC: null }
    : { ...combat, effects };
  return { resourceUses, customResources, combat: restedCombat, ...(kind === "Long Rest" ? {
    currentHitPoints: calculateCharacterStats({ ...character, combat: restedCombat }).maxHitPoints, temporaryHitPoints: 0,
  } : {}) };
}

export function spendHitDie(character: Character, className: string, roll: number): Partial<Character> {
  const stats = calculateCharacterStats(character);
  const entry = stats.classBreakdown.find((entry) => entry.name === className);
  const combat = combatState(character);
  const used = combat.hitDiceUsed[className] ?? 0;
  if (!entry || used >= entry.level || combat.dead || (character.currentHitPoints ?? stats.maxHitPoints ?? 0) <= 0
    || !Number.isInteger(roll) || roll < 1 || roll > entry.hitDie) return {};
  return { ...healCharacter(character, Math.max(1, roll + stats.abilityModifiers.Constitution)),
    combat: { ...combat, hitDiceUsed: { ...combat.hitDiceUsed, [className]: used + 1 } } };
}

export function castCharacterSpell(character: Character, id: string, slotKey?: string): Partial<Character> {
  const spell = character.spells.find((spell) => spell.id === id);
  if (!spell?.prepared || isIncapacitated(character)) return {};
  const updates: Partial<Character> = {};
  if (spell.level > 0) {
    const slot = calculateCharacterStats(character).spellSlots.find((slot) => spellSlotKey(slot.pool, slot.spellLevel) === slotKey);
    if (!slot || slot.spellLevel < spell.level || (character.resourceUses[slotKey!] ?? 0) >= slot.total) return {};
    updates.resourceUses = { ...character.resourceUses, [slotKey!]: (character.resourceUses[slotKey!] ?? 0) + 1 };
  }
  if (spell.concentration) updates.combat = { ...combatState(character), concentration: spell.name, concentrationDC: null };
  return updates;
}

export function setCondition(character: Character, condition: Condition, enabled: boolean): Partial<Character> {
  const combat = combatState(character);
  combat.conditions = enabled ? [...new Set([...combat.conditions, condition])] : combat.conditions.filter((entry) => entry !== condition);
  if (enabled && condition === "Unconscious") combat.conditions = [...new Set([...combat.conditions, "Prone" as const])];
  if (isIncapacitated({ ...character, combat })) { combat.concentration = ""; combat.concentrationDC = null; }
  return { combat };
}

export function setExhaustion(character: Character, level: number): Partial<Character> {
  if (!Number.isInteger(level)) return {};
  const combat = combatState(character);
  combat.exhaustion = Math.min(6, Math.max(0, Math.trunc(level)));
  if (combat.exhaustion >= 6) { combat.dead = true; combat.concentration = ""; combat.concentrationDC = null; }
  return { combat };
}

export function rollD20(character: Character, kind: "attack" | "check" | "initiative" | "save", requested: RollMode = "normal", ability = "", extraAdvantage = false, extraDisadvantage = false, die = rollDie) {
  const mode = effectiveRollMode(character, kind, requested, ability, extraAdvantage, extraDisadvantage);
  const rolls = mode === "normal" ? [die(20)] : [die(20), die(20)];
  const natural = mode === "advantage" ? Math.max(...rolls) : mode === "disadvantage" ? Math.min(...rolls) : rolls[0];
  return { rolls, natural, mode };
}

export function adjustedDamage(character: Character, damage: number, defense: "normal" | "resistant" | "vulnerable" | "immune"): number {
  if (!Number.isInteger(damage) || damage < 0) return 0;
  if (defense === "immune") return 0;
  const resistant = defense === "resistant" || activeConditions(character).includes("Petrified");
  return Math.floor(damage * (resistant ? 0.5 : 1) * (defense === "vulnerable" ? 2 : 1));
}
