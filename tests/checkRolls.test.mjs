import test from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats } from "../src/data/characters.ts";
import { automaticCheckFailure, checkBonus, resolveCheckRoll } from "../src/data/checkRolls.ts";

const hero = (overrides = {}) => ({ ...defaultCharacterStats(), id: "roller", name: "Roller", concept: "", species: "Human", characterClass: "Wizard", background: "", level: 1, classLevels: { Wizard: 1 },
  abilityScores: { Strength: 8, Dexterity: 14, Constitution: 12, Intelligence: 17, Wisdom: 13, Charisma: 10 }, createdAt: "2026-11-20", updatedAt: "2026-11-20", ...overrides });
const dice = (...faces) => () => faces.shift();

test("check bonuses cover initiative, saves, skills and plain ability checks", () => {
  const character = { ...hero(), skillProficiencies: { ...hero().skillProficiencies, Arcana: 1 } };
  assert.equal(checkBonus(character, "Initiative"), 2);
  assert.equal(checkBonus(character, "Save: Intelligence"), 5, "Wizards are proficient in Intelligence saves");
  assert.equal(checkBonus(character, "Arcana"), 5);
  assert.equal(checkBonus(character, "Strength check"), -1);
  assert.equal(checkBonus({ ...character, combat: { conditions: [], effects: [], exhaustion: 2 } }, "Strength check"), -5, "exhaustion applies to raw ability checks");
});

test("rolls report every die with advantage and apply the bonus once", () => {
  assert.equal(resolveCheckRoll(hero(), "Strength check", "normal", dice(11)), "Strength check: 11 − 1 = 10");
  assert.equal(resolveCheckRoll(hero(), "Save: Intelligence", "advantage", dice(4, 15)), "Save: Intelligence: 4, 15 → 15 + 5 = 20");
  assert.equal(resolveCheckRoll(hero(), "Perception", "disadvantage", dice(18, 3)), "Perception: 18, 3 → 3 + 1 = 4");
});

test("conditions that fail Strength and Dexterity saves need no roll", () => {
  const stunned = hero({ combat: { conditions: ["Stunned"], effects: [] } });
  assert.equal(automaticCheckFailure(stunned, "Save: Dexterity"), true);
  assert.equal(automaticCheckFailure(stunned, "Save: Wisdom"), false);
  assert.equal(automaticCheckFailure(stunned, "Dexterity check"), false);
});
