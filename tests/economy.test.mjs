import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, defaultCombatState, normalizeCharacter } from "../src/data/characters.ts";
import { freshTurn, spendTurn, spellTurnCost, useActionSurge } from "../src/data/economy.ts";
import { makeWeaponAttack, rollWeaponAttack, rollWeaponDamage } from "../src/data/attacks.ts";
import { castCharacterSpell } from "../src/data/gameplay.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";
import { useHealingFeature } from "../src/data/featureActions.ts";
import { effectiveRollMode } from "../src/data/conditions.ts";

function hero(extra = {}) { return { ...defaultCharacterStats(), id: "hero", name: "Hero", concept: "", species: "Human", characterClass: "Fighter", classLevels: { Fighter: 5 }, level: 5, background: "", createdAt: "today", updatedAt: "today", combat: { ...defaultCombatState(), turn: freshTurn() }, ...extra }; }
test("Attack consumes an action, Extra Attack grants its remaining swings, and a third attack is rejected", () => {
  let character = hero(); const weapon = makeWeaponAttack(character, "Longsword", "sword");
  character = { ...character, ...rollWeaponAttack(character, weapon, "normal", null, false, false, () => 10).updates };
  assert.equal(character.combat.turn.attacksRemaining, 1);
  character = { ...character, ...rollWeaponAttack(character, weapon, "normal", null, false, false, () => 10).updates };
  assert.equal(character.combat.turn.attacksRemaining, 0);
  assert.throws(() => rollWeaponAttack(character, weapon, "normal", null), /already spent/);
  assert.equal(normalizeCharacter(character).combat.turn.actionUsed, true);
});
test("Bonus Actions and Reactions are independent; reactions are allowed off-turn but cannot repeat", () => {
  let character = hero(); character = { ...character, ...spendTurn(character, "bonus") };
  assert.throws(() => useHealingFeature(character, "second-wind"), /Bonus Action/);
  character.combat.turn.active = false;
  assert.throws(() => spendTurn(character, "action"), /Wait for your turn/);
  character = { ...character, ...spendTurn(character, "reaction") };
  assert.throws(() => spendTurn(character, "reaction"), /Reaction is already spent/);
});
test("one slot per global turn blocks bonus/action/reaction combinations, while a cantrip remains legal", () => {
  let character = hero(); character = { ...character, ...spellTurnCost(character, "bonus action", true) };
  assert.throws(() => spellTurnCost(character, "action", true), /one spell slot/);
  assert.doesNotThrow(() => spellTurnCost(character, "action", false));
  character.combat.turn.active = false; character.combat.turn.key = "someone-else";
  assert.doesNotThrow(() => spellTurnCost(character, "reaction", true));
});
test("Action Surge spends its resource once, permits extra attacks and never permits another Magic action", () => {
  let character = hero(); character = { ...character, ...spendTurn(character, "magic") };
  character = { ...character, ...useActionSurge(character) };
  assert.equal(character.resourceUses["fighter.action-surge"], 1);
  assert.throws(() => spellTurnCost(character, "action", false), /cannot grant a Magic action/);
  assert.doesNotThrow(() => spendTurn(character, "attack"));
  assert.throws(() => useActionSurge(character), /not available/);
});
test("failed spell casts spend no actions, and concentration does not overwrite a spell’s action cost", () => {
  const character = hero({ characterClass: "Cleric", classLevels: { Cleric: 3 }, spells: [{ id: "bless", name: "Bless", level: 1, castingTime: "action", prepared: true, concentration: true }] });
  assert.deepEqual(castCharacterSpell(character, "bless", "invalid"), {});
  const stats = calculateCharacterStats(character), slot = stats.spellSlots[0], key = `spell-slot:${slot.pool}:1`;
  const next = { ...character, ...castCharacterSpell(character, "bless", key) };
  assert.equal(next.combat.turn.actionUsed, true);
  assert.equal(next.combat.concentration, "Bless"); assert.ok(next.combat.concentrationId);
});
test("Champion critical ranges and Remarkable Athlete use Fighter levels", () => {
  const champion = hero({ subclass: "Champion", classSubclasses: { Fighter: "Champion" } }), weapon = makeWeaponAttack(champion, "Longsword", "sword");
  assert.equal(rollWeaponAttack(champion, weapon, "normal", 100, false, false, () => 19).critical, true);
  assert.equal(effectiveRollMode(champion, "initiative", "normal"), "advantage");
  assert.equal(effectiveRollMode(champion, "check", "normal", "Athletics"), "advantage");
});
test("Sneak Attack cannot be applied twice in one tracked turn", () => {
  let rogue = hero({ characterClass: "Rogue", classLevels: { Rogue: 5 } });
  const weapon = makeWeaponAttack(rogue, "Dagger", "dagger");
  rogue = { ...rogue, ...rollWeaponDamage(rogue, weapon, false, true, false, () => 3).updates };
  assert.throws(() => rollWeaponDamage(rogue, weapon, false, true), /already been used/);
});

test("Reaction attacks are available off-turn and spend the Reaction, not the Attack action", () => {
  let character = hero(); character.combat.turn.active = false;
  const weapon = makeWeaponAttack(character, "Longsword", "opportunity");
  const result = rollWeaponAttack(character, weapon, "normal", null, false, false, () => 10, "reaction");
  assert.equal(result.updates.combat.turn.reactionUsed, true);
  assert.equal(result.updates.combat.turn.actionUsed, false);
});
test("Action Surge attacks may be taken before the normal Magic action", () => {
  let character = hero(); character = { ...character, ...useActionSurge(character) };
  character = { ...character, ...spendTurn(character, "attack") };
  assert.equal(character.combat.turn.actionUsed, false);
  assert.equal(character.combat.turn.surgeAction, false);
  assert.doesNotThrow(() => spellTurnCost(character, "action", false));
});
