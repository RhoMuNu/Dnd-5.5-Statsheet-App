import { test } from "node:test";
import assert from "node:assert/strict";
import { physicalDice, PhysicalDiceRequired } from "../src/data/physicalDice.ts";
import { defaultCharacterStats, defaultCombatState } from "../src/data/characters.ts";
import { rollD20, deathSave, spendHitDie } from "../src/data/gameplay.ts";
import { makeEffect, effectDice } from "../src/data/effects.ts";
import { makeWeaponAttack, rollWeaponAttack, rollWeaponDamage } from "../src/data/attacks.ts";
import { freshTurn } from "../src/data/economy.ts";
import { useHealingFeature } from "../src/data/featureActions.ts";

function hero(extra = {}) { return { ...defaultCharacterStats(), id: "hero", name: "Hero", concept: "", species: "Human", characterClass: "Fighter", classLevels: { Fighter: 5 }, level: 5, background: "", abilityScores: { Strength: 16, Dexterity: 14, Constitution: 14, Intelligence: 14, Wisdom: 14, Charisma: 14 }, createdAt: "today", updatedAt: "today", combat: { ...defaultCombatState(), turn: freshTurn() }, ...extra }; }
function enter(operation, values) {
  const faces = [];
  for (;;) {
    const dice = physicalDice(faces);
    try { const result = operation(dice.roll); dice.finish(); assert.equal(values.length, 0); return result; }
    catch (reason) {
      if (!(reason instanceof PhysicalDiceRequired)) throw reason;
      assert.ok(values.length, `Missing physical face for ${reason.request.label}`);
      faces.push({ ...reason.request, value: values.shift() });
    }
  }
}
test("physical dice never fall back to random values and reject invalid faces or changed dice requirements", () => {
  assert.throws(() => physicalDice([]).roll(20, "Attack"), (error) => error instanceof PhysicalDiceRequired && error.request.sides === 20 && error.request.index === 0);
  for (const value of [0, 21, 3.5, NaN, "10"]) assert.throws(() => physicalDice([{ sides: 20, label: "Attack", value }]).roll(20, "Attack"), /whole number/);
  assert.throws(() => physicalDice([{ sides: 6, label: "Damage", value: 5 }]).roll(20, "Attack"), /required dice changed/);
  const extra = physicalDice([{ sides: 6, label: "Damage", value: 5 }]); assert.throws(() => extra.finish(), /Extra physical/);
});
test("natural d20 faces handle advantage/disadvantage before modifiers and signed bonus dice", () => {
  const character = hero(); character.combat.effects = [makeEffect("Bane", "bane")];
  const result = enter((die) => { const d20 = rollD20(character, "save", "advantage", "Dexterity", false, false, die); const effect = effectDice(character, "save", die); return { d20, effect }; }, [4, 19, 3]);
  assert.equal(result.d20.natural, 19); assert.equal(result.effect.total, -3);
  const disadvantage = enter((die) => rollD20(hero(), "check", "disadvantage", "Athletics", false, false, die), [18, 2]);
  assert.equal(disadvantage.natural, 2);
});
test("manual natural criticals and critical damage use the same action and Sneak Attack math", () => {
  const character = hero(), attack = makeWeaponAttack(character, "Longsword", "sword"), before = structuredClone(character);
  const hit = enter((die) => rollWeaponAttack(character, attack, "normal", 100, false, false, die), [20]);
  assert.equal(hit.critical, true); assert.equal(hit.hit, true); assert.equal(hit.updates.combat.turn.actionUsed, true);
  const damage = enter((die) => rollWeaponDamage(character, attack, true, false, false, die), [2, 6]);
  assert.equal(damage.total, 11); assert.deepEqual(character, before);
});
test("physical healing and Hit Dice retain resource costs, Constitution, and natural death save outcomes", () => {
  const character = hero({ currentHitPoints: 10 });
  const wind = enter((die) => useHealingFeature(character, "second-wind", 1, die), [7]);
  assert.equal(wind.healing, 12); assert.equal(wind.updates.resourceUses["fighter.second-wind"], 1);
  const hitDie = enter((die) => spendHitDie(character, "Fighter", die(10, "Hit Die")), [6]);
  assert.equal(hitDie.currentHitPoints, 18); assert.equal(hitDie.combat.hitDiceUsed.Fighter, 1);
  const down = hero({ currentHitPoints: 0 });
  assert.equal(enter((die) => deathSave(down, die(20, "Death save")), [20]).currentHitPoints, 1);
  assert.equal(enter((die) => deathSave(down, die(20, "Death save")), [1]).combat.deathFailures, 2);
});
test("incomplete physical attacks leave the original sheet and resources untouched", () => {
  const character = hero(), before = structuredClone(character), attack = makeWeaponAttack(character, "Dagger", "dagger");
  assert.throws(() => rollWeaponAttack(character, attack, "normal", null, false, false, physicalDice([]).roll), PhysicalDiceRequired);
  assert.deepEqual(character, before);
});
