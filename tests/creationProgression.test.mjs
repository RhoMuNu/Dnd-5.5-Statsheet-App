import test from "node:test";
import assert from "node:assert/strict";
import { CLASSES, defaultCharacterStats } from "../src/data/characters.ts";
import { creationProgression } from "../src/data/creationProgression.ts";
import { applyLevelUp, newLevelUpPlan } from "../src/data/advancement.ts";

test("creation always begins with a single level and no subclass, overriding any draft progression", () => {
  for (const name of CLASSES) {
    const draft = { characterClass: name, level: 12, classLevels: { [name]: 8, Rogue: 4 }, subclass: "Invalid starting subclass", classSubclasses: { Rogue: "Thief" } };
    const saved = { ...draft, ...creationProgression(name) };
    assert.equal(saved.level, 1);
    assert.deepEqual(saved.classLevels, { [name]: 1 });
    assert.equal(saved.subclass, "");
    assert.deepEqual(saved.classSubclasses, {});
  }
});

test("editing basics preserves existing multiclass levels and subclasses without mutating the original", () => {
  const existing = { ...defaultCharacterStats(), characterClass: "Fighter", level: 7, classLevels: { Fighter: 4, Rogue: 3 }, subclass: "Champion", classSubclasses: { Fighter: "Champion", Rogue: "Thief" } };
  const result = creationProgression("Wizard", existing);
  assert.equal(result.characterClass, "Fighter");
  assert.equal(result.level, 7);
  assert.deepEqual(result.classLevels, existing.classLevels);
  assert.deepEqual(result.classSubclasses, existing.classSubclasses);
  result.classLevels.Fighter = 1;
  result.classSubclasses.Fighter = "Changed";
  assert.equal(existing.classLevels.Fighter, 4);
  assert.equal(existing.classSubclasses.Fighter, "Champion");
  const legacy = creationProgression("Wizard", { ...existing, level: 5, classLevels: {}, classSubclasses: undefined });
  assert.deepEqual(legacy.classLevels, { Fighter: 5 });
  assert.deepEqual(legacy.classSubclasses, { Fighter: "Champion" });
});

test("a character created at one can still advance through the normal level-up workflow", () => {
  const character = { ...defaultCharacterStats(), ...creationProgression("Fighter"), id: "hero", name: "Hero", concept: "", species: "Human", background: "Soldier", createdAt: "today", updatedAt: "today" };
  const updates = applyLevelUp(character, newLevelUpPlan(character), "advance", "now");
  assert.equal(updates.level, 2);
  assert.deepEqual(updates.classLevels, { Fighter: 2 });
  assert.equal(character.level, 1);
});
