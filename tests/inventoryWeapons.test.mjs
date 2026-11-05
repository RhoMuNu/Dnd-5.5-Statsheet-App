import test from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, normalizeCharacter } from "../src/data/characters.ts";
import { characterAttacks, removeCharacterAttack, weaponForItem } from "../src/data/inventoryWeapons.ts";
import { makeWeaponAttack, attackNumbers, WEAPON_PRESETS } from "../src/data/attacks.ts";

const item = (name, id = name, patch = {}) => ({ id, name, category: "Weapon", equipped: true, quantity: 1, weight: 0, notes: "", ...patch });
function hero(items = []) { return { ...defaultCharacterStats(), id: "hero", name: "Hero", concept: "", species: "Human", background: "Soldier", characterClass: "Fighter", classLevels: { Fighter: 3 }, level: 3, createdAt: "today", updatedAt: "today", inventory: { ...defaultCharacterStats().inventory, items }, abilityScores: { Strength: 16, Dexterity: 14, Constitution: 14, Intelligence: 10, Wisdom: 12, Charisma: 10 } }; }

test("equipped inventory weapons generate stable attacks with magic bonuses; armor and empty/unequipped items do not", () => {
  const character = hero([item("lOnGsWoRd +2"), item("+1 Dagger"), item("Shield"), item("Longbow", "empty", { quantity: 0 }), item("Greatsword", "bag", { equipped: false })]);
  const attacks = characterAttacks(character);
  assert.equal(attacks.length, 2);
  assert.equal(attacks[0].ability, "Strength");
  assert.equal(attackNumbers(character, attacks[0]).toHit, 7);
  assert.equal(attackNumbers(character, attacks[0]).damageBonus, 5);
  assert.deepEqual(characterAttacks(character), attacks);
  assert.equal(character.attacks, undefined);
  assert.equal(weaponForItem(item("+1 Dagger +2")), null);
  assert.equal(weaponForItem(item("Sword of Mystery")), null);
  assert.equal(weaponForItem(item("Daggers")).name, "Dagger");
  assert.equal(weaponForItem(item("Arcane Focus (Quarterstaff)")).name, "Quarterstaff");
});

test("linked attack edits survive normalization and toggling equipment without duplicating custom attacks", () => {
  const character = hero([item("Rapier", "rapier")]);
  const custom = makeWeaponAttack(character, "Rapier", "custom-attack");
  const linked = { ...characterAttacks(character)[0], dieSize: 10, proficient: false, notes: "House rule" };
  const edited = normalizeCharacter({ ...character, attacks: [linked, custom] });
  assert.equal(characterAttacks(edited).length, 2);
  assert.equal(characterAttacks(edited)[0].dieSize, 10);
  const unequipped = { ...edited, inventory: { ...edited.inventory, items: edited.inventory.items.map((entry) => ({ ...entry, equipped: false })) } };
  assert.deepEqual(characterAttacks(unequipped), [custom]);
  const reequipped = { ...unequipped, inventory: character.inventory };
  assert.equal(characterAttacks(reequipped)[0].notes, "House rule");
  const removed = { ...edited, ...removeCharacterAttack(edited, linked.id) };
  assert.equal(removed.inventory.items[0].equipped, false);
  assert.deepEqual(characterAttacks(removed), [custom]);
});

test("changing or deleting an equipped weapon updates its linked profile; all standard presets are recognized", () => {
  const character = hero([item("Dagger", "weapon")]);
  character.attacks = characterAttacks(character);
  const updated = { ...character, inventory: { ...character.inventory, items: [item("Greatsword +1", "weapon")] } };
  const attack = characterAttacks(updated)[0];
  assert.equal(attack.name, "Greatsword +1");
  assert.equal(attack.diceCount, 2);
  assert.equal(attack.attackBonus, 1);
  assert.deepEqual(characterAttacks({ ...character, inventory: { ...character.inventory, items: [] } }), []);
  for (const preset of WEAPON_PRESETS.filter((entry) => entry.name !== "Unarmed Strike")) assert.ok(weaponForItem(item(preset.name)), preset.name);
  assert.equal(characterAttacks(hero([item("Blowgun +1")]))[0].damageBonus, 2);
  const dart = characterAttacks(hero([item("Dart")]))[0];
  assert.equal(dart.ability, "Strength");
  assert.equal(dart.ranged, true);
});
