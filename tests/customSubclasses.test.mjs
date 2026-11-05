import test from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, normalizeCharacter } from "../src/data/characters.ts";
import { applyLevelUp, levelChoices, levelUpErrors, newLevelUpPlan } from "../src/data/advancement.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";
import { characterRuleFeatures } from "../src/data/featureDescriptions.ts";
import { subclassIs } from "../src/data/rulesCatalog.ts";
import { activeEffects } from "../src/data/effects.ts";
import { createCharacterBackup, parseCharacterBackup } from "../src/data/backup.ts";

const hero = (level = 2, extras = {}) => ({ ...defaultCharacterStats(), id: "custom-hero", name: "Hero", concept: "", species: "Human", characterClass: "Fighter", classLevels: { Fighter: level }, level, background: "", createdAt: "today", updatedAt: "today", ...extras });
const customPlan = (character, name = "Champion") => ({ ...newLevelUpPlan(character), subclass: name, customSubclass: true, customDescription: "A player-designed path with manually resolved features.", customFeatures: [{ name: "Moonlit Guard", description: "Once per rest, grant an ally +2 AC until your next turn." }] });

test("custom subclasses unlock at class level 3, save descriptions, and do not inherit a same-named bundled subclass", () => {
  const character = hero();
  const before = structuredClone(character), plan = customPlan(character);
  assert.deepEqual(levelUpErrors(character, plan), []);
  const next = { ...character, ...applyLevelUp(character, plan, "custom-level-3", "now") };
  assert.equal(next.subclass, "Champion");
  assert.equal(next.customSubclasses.Fighter.description, plan.customDescription);
  assert.equal(subclassIs(next, "Fighter", "Champion"), false);
  assert.equal(characterRuleFeatures(next).some((feature) => feature.name === "Improved Critical"), false);
  assert.equal(next.features.some((feature) => feature.name === "Improved Critical"), false);
  assert.ok(next.features.some((feature) => feature.name === "Moonlit Guard" && feature.manualOnly && feature.source === "Champion · Fighter 3"));
  assert.deepEqual(character, before);
  assert.ok(levelUpErrors(hero(1), customPlan(hero(1))).some((message) => message.includes("class level 3")));
});
test("custom descriptions and manual features survive backups and later level-ups", () => {
  const first = hero(), third = { ...first, ...applyLevelUp(first, customPlan(first), "third", "now") };
  const restored = parseCharacterBackup(createCharacterBackup([third], third.id)).characters[0];
  assert.deepEqual(restored.customSubclasses, third.customSubclasses);
  assert.deepEqual(restored.features, third.features);
  const plan = newLevelUpPlan(restored);
  assert.equal(plan.customSubclass, true);
  assert.equal(plan.customDescription, third.customSubclasses.Fighter.description);
  plan.boosts = { Strength: 2 };
  plan.customFeatures = [{ name: "Silver Step", description: "Move 10 feet after using Moonlit Guard; resolve positioning at the table." }];
  const fourth = { ...restored, ...applyLevelUp(restored, plan, "fourth", "later") };
  assert.equal(fourth.features.filter((feature) => feature.name === "Moonlit Guard").length, 1);
  assert.ok(fourth.features.some((feature) => feature.name === "Silver Step" && feature.manualOnly));
  assert.equal(normalizeCharacter(fourth).customSubclasses.Fighter.name, "Champion");
});
test("custom features require descriptions, cannot be smuggled into bundled level-ups, and cannot replace a chosen subclass", () => {
  const character = hero();
  for (const patch of [{ customDescription: "" }, { subclass: " " }, { subclass: "x".repeat(81) }, { customFeatures: [{ name: "Empty", description: "" }] }, { customFeatures: [{ name: "", description: "Rules" }] }, { customFeatures: Array.from({ length: 21 }, () => ({ name: "Feature", description: "Rules" })) }]) assert.ok(levelUpErrors(character, { ...customPlan(character), ...patch }).length);
  assert.ok(levelUpErrors(character, { ...customPlan(character), customSubclass: false }).some((message) => message.includes("require a custom subclass")));
  const third = { ...character, ...applyLevelUp(character, customPlan(character), "third", "now") };
  assert.ok(levelUpErrors(third, { ...newLevelUpPlan(third), subclass: "Another path", boosts: { Strength: 2 } }).some((message) => message.includes("replace")));
  assert.ok(levelUpErrors(third, { ...newLevelUpPlan(third), customSubclass: false, boosts: { Strength: 2 } }).some((message) => message.includes("subclass’s type")));
});
test("a custom subclass name does not enable inferred spellcasting or hidden invocation benefits", () => {
  const character = hero(), plan = customPlan(character, "Eldritch Knight");
  plan.customFeatures = [{ name: "Eldritch Mind", description: "Our version has different rules; apply them manually." }];
  const third = { ...character, ...applyLevelUp(character, plan, "third", "now") };
  assert.deepEqual(calculateCharacterStats(third).spellSlots, []);
  assert.equal(activeEffects(third).some((effect) => effect.concentrationAdvantage), false);
  const seventh = hero(6, { subclass: "Champion", classSubclasses: { Fighter: "Champion" }, customSubclasses: { Fighter: { name: "Champion", description: "Custom path" } } });
  assert.equal(levelChoices(seventh, newLevelUpPlan(seventh)).some((choice) => choice.title === "Fighting Style"), false);
  const cleric = hero(2, { characterClass: "Cleric", classLevels: { Cleric: 2 } });
  const customDomain = { ...cleric, ...applyLevelUp(cleric, customPlan(cleric, "Life Domain"), "domain", "now") };
  assert.deepEqual(customDomain.spells, []);
  assert.equal(subclassIs(customDomain, "Cleric", "Life"), false);
});
test("multiclass plans preserve another class’s custom subclass and legacy custom names can gain descriptions", () => {
  const character = hero(3, { subclass: "Moon Knight", classSubclasses: { Fighter: "Moon Knight" } });
  const plan = newLevelUpPlan(character);
  assert.equal(plan.customSubclass, true);
  plan.customDescription = "Legacy subclass rules"; plan.boosts = { Strength: 2 };
  const next = { ...character, ...applyLevelUp(character, plan, "fourth", "now") };
  const multiclass = newLevelUpPlan(next, "Barbarian");
  assert.equal(multiclass.customSubclass, false);
  assert.equal(multiclass.subclass, "");
  assert.equal(newLevelUpPlan(next, "Fighter").customDescription, "Legacy subclass rules");
  assert.equal(normalizeCharacter({ ...next, customSubclasses: { Fighter: { name: "Broken", description: "" } } }), null);
});
