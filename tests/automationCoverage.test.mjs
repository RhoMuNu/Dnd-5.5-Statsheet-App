import test from "node:test";
import assert from "node:assert/strict";
import { featureCoverage, spellCoverage } from "../src/data/automationCoverage.ts";
import { readPlayPreferences, AUTOMATION_KEY } from "../src/data/playPreferences.ts";
import { defaultCharacterStats } from "../src/data/characters.ts";
import { spellFromCatalog, SPELL_CATALOG } from "../src/data/rulesCatalog.ts";

const hero = () => ({ ...defaultCharacterStats(), name: "Hero", characterClass: "Fighter", classLevels: { Fighter: 2 }, level: 2, species: "Dwarf", background: "Soldier" });
const spell = (name) => spellFromCatalog(SPELL_CATALOG.find((entry) => entry.name === name).key, "test-spell", "Wizard");
test("coverage distinguishes applied passive bonuses from counters and unknown homebrew", () => {
  const character = hero();
  assert.equal(featureCoverage("Dwarven Toughness", character, "paper").level, "automatic");
  const tracker = featureCoverage("Stonecunning", character, "digital");
  assert.equal(tracker.level, "manual");
  assert.match(tracker.app, /counter/);
  assert.equal(featureCoverage("My homebrew", character, "digital", true).level, "manual");
  assert.equal(featureCoverage("Tough", character, "digital", true).level, "manual");
  character.features.push({ id: "tough", name: "Tough", category: "feat", description: "Recorded feat" });
  assert.equal(featureCoverage("Tough", character, "paper", true).level, "automatic");
});
test("mode-sensitive helpers do not claim dice/effect automation in Paper sheet", () => {
  const character = hero();
  assert.equal(featureCoverage("Second Wind", character, "physical").level, "partial");
  assert.match(featureCoverage("Second Wind", character, "classic").table, /apply healing yourself/);
  assert.equal(featureCoverage("Second Wind", character, "paper").level, "manual");
  assert.equal(featureCoverage("Action Surge", character, "paper").level, "manual");
});
test("spell labels follow the selected formula, its level, and the actual automation/dice settings", () => {
  const fire = { ...spell("Fire Bolt"), automation: "Fire Bolt" };
  assert.equal(spellCoverage(fire, "digital").level, "partial");
  assert.match(spellCoverage(fire, "physical").app, /physical die faces/);
  assert.equal(spellCoverage(fire, "classic").level, "manual");
  assert.equal(spellCoverage(fire, "paper").level, "manual");
  assert.doesNotMatch(spellCoverage(fire, "paper").app, /spends|tracks its slot/);
  assert.equal(spellCoverage({ ...fire, automation: "manual" }, "digital").level, "manual");
  assert.equal(spellCoverage({ ...fire, automation: "" }, "digital").level, "partial");
  assert.equal(spellCoverage({ ...fire, automation: "Fireball" }, "digital").level, "manual");
  assert.match(spellCoverage({ ...fire, name: "Custom beam" }, "digital").table, /using the Fire Bolt formula/);
  assert.equal(spellCoverage(spell("Mage Hand"), "digital").level, "manual");
});
test("old play modes migrate without coupling automation to the remembered dice preference", () => {
  const values = new Map([["taleforge.sheet.classic.v1", "true"], ["taleforge.dice.source.v1", "physical"]]);
  const storage = { getItem: (key) => values.get(key) ?? null };
  assert.deepEqual(readPlayPreferences(storage), { automation: "tracked", dice: "physical" });
  values.set(AUTOMATION_KEY, "paper");
  assert.deepEqual(readPlayPreferences(storage), { automation: "paper", dice: "physical" });
  values.set(AUTOMATION_KEY, "assisted");
  assert.deepEqual(readPlayPreferences(storage), { automation: "assisted", dice: "physical" });
  assert.deepEqual(readPlayPreferences({ getItem: () => { throw new Error("Unavailable storage"); } }), { automation: "assisted", dice: "digital" });
});
test("classifying coverage never changes the sheet, uses, or selected spell formula", () => {
  const character = hero(), fire = spell("Fire Bolt");
  const before = JSON.stringify({ character, fire });
  for (const mode of ["paper", "classic", "physical", "digital"]) {
    featureCoverage("Second Wind", character, mode);
    featureCoverage("Stonecunning", character, mode);
    spellCoverage(fire, mode);
  }
  assert.equal(JSON.stringify({ character, fire }), before);
});
