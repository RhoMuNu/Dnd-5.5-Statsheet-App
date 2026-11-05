import test from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats } from "../src/data/characters.ts";
import { SPELL_CATALOG, findSpellByName } from "../src/data/rulesCatalog.ts";
import { characterRuleFeatures, featureDescription } from "../src/data/featureDescriptions.ts";
import { startingSpellLimits, startingSpellErrors, createStartingSpells } from "../src/data/startingSpells.ts";

const character = (name, level = 1, subclass = "") => ({ ...defaultCharacterStats(), id: "test", name: "Test", concept: "", species: "Human", background: "Sage", characterClass: name, level, subclass, classLevels: { [name]: level }, classSubclasses: { [name]: subclass }, createdAt: "now", updatedAt: "now" });
const picks = (name, cantrips, spells) => [...SPELL_CATALOG.filter((spell) => spell.classes.includes(name) && spell.level === 0).slice(0, cantrips), ...SPELL_CATALOG.filter((spell) => spell.classes.includes(name) && spell.level === 1).slice(0, spells)].map((spell) => spell.key);

test("spell lookup ignores case and surrounding whitespace and preserves full catalog details", () => {
  const spell = findSpellByName("  cUrE wOuNdS  ");
  assert.equal(spell.name, "Cure Wounds");
  assert.ok(spell.description.includes("2d8"));
  assert.ok(spell.components && spell.castingTime && spell.range);
  assert.equal(findSpellByName("My custom spell"), undefined);
});

test("class and subclass features have descriptions at the right level, including old sheets without feature records", () => {
  const fighter = character("Fighter", 3, "Champion");
  const features = characterRuleFeatures(fighter);
  assert.ok(features.some((feature) => feature.name === "Action Surge" && feature.description.includes("Magic action")));
  assert.ok(features.some((feature) => feature.source === "Champion" && feature.description.length > 20));
  assert.ok(features.every((feature) => feature.description.trim() && feature.level <= 3));
  assert.ok(!features.some((feature) => feature.name === "Extra Attack"));
  assert.ok(featureDescription("aLeRt", fighter));
  assert.ok(featureDescription("Magic Initiate (Wizard)"));
  assert.equal(featureDescription("My custom ability"), "");
});

test("starting Wizard spellbook has three cantrips, six spells, four prepared spells and complete saved details", () => {
  const wizard = character("Wizard");
  assert.deepEqual(startingSpellLimits(wizard, "Wizard"), { cantrips: 3, spells: 6, prepared: 4, maxLevel: 1 });
  const selections = { Wizard: picks("Wizard", 3, 6) };
  assert.deepEqual(startingSpellErrors(wizard, selections), []);
  const spells = createStartingSpells(wizard, selections);
  assert.equal(spells.length, 9);
  assert.equal(spells.filter((spell) => spell.level > 0 && spell.prepared).length, 4);
  assert.ok(spells.every((spell) => spell.description && spell.catalogKey && spell.className === "Wizard"));
  assert.deepEqual(wizard.spells, []);
});

test("starting spell selection rejects incomplete, duplicate, wrong-class and over-level spells", () => {
  const wizard = character("Wizard");
  assert.ok(startingSpellErrors(wizard, { Wizard: [] }).length);
  assert.ok(startingSpellErrors(wizard, {}).length);
  const keys = picks("Wizard", 3, 6);
  for (const bad of [keys[0], findSpellByName("Cure Wounds").key, findSpellByName("Fireball").key, "missing-key"]) {
    assert.ok(startingSpellErrors(wizard, { Wizard: [...keys.slice(0, -1), bad] }).length);
    assert.throws(() => createStartingSpells(wizard, { Wizard: [...keys.slice(0, -1), bad] }));
  }
  assert.equal(startingSpellLimits(character("Fighter"), "Fighter").spells, 0);
  assert.equal(startingSpellLimits(character("Paladin"), "Paladin").spells, 2);
  assert.equal(startingSpellLimits(character("Warlock"), "Warlock").maxLevel, 1);
});

test("higher-level Wizard books retain earlier spells and subclass grants do not consume prepared selections", () => {
  const wizard = character("Wizard", 3);
  const excessive = [...picks("Wizard", 3, 4), ...SPELL_CATALOG.filter((spell) => spell.classes.includes("Wizard") && spell.level === 2).slice(0, 6).map((spell) => spell.key)];
  assert.ok(startingSpellErrors(wizard, { Wizard: excessive }).some((message) => message.includes("too many spells")));
  const cleric = character("Cleric", 3, "Life Domain");
  const limits = startingSpellLimits(cleric, "Cleric");
  const automaticNames = ["Aid", "Bless", "Cure Wounds", "Lesser Restoration"];
  const choices = SPELL_CATALOG.filter((spell) => spell.classes.includes("Cleric") && !automaticNames.includes(spell.name));
  const selections = { Cleric: [...choices.filter((spell) => spell.level === 0).slice(0, limits.cantrips), ...choices.filter((spell) => spell.level === 1).slice(0, limits.spells)].map((spell) => spell.key) };
  const spells = createStartingSpells(cleric, selections);
  assert.equal(spells.filter((spell) => spell.alwaysPrepared).length, 4);
  assert.ok(spells.filter((spell) => spell.alwaysPrepared).every((spell) => spell.prepared));
  assert.equal(spells.length, limits.cantrips + limits.spells + 4);
});
