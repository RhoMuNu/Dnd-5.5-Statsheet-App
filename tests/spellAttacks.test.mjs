import test from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, defaultCombatState } from "../src/data/characters.ts";
import { SPELL_CATALOG, spellFromCatalog } from "../src/data/rulesCatalog.ts";
import { resolveSpellCast } from "../src/data/spellEffects.ts";
import { rollSpellAttack } from "../src/data/spellAttacks.ts";
import { usesSpellAttackOnly, MANUAL_SPELL_EFFECTS } from "../src/data/spellAttackOptions.ts";
import { spellbookSlotRows } from "../src/data/spellbookSlots.ts";
import { makeEffect } from "../src/data/effects.ts";
import { spellSlotKey } from "../src/data/gameplay.ts";
import { physicalDice, PhysicalDiceRequired } from "../src/data/physicalDice.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";

const fromCatalog = (name, className = "Wizard") => spellFromCatalog(SPELL_CATALOG.find((spell) => spell.name === name).key, name, className);
const hero = (name = "Ray of Frost") => ({ ...defaultCharacterStats(), id: "spell-attacker", name: "Mage", species: "Human", background: "", characterClass: "Wizard", level: 5, classLevels: { Wizard: 5 }, abilityScores: { Strength: 10, Dexterity: 12, Constitution: 14, Intelligence: 18, Wisdom: 12, Charisma: 14 }, spells: [fromCatalog(name)], combat: defaultCombatState() });

test("attack spells outside damage formulas roll on casting; manual effects can explicitly opt out", () => {
  const character = hero(), before = structuredClone(character);
  assert.equal(usesSpellAttackOnly(character.spells[0]), true);
  const result = resolveSpellCast(character, "Ray of Frost", undefined, "Wizard", false, () => 15, "normal", 18);
  assert.equal(result.attack.total, 22);
  assert.match(result.summary, /hit/);
  assert.match(result.summary, /Resolve damage/);
  assert.equal(result.amount, 0);
  const manual = { ...character, spells: [{ ...character.spells[0], automation: MANUAL_SPELL_EFFECTS }] };
  assert.equal(resolveSpellCast(manual, "Ray of Frost", undefined, "Wizard", false, () => assert.fail("No dice for manual effects")).attack, null);
  assert.equal(usesSpellAttackOnly(fromCatalog("Mage Hand")), false);
  assert.deepEqual(character, before);
});
test("a leveled attack cast spends one slot/action; subsequent rays do not spend them again", () => {
  const character = hero("Scorching Ray");
  character.combat.turn = { enabled: true, key: "turn-1", active: true, actionUsed: false, bonusUsed: false, reactionUsed: false, attacksRemaining: 0, slotTurn: "", surgeUsed: false, surgeAction: false, sneakTurn: "" };
  const secondLevelSlot = calculateCharacterStats(character).spellSlots.find((entry) => entry.spellLevel === 2);
  const slot = spellSlotKey(secondLevelSlot.pool, 2);
  const result = resolveSpellCast(character, "Scorching Ray", slot, "Wizard", false, () => 12);
  const after = { ...character, ...result.updates };
  assert.equal(after.resourceUses[slot], 1);
  assert.equal(after.combat.turn.actionUsed, true);
  const saved = JSON.stringify(after);
  assert.equal(rollSpellAttack(after, "Scorching Ray", "Wizard", "normal", null, () => 13).total, 20);
  assert.equal(rollSpellAttack(after, "Scorching Ray", "Wizard", "normal", null, () => 14).total, 21);
  assert.equal(JSON.stringify(after), saved);
});
test("spell attack bonuses apply custom boosts, exhaustion, flat effects and Bless once", () => {
  const character = hero();
  character.customModifiers = [{ id: "focus", name: "Magic focus", target: "spellAttack", amount: 2, enabled: true }];
  character.combat.exhaustion = 1;
  character.combat.effects = [makeEffect("Bless", "bless"), { ...makeEffect("Custom modifier", "flat"), attack: 1 }];
  const result = rollSpellAttack(character, "Ray of Frost", "Wizard", "normal", null, (sides) => sides === 20 ? 12 : 3);
  assert.equal(result.bonus, 8);
  assert.equal(result.total, 23);
});
test("spell attacks handle advantage, natural 1/20, class ownership and physical dice", () => {
  const character = hero(); let faces = [4, 16];
  assert.equal(rollSpellAttack(character, "Ray of Frost", "Wizard", "advantage", null, () => faces.shift()).natural, 16);
  assert.equal(rollSpellAttack(character, "Ray of Frost", "Wizard", "normal", 0, () => 1).missed, true);
  assert.equal(rollSpellAttack(character, "Ray of Frost", "Wizard", "normal", 999, () => 20).critical, true);
  assert.throws(() => rollSpellAttack(character, "Ray of Frost", "Cleric"), /belongs to/);
  let requested;
  try { rollSpellAttack(character, "Ray of Frost", "Wizard", "normal", null, physicalDice([]).roll); }
  catch (error) { assert.ok(error instanceof PhysicalDiceRequired); requested = error.request; }
  assert.ok(requested);
  const physical = physicalDice([{ sides: requested.sides, label: requested.label, value: 17 }]);
  assert.equal(rollSpellAttack(character, "Ray of Frost", "Wizard", "normal", 20, physical.roll).total, 24);
  physical.finish();
});
test("multiclass spell bonuses stay distinct and slot summaries preserve level and pool", () => {
  const character = hero();
  character.classLevels = { Wizard: 3, Cleric: 2 };
  const stats = calculateCharacterStats(character);
  assert.equal(stats.spellcastingProgressions.find((entry) => entry.className === "Wizard").attackBonus, 7);
  assert.equal(stats.spellcastingProgressions.find((entry) => entry.className === "Cleric").saveDC, 12);
  const rows = spellbookSlotRows([{ spellLevel: 2, total: 2, pool: "Pact Magic" }, { spellLevel: 1, total: 4, pool: "Spellcasting" }, { spellLevel: 2, total: 3, pool: "Spellcasting" }], { [spellSlotKey("Pact Magic", 2)]: 2, [spellSlotKey("Spellcasting", 1)]: 1 });
  assert.deepEqual(rows.map((row) => [row.spellLevel, row.pool, row.remaining]), [[1, "Spellcasting", 3], [2, "Pact Magic", 0], [2, "Spellcasting", 3]]);
});
