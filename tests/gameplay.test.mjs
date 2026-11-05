import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, normalizeCharacter } from "../src/data/characters.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";
import { applyDamage, castCharacterSpell, combatState, deathSave, healCharacter, restCharacter, spendHitDie, spellSlotKey } from "../src/data/gameplay.ts";

export function hero(overrides = {}) {
  return { ...defaultCharacterStats(), id: "hero-1", name: "Test hero", concept: "", species: "Human", characterClass: "Fighter", background: "", level: 3,
    classLevels: { Fighter: 3 }, createdAt: "2026-11-05T00:00:00.000Z", updatedAt: "2026-11-05T00:00:00.000Z", ...overrides };
}
const update = (character, patch) => ({ ...character, ...patch });

test("damage consumes temporary HP first and healing preserves the buffer", () => {
  let character = hero({ currentHitPoints: 15, temporaryHitPoints: 5 });
  character = update(character, applyDamage(character, 8));
  assert.equal(character.currentHitPoints, 12);
  assert.equal(character.temporaryHitPoints, 0);
  assert.equal(healCharacter(hero({ currentHitPoints: 12, temporaryHitPoints: 5 }), 100).currentHitPoints, 22);
  assert.equal(applyDamage(hero({ currentHitPoints: 15, temporaryHitPoints: 5 }), 3).temporaryHitPoints, 2);
});
test("death saves handle natural 1, natural 20, stabilization and damage at zero", () => {
  let character = hero({ currentHitPoints: 0 });
  character = update(character, deathSave(character, 1));
  assert.equal(character.combat.deathFailures, 2);
  assert.equal(deathSave(character, 20).currentHitPoints, 1);
  assert.equal(applyDamage(character, 1).combat.dead, true);
  character = hero({ currentHitPoints: 0 });
  for (let i = 0; i < 3; i++) character = update(character, deathSave(character, 10));
  assert.equal(character.combat.stable, true);
  assert.equal(character.combat.deathSuccesses, 0);
  const damaged = applyDamage(character, 1, true);
  assert.equal(damaged.combat.stable, false);
  assert.equal(damaged.combat.deathFailures, 2);
});
test("massive damage kills instantly and ordinary healing cannot revive the dead", () => {
  const character = update(hero({ currentHitPoints: 1 }), applyDamage(hero({ currentHitPoints: 1 }), 23));
  assert.equal(character.combat.dead, true);
  assert.deepEqual(healCharacter(character, 50), {});
  assert.deepEqual(restCharacter(character, "Long Rest"), {});
});
test("concentration checks include damage absorbed by temporary HP and cap DC at 30", () => {
  const character = hero({ currentHitPoints: 22, temporaryHitPoints: 100, combat: { ...combatState(hero()), concentration: "Bless" } });
  assert.equal(applyDamage(character, 25).combat.concentrationDC, 12);
  assert.equal(applyDamage(character, 80).combat.concentrationDC, 30);
  assert.equal(applyDamage({ ...character, temporaryHitPoints: 0 }, 22).combat.concentration, "");
});
test("short-rest Hit Dice use Constitution, spend once, and cannot heal at zero", () => {
  let character = hero({ currentHitPoints: 1, abilityScores: { ...hero().abilityScores, Constitution: 3 } });
  character = update(character, spendHitDie(character, "Fighter", 1));
  assert.equal(character.currentHitPoints, 2);
  assert.equal(character.combat.hitDiceUsed.Fighter, 1);
  for (let i = 0; i < 2; i++) character = update(character, spendHitDie(character, "Fighter", 1));
  assert.deepEqual(spendHitDie(character, "Fighter", 1), {});
  assert.deepEqual(spendHitDie(hero({ currentHitPoints: 0 }), "Fighter", 10), {});
});
test("2024 Long Rest restores every Hit Die and HP, clears temp HP, preserves manual trackers", () => {
  const character = hero({ currentHitPoints: 1, temporaryHitPoints: 4, combat: { ...combatState(hero()), hitDiceUsed: { Fighter: 3 } }, customResources: [
    { id: "m", name: "Manual", maxUses: 3, used: 2, recovery: "manual" },
    { id: "l", name: "Long", maxUses: 3, used: 2, recovery: "long" },
  ] });
  const rested = restCharacter(character, "Long Rest");
  assert.equal(rested.currentHitPoints, 22);
  assert.equal(rested.temporaryHitPoints, 0);
  assert.deepEqual(rested.combat.hitDiceUsed, {});
  assert.deepEqual(rested.customResources.map((r) => r.used), [2, 0]);
  assert.deepEqual(restCharacter(hero({ currentHitPoints: 0 }), "Short Rest"), {});
});
test("short rests restore Pact slots but leave Spellcasting slots spent", () => {
  const character = hero({ characterClass: "Warlock", classLevels: { Warlock: 2, Wizard: 1 }, resourceUses: {
    [spellSlotKey("Pact Magic · Short or Long Rest", 1)]: 2,
    [spellSlotKey("Spellcasting · Long Rest", 1)]: 1,
  } });
  const rested = restCharacter(character, "Short Rest");
  assert.equal(rested.resourceUses[spellSlotKey("Pact Magic · Short or Long Rest", 1)], 0);
  assert.equal(rested.resourceUses[spellSlotKey("Spellcasting · Long Rest", 1)], 1);
});
test("Paladin and Ranger use their own slot tables when there is only one Spellcasting class", () => {
  for (const name of ["Paladin", "Ranger"]) {
    for (const [level, slots] of [[2, [2]], [3, [3]], [4, [3]], [5, [4, 2]], [19, [4, 3, 3, 3, 2]]]) {
      const stats = calculateCharacterStats(hero({ characterClass: name, level, classLevels: { [name]: level } }));
      assert.deepEqual(stats.spellSlots.map((s) => s.total), slots);
    }
  }
  assert.deepEqual(calculateCharacterStats(hero({ characterClass: "Paladin", classLevels: { Paladin: 3, Fighter: 1 } })).spellSlots.map((s) => s.total), [3]);
  assert.deepEqual(calculateCharacterStats(hero({ characterClass: "Paladin", classLevels: { Paladin: 3, Wizard: 1 } })).spellSlots.map((s) => s.total), [4, 2]);
});
test("prepared spell counts come from 2024 class tables rather than ability modifiers", () => {
  for (const [name, expected] of [["Cleric", 4], ["Druid", 4], ["Wizard", 4], ["Paladin", 2], ["Ranger", 2]]) {
    assert.equal(calculateCharacterStats(hero({ characterClass: name, classLevels: { [name]: 1 } })).preparedSpellCount, expected);
  }
});
test("casting supports upcasting, distinct Pact pools, concentration replacement, and cantrips", () => {
  const character = hero({ characterClass: "Wizard", classLevels: { Wizard: 3, Warlock: 2 }, spells: [
    { id: "bless", name: "Bless", level: 1, prepared: true, concentration: true },
    { id: "light", name: "Light", level: 0, prepared: true, concentration: false },
  ] });
  const key = spellSlotKey("Spellcasting · Long Rest", 2);
  assert.equal(castCharacterSpell(character, "bless", key).resourceUses[key], 1);
  assert.equal(castCharacterSpell(character, "bless", key).combat.concentration, "Bless");
  assert.deepEqual(castCharacterSpell(character, "light"), {});
  assert.deepEqual(castCharacterSpell({ ...character, resourceUses: { [key]: 2 } }, "bless", key), {});
  assert.deepEqual(castCharacterSpell({ ...character, currentHitPoints: 0 }, "bless", key), {});
});
test("old sheets migrate combat state and invalid combat values are normalized", () => {
  assert.deepEqual(normalizeCharacter(hero()).combat, combatState(hero()));
  const state = normalizeCharacter(hero({ combat: { deathFailures: 99, hitDiceUsed: { Fighter: -1 }, concentrationDC: 100 } })).combat;
  assert.equal(state.deathFailures, 3);
  assert.equal(state.hitDiceUsed.Fighter, 0);
  assert.equal(state.concentrationDC, 30);
});

test("Fighter resources unlock at their class levels and Eldritch Knight uses its own slots", () => {
  assert.equal(calculateCharacterStats(hero({ classLevels: { Fighter: 1 } })).classResources.some((r) => r.key === "fighter.action-surge"), false);
  assert.equal(calculateCharacterStats(hero({ classLevels: { Fighter: 2 } })).classResources.some((r) => r.key === "fighter.action-surge"), true);
  assert.deepEqual(calculateCharacterStats(hero({ classLevels: { Fighter: 4 }, subclass: "Eldritch Knight" })).spellSlots.map((s) => s.total), [3]);
});
