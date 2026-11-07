import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, normalizeCharacter } from "../src/data/characters.ts";
import { applyLevelUp, eligibleFeats, levelUpErrors, newLevelUpPlan, spellLimits, levelChoices } from "../src/data/advancement.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";
import { SPELL_CATALOG } from "../src/data/rulesCatalog.ts";

function hero(level = 1, extra = {}) { return { ...defaultCharacterStats(), id: "hero", name: "Hero", concept: "", species: "Human", characterClass: "Fighter", classLevels: { Fighter: level }, level, background: "", createdAt: "today", updatedAt: "today", abilityScores: { Strength: 16, Dexterity: 14, Constitution: 14, Intelligence: 14, Wisdom: 14, Charisma: 14 }, ...extra }; }
function pickSpells(character, plan) {
  const limits = spellLimits(character, plan);
  plan.spellKeys = [
    ...SPELL_CATALOG.filter((spell) => spell.classes.includes(plan.className) && spell.level === 0).slice(0, limits.cantrips),
    ...SPELL_CATALOG.filter((spell) => spell.classes.includes(plan.className) && spell.level > 0 && spell.level <= limits.maxLevel).slice(0, limits.requiredSpells),
  ].map((spell) => spell.key);
  return plan;
}
test("one-click advancement adds one level, resource maxima and features without resting or mutating the original", () => {
  const character = hero(1, { currentHitPoints: 8, resourceUses: { "fighter.second-wind": 1 } });
  const before = structuredClone(character), plan = newLevelUpPlan(character);
  const result = { ...character, ...applyLevelUp(character, plan, "level-2", "now") };
  assert.equal(result.level, 2); assert.equal(result.classLevels.Fighter, 2);
  assert.equal(result.resourceUses["fighter.second-wind"], 1);
  assert.equal(result.currentHitPoints, 16);
  assert.ok(result.features.some((feature) => feature.name === "Action Surge"));
  assert.equal(result.advancement.length, 1); assert.deepEqual(character, before);
});
test("subclass selection is required at class level 3, rejects mismatched choices and records its actual features", () => {
  const character = hero(2), plan = newLevelUpPlan(character);
  assert.ok(levelUpErrors(character, plan).includes("Choose a subclass."));
  plan.subclass = "Life Domain"; assert.ok(levelUpErrors(character, plan).some((message) => message.includes("available subclass")));
  plan.subclass = "Champion";
  const result = { ...character, ...applyLevelUp(character, plan, "level-3", "now") };
  assert.equal(result.subclass, "Champion");
  assert.ok(result.features.some((feature) => feature.name === "Improved Critical"));
  assert.ok(!result.features.some((feature) => feature.description === "[Column data]"));
});
test("ASI validates allocations and caps, and Constitution changes HP retroactively while preserving damage", () => {
  const character = hero(3, { subclass: "Champion", classSubclasses: { Fighter: "Champion" }, currentHitPoints: 22 });
  const plan = newLevelUpPlan(character); plan.boosts = { Constitution: 2 }; plan.choices["Fighter:mastery:4"] = ["Longsword"];
  const result = { ...character, ...applyLevelUp(character, plan, "level-4", "now") };
  assert.equal(result.abilityScores.Constitution, 16);
  assert.equal(calculateCharacterStats(result).maxHitPoints, 40);
  assert.equal(result.currentHitPoints, 34);
  plan.boosts = { Strength: 3 }; assert.ok(levelUpErrors(character, plan).length);
  plan.boosts = { Strength: 2 }; plan.choices["Fighter:mastery:4"] = ["Longsword"]; character.abilityScores.Strength = 20;
  assert.ok(levelUpErrors(character, plan).some((message) => message.includes("cap")));
});
test("feat prerequisites and repeatability are validated; Tough applies once even with its manual template", () => {
  const character = hero(3, { subclass: "Champion", classSubclasses: { Fighter: "Champion" }, abilityScores: { Strength: 16, Dexterity: 14, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 10 } });
  const plan = newLevelUpPlan(character); plan.feat = "Tough"; plan.choices["Fighter:mastery:4"] = ["Longsword"];
  assert.ok(!eligibleFeats(character, plan).some((feat) => feat.name === "War Caster"));
  const result = { ...character, ...applyLevelUp(character, plan, "tough", "now") };
  assert.equal(calculateCharacterStats(result).maxHitPoints, 44);
  assert.ok(!eligibleFeats(result, newLevelUpPlan(result)).some((feat) => feat.name === "Tough"));
});
test("multiclass prerequisites use current abilities and spell picks use individual class slot limits", () => {
  const character = hero(5), plan = newLevelUpPlan(character);
  plan.className = "Wizard"; plan.subclass = ""; pickSpells(character, plan);
  assert.equal(spellLimits(character, plan).maxLevel, 1);
  assert.equal(spellLimits(character, plan).cantrips, 3);
  assert.equal(spellLimits(character, plan).requiredSpells, 6);
  assert.deepEqual(levelUpErrors(character, plan), []);
  character.abilityScores.Intelligence = 12;
  assert.ok(levelUpErrors(character, plan).some((message) => message.includes("13 or higher")));
});
test("level-up spell selection rejects wrong classes, duplicate spells and combined-slot overreach", () => {
  const character = hero(2, { characterClass: "Wizard", classLevels: { Wizard: 2, Cleric: 5 }, level: 7, classSubclasses: { Cleric: "Life Domain" } });
  const plan = newLevelUpPlan(character); plan.subclass = "Evoker"; pickSpells(character, plan);
  plan.spellKeys.push(SPELL_CATALOG.find((spell) => spell.name === "Fireball").key);
  assert.ok(levelUpErrors(character, plan).some((message) => message.includes("available spell levels")));
  plan.spellKeys = [plan.spellKeys[0], plan.spellKeys[0]];
  assert.ok(levelUpErrors(character, plan).some((message) => message.includes("only once")));
});
test("choice validation prevents missing Expertise and applies selected ranks", () => {
  const character = hero(1, { characterClass: "Bard", classLevels: { Bard: 1 }, skillProficiencies: { ...defaultCharacterStats().skillProficiencies, Arcana: 1, Persuasion: 1 } });
  const plan = pickSpells(character, newLevelUpPlan(character));
  assert.ok(levelUpErrors(character, plan).some((message) => message.includes("Expertise")));
  const choice = levelChoices(character, plan).find((choice) => choice.title === "Expertise");
  plan.choices[choice.key] = ["Arcana", "Persuasion"];
  const result = applyLevelUp(character, plan, "bard-2", "now");
  assert.equal(result.skillProficiencies.Arcana, 2); assert.equal(result.skillProficiencies.Persuasion, 2);
});
test("hit point rolls, history and action economy survive normalization and level 20 is a hard cap", () => {
  const character = hero(1), plan = newLevelUpPlan(character); plan.hpRoll = 10;
  const result = { ...character, ...applyLevelUp(character, plan, "roll-hp", "now") };
  assert.equal(calculateCharacterStats(result).maxHitPoints, 24);
  assert.equal(normalizeCharacter(result).advancement[0].hpRoll, 10);
  assert.equal(normalizeCharacter(result).hitPointAdjustment, 4);
  assert.ok(levelUpErrors(hero(20), newLevelUpPlan(hero(20))).some((message) => message.includes("20")));
});

test("Life Domain spells are granted automatically and remain always prepared", () => {
  const character = hero(2, { characterClass: "Cleric", classLevels: { Cleric: 2 } });
  const plan = newLevelUpPlan(character); plan.subclass = "Life Domain";
  const result = applyLevelUp(character, plan, "life-3", "now");
  assert.deepEqual(result.spells.filter((spell) => spell.alwaysPrepared).map((spell) => spell.name).sort(), ["Aid", "Bless", "Cure Wounds", "Lesser Restoration"]);
});
