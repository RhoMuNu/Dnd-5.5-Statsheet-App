import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, defaultCombatState, normalizeCharacter } from "../src/data/characters.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";
import { activeConditions, automaticSaveFailure, effectiveRollMode } from "../src/data/conditions.ts";
import { adjustedDamage, castCharacterSpell, deathSave, restCharacter, setCondition, setExhaustion } from "../src/data/gameplay.ts";
import { attackNumbers, makeWeaponAttack, rollWeaponAttack, rollWeaponDamage } from "../src/data/attacks.ts";
import { advanceEffects, effectDice, makeEffect } from "../src/data/effects.ts";
import { resolveSpellCast } from "../src/data/spellEffects.ts";
import { useHealingFeature } from "../src/data/featureActions.ts";
import { changeEncounter, emptyEncounter } from "../server/encounters.mjs";

function hero(overrides = {}) {
  return { ...defaultCharacterStats(), id: "hero", name: "Hero", concept: "", species: "Human", characterClass: "Fighter", background: "", level: 5, classLevels: { Fighter: 5 }, createdAt: "2026-11-05", updatedAt: "2026-11-05",
    abilityScores: { Strength: 16, Dexterity: 18, Constitution: 14, Intelligence: 16, Wisdom: 16, Charisma: 16 }, combat: defaultCombatState(), ...overrides };
}
function conditioned(names, exhaustion = 0) { return hero({ combat: { ...defaultCombatState(), conditions: names, exhaustion } }); }
test("2024 exhaustion reduces every relevant total, speed, and death saves without lowering DC", () => {
  const character = conditioned([], 2);
  const stats = calculateCharacterStats(character);
  assert.equal(stats.initiative, 0);
  assert.equal(stats.speed, 20);
  assert.equal(stats.savingThrows.Strength, 2);
  assert.equal(stats.skillBonuses.Acrobatics, 0);
  assert.equal(deathSave({ ...character, currentHitPoints: 0 }, 13).combat.deathFailures, 1);
  assert.equal(deathSave({ ...character, currentHitPoints: 0 }, 20).currentHitPoints, 1);
  assert.equal(restCharacter(character, "Long Rest").combat.exhaustion, 1);
  assert.equal(setExhaustion(character, 6).combat.dead, true);
});
test("conditions derive incapacitation, zero movement, automatic saves, and concentration loss", () => {
  const character = conditioned(["Paralyzed"]);
  assert.equal(calculateCharacterStats(character).speed, 0);
  assert.ok(activeConditions(character).includes("Incapacitated"));
  assert.ok(automaticSaveFailure(character, "Strength"));
  assert.equal(automaticSaveFailure(character, "Constitution"), false);
  assert.equal(setCondition(hero({ combat: { ...defaultCombatState(), concentration: "Bless" } }), "Stunned", true).combat.concentration, "");
  assert.deepEqual(castCharacterSpell({ ...character, spells: [{ id: "x", prepared: true, level: 0 }] }, "x"), {});
  assert.ok(activeConditions(hero({ currentHitPoints: 0 })).includes("Unconscious"));
});
test("condition advantage/disadvantage cancels rather than stacking; poison does not affect saves", () => {
  const poisoned = conditioned(["Poisoned"]);
  assert.equal(effectiveRollMode(poisoned, "attack", "advantage"), "normal");
  assert.equal(effectiveRollMode(poisoned, "check", "normal"), "disadvantage");
  assert.equal(effectiveRollMode(poisoned, "save", "normal", "Constitution"), "normal");
  assert.equal(effectiveRollMode(conditioned(["Restrained"]), "save", "normal", "Dexterity"), "disadvantage");
  assert.equal(effectiveRollMode(conditioned(["Invisible"]), "initiative", "normal"), "advantage");
});
test("damage defense handles resistance, vulnerability, immunity and Petrified without double resistance", () => {
  assert.equal(adjustedDamage(hero(), 9, "resistant"), 4);
  assert.equal(adjustedDamage(hero(), 9, "vulnerable"), 18);
  assert.equal(adjustedDamage(hero(), 9, "immune"), 0);
  assert.equal(adjustedDamage(conditioned(["Petrified"]), 9, "resistant"), 4);
  // 2024 order of application: Resistance halves (round down) first, then Vulnerability doubles: 9 → 4 → 8.
  assert.equal(adjustedDamage(conditioned(["Petrified"]), 9, "vulnerable"), 8);
});
test("weapon presets choose finesse and ranged abilities; proficiency and exhaustion affect attacks", () => {
  const character = hero();
  const dagger = makeWeaponAttack(character, "Dagger", "dagger");
  assert.equal(dagger.ability, "Dexterity");
  assert.equal(attackNumbers(character, dagger).toHit, 7);
  assert.equal(attackNumbers(character, { ...dagger, proficient: false }).toHit, 4);
  assert.equal(makeWeaponAttack(character, "Greatsword", "sword").ability, "Strength");
  assert.equal(attackNumbers(conditioned([], 2), dagger).toHit, 3);
});
test("natural attack 1 misses and natural 20 crits regardless of target AC", () => {
  const character = hero(); const attack = makeWeaponAttack(character, "Longsword", "sword");
  assert.equal(rollWeaponAttack(character, attack, "normal", 0, false, false, () => 1).hit, false);
  assert.equal(rollWeaponAttack(character, attack, "normal", 99, false, false, () => 20).critical, true);
  assert.equal(rollWeaponAttack(character, attack, "normal", 17, false, false, () => 11).hit, true);
});
test("critical damage doubles weapon and Sneak Attack dice, but adds modifiers once", () => {
  const character = hero({ characterClass: "Rogue", classLevels: { Rogue: 5 } });
  const attack = makeWeaponAttack(character, "Dagger", "dagger");
  const result = rollWeaponDamage(character, attack, true, true, false, () => 1);
  assert.equal(result.rolls.length, 2);
  assert.equal(result.sneak.length, 6);
  assert.equal(result.bonus, 4);
  assert.equal(result.total, 12);
});
test("effects update AC, Tough HP, Alert initiative and attack/save dice; timers expire explicitly", () => {
  const character = hero({ combat: { ...defaultCombatState(), effects: [makeEffect("Shield", "shield"), makeEffect("Tough feat", "tough"), makeEffect("Alert feat", "alert"), makeEffect("Bless", "bless")] } });
  const stats = calculateCharacterStats(character);
  assert.equal(stats.armorClass, 19);
  assert.equal(stats.maxHitPoints, 54);
  assert.equal(stats.initiative, 7);
  assert.deepEqual(effectDice(character, "save", () => 3), { rolls: [3], total: 3 });
  assert.equal(advanceEffects(character).some((effect) => effect.name === "Shield"), false);
  assert.equal(advanceEffects(character).find((effect) => effect.name === "Bless").rounds, 9);
  const attack = makeWeaponAttack(character, "Dagger", "dagger");
  assert.equal(rollWeaponAttack(character, attack, "normal", 20, false, false, (sides) => sides === 20 ? 10 : 3).total, 20);
});
test("2024 healing spells scale per slot and apply the selected class ability, spending one slot", () => {
  const character = hero({ characterClass: "Cleric", classLevels: { Cleric: 3 }, currentHitPoints: 1, spells: [{ id: "cure", name: "Cure Wounds", level: 1, prepared: true, concentration: false, automation: "Cure Wounds" }] });
  const result = resolveSpellCast(character, "cure", "spell-slot:Spellcasting · Long Rest:2", "Cleric", true, () => 1);
  assert.equal(result.updates.currentHitPoints, 8);
  assert.equal(result.updates.resourceUses["spell-slot:Spellcasting · Long Rest:2"], 1);
  assert.match(result.summary, /4d8/);
  assert.throws(() => resolveSpellCast(character, "cure", undefined, "Cleric", true), /slot/);
});
test("cantrip damage scales with total multiclass level", () => {
  const character = hero({ characterClass: "Wizard", classLevels: { Wizard: 1, Fighter: 10 }, spells: [{ id: "fire", name: "Fire Bolt", level: 0, prepared: true, concentration: false, automation: "Fire Bolt" }] });
  const result = resolveSpellCast(character, "fire", undefined, "Wizard", false, () => 5);
  assert.match(result.summary, /3d10/);
  assert.equal(result.updates.resourceUses, undefined);
});
test("spell attack automation handles critical hits and misses without adding ability damage", () => {
  const character = hero({ characterClass: "Wizard", classLevels: { Wizard: 1 }, spells: [{ id: "fire", name: "Fire Bolt", level: 0, prepared: true, concentration: false, automation: "Fire Bolt" }] });
  const critical = resolveSpellCast(character, "fire", undefined, "Wizard", false, (sides) => sides === 20 ? 20 : 2);
  assert.match(critical.summary, /critical/);
  assert.match(critical.summary, /2d10/);
  assert.match(critical.summary, /= 4 Fire damage/);
  const miss = resolveSpellCast(character, "fire", undefined, "Wizard", false, () => 1);
  assert.match(miss.summary, /miss/);
  assert.match(miss.summary, /= 0 Fire damage/);
});
test("same-named effects do not stack and rest expires finite-duration effects", () => {
  const character = hero({ combat: { ...defaultCombatState(), effects: [makeEffect("Shield", "one"), makeEffect("Shield", "two"), makeEffect("Bless", "bless"), makeEffect("Tough feat", "tough")] } });
  assert.equal(calculateCharacterStats(character).armorClass, 19);
  assert.deepEqual(restCharacter(character, "Short Rest").combat.effects.map((effect) => effect.name), ["Tough feat"]);
});
test("Second Wind heals and spends a use atomically; Lay on Hands cannot overspend", () => {
  const character = hero({ currentHitPoints: 1 });
  const result = useHealingFeature(character, "second-wind", 1, () => 4);
  assert.equal(result.updates.currentHitPoints, 10);
  assert.equal(result.updates.resourceUses["fighter.second-wind"], 1);
  const paladin = hero({ characterClass: "Paladin", classLevels: { Paladin: 1 } });
  assert.throws(() => useHealingFeature(paladin, "lay-on-hands", 6), /uses/);
});
test("attack and effect data survives imports; malformed attack formulas are dropped", () => {
  const character = hero();
  character.attacks = [makeWeaponAttack(character, "Dagger", "a"), { name: "invalid", diceCount: 99999 }];
  character.combat.effects = [makeEffect("Bless", "b")];
  const imported = normalizeCharacter(JSON.parse(JSON.stringify(character)));
  assert.equal(imported.attacks.length, 1);
  assert.equal(imported.combat.effects[0].attackDie, 4);
});
test("initiative preserves active turns through sorting and removing combatants; wraps rounds", () => {
  let encounter = emptyEncounter();
  encounter = changeEncounter(encounter, { type: "add", name: "Slow", initiative: 5 }, [], "slow");
  encounter = changeEncounter(encounter, { type: "add", name: "Fast", initiative: 20 }, [], "fast");
  encounter = changeEncounter(encounter, { type: "start" }, [], "");
  assert.equal(encounter.activeId, "fast");
  encounter = changeEncounter(encounter, { type: "update", id: "slow", initiative: 21, tieOrder: 0 }, [], "");
  assert.equal(encounter.activeId, "fast");
  encounter = changeEncounter(encounter, { type: "next" }, [], "");
  assert.equal(encounter.activeId, "slow");
  assert.equal(encounter.round, 2);
  encounter = changeEncounter(encounter, { type: "remove", id: "slow" }, [], "");
  assert.equal(encounter.activeId, "fast");
  encounter = changeEncounter(encounter, { type: "remove", id: "fast" }, [], "");
  assert.equal(encounter.activeId, null);
  assert.equal(encounter.round, 0);
});
test("initiative rejects invalid input and references to private characters", () => {
  assert.throws(() => changeEncounter(emptyEncounter(), { type: "start" }, [], ""), /Add combatants/);
  assert.throws(() => changeEncounter(emptyEncounter(), { type: "add", characterId: "private", initiative: 5 }, [], ""), /shared/);
  assert.throws(() => changeEncounter(emptyEncounter(), { type: "add", name: "Bad", initiative: null }, [], ""), /initiative/);
});
