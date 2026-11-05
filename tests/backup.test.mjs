import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterBackup, parseCharacterBackup } from "../src/data/backup.ts";
import { defaultCharacterStats } from "../src/data/characters.ts";

const hero = () => ({ ...defaultCharacterStats(), id: "backup-hero", name: "Backup hero", concept: "", species: "Human", characterClass: "Fighter", classLevels: { Fighter: 1 }, background: "Soldier", level: 1, createdAt: "2026-11-05", updatedAt: "2026-11-05" });
test("character backups round-trip homebrew modifiers, feature descriptions, inventory and journal without losing the active hero", () => {
  const character = hero();
  character.customModifiers = [{ id: "ring", name: "Guardian ring", target: "ac", amount: 2, enabled: true }];
  character.features = [{ id: "homebrew", name: "A friend’s blessing", category: "other", description: "Once per rest, regain 2 HP." }];
  character.notes = { backstory: "A long story", entries: [{ id: "entry", title: "First session", createdAt: "2026-11-05", updatedAt: "2026-11-05", body: "We arrived." }] };
  character.inventory.items = [{ id: "sword", name: "Longsword +1", quantity: 1, weight: 3, category: "Weapons", equipped: true, notes: "A gift" }];
  character.inventory.currency.gp = 42;
  const original = createCharacterBackup([character], character.id);
  const parsed = parseCharacterBackup(original);
  assert.equal(parsed.activeCharacterId, character.id);
  assert.deepEqual(parsed.characters[0].customModifiers, character.customModifiers);
  assert.deepEqual(parsed.characters[0].features, character.features);
  assert.deepEqual(parsed.characters[0].notes, character.notes);
  assert.deepEqual(parsed.characters[0].inventory, character.inventory);
});
test("import rejects corrupt progression before it can crash a level-dependent sheet", () => {
  for (const patch of [{ level: 1000000000 }, { level: 1.5 }, { classLevels: { Fighter: 1000000000 } }, { classLevels: { Fighter: "1" } }, { classLevels: { Fighter: 2 } }, { classSubclasses: { Fighter: 123 } }]) {
    assert.throws(() => parseCharacterBackup(createCharacterBackup([{ ...hero(), ...patch }], null)), /could not be read/);
  }
  assert.throws(() => parseCharacterBackup('{"format":"unsupported","characters":[]}'), /not supported/);
});
