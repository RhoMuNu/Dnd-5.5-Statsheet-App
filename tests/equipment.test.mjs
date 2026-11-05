import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, normalizeCharacter } from "../src/data/characters.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";
import { armorForItem, equipInventoryItem, inventoryArmor } from "../src/data/equipment.ts";
import { effectiveRollMode } from "../src/data/conditions.ts";
import { castCharacterSpell } from "../src/data/gameplay.ts";
import { resolveSpellCast } from "../src/data/spellEffects.ts";

const item = (name, id = name) => ({ id, name, category: "Armor", quantity: 1, weight: 0, equipped: true, notes: "" });
function hero(items = [], overrides = {}) {
  return { ...defaultCharacterStats(), id: "hero", name: "Hero", concept: "", species: "Human", characterClass: "Fighter", classLevels: { Fighter: 5 }, level: 5, background: "", createdAt: "today", updatedAt: "today", armorSource: "inventory", inventory: { items, currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, startingKitsAdded: false }, abilityScores: { Strength: 12, Dexterity: 18, Constitution: 14, Intelligence: 12, Wisdom: 16, Charisma: 10 }, ...overrides };
}
test("equipped armor drives AC, magic shields and Strength movement penalties", () => {
  const character = hero([item("Chain Mail +1"), item("+2 Shield")]);
  assert.equal(calculateCharacterStats(character).armorClass, 21);
  assert.equal(calculateCharacterStats(character).speed, 20);
  assert.equal(calculateCharacterStats({ ...character, inventoryShieldTrained: false }).armorClass, 17);
  assert.equal(calculateCharacterStats(hero([item("Half Plate")])).armorClass, 17);
  assert.equal(calculateCharacterStats(hero([item("Leather")])).armorClass, 15);
  const negativeDex = hero([item("Chain Shirt")]); negativeDex.abilityScores.Dexterity = 8;
  assert.equal(calculateCharacterStats(negativeDex).armorClass, 12);
});
test("inventory automation is opt-in and old sheets preserve manual armor", () => {
  const old = hero([item("Plate")], { armorSource: undefined, armorMode: "custom", armorBaseAC: 14, hasShield: true });
  const normalized = normalizeCharacter(old);
  assert.equal(normalized.armorSource, "manual");
  assert.equal(calculateCharacterStats(normalized).armorClass, 16);
});
test("equipping a replacement swaps suits independently of shields; zero quantity grants no bonus", () => {
  const items = [item("Leather"), { ...item("Plate"), equipped: false }, item("Shield")];
  const swapped = equipInventoryItem(items, "Plate", { equipped: true });
  assert.deepEqual(swapped.map((entry) => entry.equipped), [false, true, true]);
  const empty = swapped.map((entry) => ({ ...entry, quantity: 0 }));
  assert.equal(calculateCharacterStats(hero(empty)).armorClass, 14);
  assert.equal(armorForItem(item("Plate of imaginary protection")), null);
  assert.equal(armorForItem(item("+1 Plate +2")), null);
});
test("Stealth and untrained armor disadvantage cancel advantage without affecting unrelated saves", () => {
  const character = hero([item("Scale Mail")]);
  assert.equal(effectiveRollMode(character, "check", "normal", "Stealth"), "disadvantage");
  assert.equal(effectiveRollMode(character, "check", "advantage", "Stealth"), "normal");
  const untrained = { ...character, inventoryArmorTrained: false };
  for (const [kind, ability] of [["check", "Athletics"], ["save", "Dexterity"], ["attack", "Strength"], ["initiative", ""]]) assert.equal(effectiveRollMode(untrained, kind, "normal", ability), "disadvantage");
  assert.equal(effectiveRollMode(untrained, "save", "normal", "Wisdom"), "normal");
  assert.equal(inventoryArmor(untrained).untrained, true);
});
test("untrained worn armor prevents cantrips without spending resources", () => {
  const character = hero([item("Plate")], { inventoryArmorTrained: false, spells: [{ id: "bolt", name: "Fire Bolt", level: 0, prepared: true }] });
  assert.deepEqual(castCharacterSpell(character, "bolt"), {});
  assert.throws(() => resolveSpellCast(character, "bolt", undefined, "Wizard", false), /without training/);
});
test("wielding an untrained shield still disables Monk unarmored benefits", () => {
  const monk = hero([item("Shield")], { characterClass: "Monk", classLevels: { Monk: 5 }, inventoryShieldTrained: false });
  assert.equal(calculateCharacterStats(monk).armorClass, 14);
  assert.equal(calculateCharacterStats(monk).speed, 30);
  const unarmored = { ...monk, inventory: { ...monk.inventory, items: [] } };
  assert.equal(calculateCharacterStats(unarmored).armorClass, 17);
  assert.equal(calculateCharacterStats(unarmored).speed, 40);
});
