import test from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats } from "../src/data/characters.ts";
import { SPECIES, BACKGROUNDS } from "../src/data/creationOptions.ts";
import { featureDescription, speciesFeatureDescriptions, originDescriptions, buildChoiceDescriptions, referencedSpells } from "../src/data/featureDescriptions.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";
import { restCharacter } from "../src/data/gameplay.ts";

const hero = (species = "Dwarf", level = 1, name = "Fighter") => ({ ...defaultCharacterStats(), id: "test", name: "Test", concept: "", species, background: "Soldier", characterClass: name, level, classLevels: { [name]: level }, createdAt: "today", updatedAt: "today" });

test("every offered species has individual, nonempty trait rules and every background feat has a description", () => {
  for (const name of Object.keys(SPECIES)) {
    const traits = speciesFeatureDescriptions(hero(name, 20));
    assert.ok(traits.length >= 3, name);
    assert.ok(traits.every((trait) => trait.description.trim().length > 20 && trait.source === name), name);
  }
  for (const [name, background] of Object.entries(BACKGROUNDS)) assert.ok(featureDescription(background.feat).length > 30, name);
  assert.ok(originDescriptions(hero()).some((entry) => entry.name === "Stonecunning" && entry.description.includes("Bonus Action")));
});

test("species lookup respects context, case, aliases, lineage and chosen skill without inventing custom-species traits", () => {
  assert.ok(featureDescription("Darkvision", hero("Dwarf")).includes("120"));
  assert.ok(featureDescription("Darkvision", hero("Elf")).includes("60"));
  assert.ok(speciesFeatureDescriptions(hero(" eLf (High Elf) ")).some((entry) => entry.description.includes("High Elf")));
  assert.ok(speciesFeatureDescriptions(hero("High Elf")).some((entry) => entry.name === "Elven Lineage"));
  const human = { ...hero("Human"), creationDetails: { speciesSkillProficiency: "Perception" } };
  assert.ok(speciesFeatureDescriptions(human).find((entry) => entry.name === "Skillful").description.includes("Chosen skill: Perception"));
  assert.deepEqual(speciesFeatureDescriptions(hero("Custom Starfolk")), []);
});

test("species traits unlock at their own character levels", () => {
  for (const [species, trait, level] of [["Aasimar", "Celestial Revelation", 3], ["Dragonborn", "Draconic Flight", 5], ["Goliath", "Large Form", 5]]) {
    assert.ok(!speciesFeatureDescriptions(hero(species, level - 1)).some((entry) => entry.name === trait));
    assert.ok(speciesFeatureDescriptions(hero(species, level)).some((entry) => entry.name === trait));
  }
});

test("selected class options, Metamagic, invocations and creation notes resolve to their rules", () => {
  const sorcerer = { ...hero("Human", 2, "Sorcerer"), rulesChoices: { "Sorcerer:metamagic:2": ["Quickened Spell"] } };
  assert.ok(buildChoiceDescriptions(sorcerer)[0].description.includes("Sorcery"));
  const cleric = { ...hero("Human", 1, "Cleric"), rulesChoices: { "Cleric:divine-order": ["Protector"] } };
  assert.ok(buildChoiceDescriptions(cleric)[0].description.includes("Heavy armor"));
  assert.ok(featureDescription("Eldritch Mind", hero("Human", 2, "Warlock")).length > 30);
  const fighter = { ...hero(), creationDetails: { classChoices: "Fighting style: Defense" } };
  assert.ok(buildChoiceDescriptions(fighter)[0].description.includes("Armor Class"));
});

test("spell references are available from trait text without falsely treating dim light as the Light spell", () => {
  const lineage = speciesFeatureDescriptions(hero("Gnome (Forest)")).find((entry) => entry.name === "Gnomish Lineage");
  assert.ok(referencedSpells(lineage.description).some((spell) => spell.name === "Speak with Animals"));
  assert.equal(referencedSpells("Darkvision lets you see in dim light.").length, 0);
  const light = speciesFeatureDescriptions(hero("Aasimar")).find((entry) => entry.name === "Light Bearer");
  assert.ok(referencedSpells(light.description).some((spell) => spell.name === "Light"));
});

test("existing species counters match trait unlock levels, uses, and recovery", () => {
  const aasimar = calculateCharacterStats(hero("Aasimar")).classResources;
  assert.equal(aasimar.find((entry) => entry.key === "species.healing-hands").maxUses, 1);
  assert.ok(!aasimar.some((entry) => entry.key === "species.celestial-revelation"));
  assert.ok(!calculateCharacterStats(hero("Goliath", 4)).classResources.some((entry) => entry.key === "species.large-form"));
  assert.equal(calculateCharacterStats(hero("Goliath", 5)).classResources.find((entry) => entry.key === "species.large-form").maxUses, 1);
  const orc = { ...hero("Orc"), resourceUses: { "species.adrenaline-rush": 2 } };
  assert.equal(restCharacter(orc, "Short Rest").resourceUses["species.adrenaline-rush"], 0);
});
