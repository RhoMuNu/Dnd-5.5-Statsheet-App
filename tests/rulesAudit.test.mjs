import test from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, normalizeCharacter } from "../src/data/characters.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";
import { adjustedDamage, restCharacter } from "../src/data/gameplay.ts";
import { baseAbilityScoreErrors, speciesLineage } from "../src/data/creationOptions.ts";

const hero = (overrides = {}) => {
  const classLevels = overrides.classLevels ?? { Fighter: 1 };
  return { ...defaultCharacterStats(), id: "audit", name: "Audit", concept: "", species: "Human", background: "Soldier",
    characterClass: Object.keys(classLevels)[0], level: Object.values(classLevels).reduce((sum, value) => sum + value, 0),
    createdAt: "2026-11-19", updatedAt: "2026-11-19", ...overrides, classLevels };
};
const resource = (character, key) => calculateCharacterStats(character).classResources.find((entry) => entry.key === key);

test("Cleric Channel Divinity grows to four uses at level 18", () => {
  assert.equal(resource(hero({ classLevels: { Cleric: 17 } }), "cleric.channel-divinity").maxUses, 3);
  assert.equal(resource(hero({ classLevels: { Cleric: 18 } }), "cleric.channel-divinity").maxUses, 4);
});

test("Monk Unarmored Movement and Barbarian Fast Movement stack while unarmored", () => {
  const stats = calculateCharacterStats(hero({ classLevels: { Barbarian: 5, Monk: 2 } }));
  assert.equal(stats.speed, 50);
  assert.ok(stats.appliedClassFeatures.includes("Monk Unarmored Movement +10 ft."));
  assert.ok(stats.appliedClassFeatures.includes("Barbarian Fast Movement +10 ft."));
  assert.equal(calculateCharacterStats(hero({ classLevels: { Barbarian: 5, Monk: 2 }, hasShield: true })).speed, 40);
});

test("Monk Uncanny Metabolism unlocks at level 2 and only a Long Rest restores it", () => {
  assert.equal(resource(hero({ classLevels: { Monk: 1 } }), "monk.uncanny-metabolism"), undefined);
  const monk = hero({ classLevels: { Monk: 2 }, resourceUses: { "monk.uncanny-metabolism": 1, "monk.focus-points": 2 } });
  assert.equal(resource(monk, "monk.uncanny-metabolism").maxUses, 1);
  const shortRest = restCharacter(monk, "Short Rest").resourceUses;
  assert.equal(shortRest["monk.uncanny-metabolism"], 1);
  assert.equal(shortRest["monk.focus-points"], 0);
  assert.equal(restCharacter(monk, "Long Rest").resourceUses["monk.uncanny-metabolism"], 0);
});

test("species lineages parse saved names, aliases, and short forms", () => {
  assert.equal(speciesLineage("Elf (Wood Elf)").lineage?.name, "Wood Elf");
  assert.equal(speciesLineage("Elf (wood)").lineage?.name, "Wood Elf");
  assert.deepEqual([speciesLineage("Wood Elf").base, speciesLineage("Wood Elf").lineage?.name], ["Elf", "Wood Elf"]);
  assert.equal(speciesLineage("Dragonborn (Red Dragon)").lineage?.detail, "Fire");
  assert.equal(speciesLineage("Goliath (Stone)").lineage?.name, "Stone Giant");
  assert.equal(speciesLineage("Tiefling (Chthonic)").lineage?.spells?.[0], "False Life");
  assert.deepEqual(speciesLineage("Lizardfolk"), { base: "Lizardfolk", recorded: "", lineage: undefined });
});

test("species limited-use traits have the 2024 uses, unlock levels, and recovery", () => {
  const orc = hero({ species: "Orc", resourceUses: { "species.relentless-endurance": 1, "species.adrenaline-rush": 2 } });
  assert.equal(resource(orc, "species.relentless-endurance").maxUses, 1);
  assert.equal(restCharacter(orc, "Short Rest").resourceUses["species.relentless-endurance"], 1);
  assert.equal(restCharacter(orc, "Short Rest").resourceUses["species.adrenaline-rush"], 0);
  assert.equal(restCharacter(orc, "Long Rest").resourceUses["species.relentless-endurance"], 0);

  const goliath = resource(hero({ species: "Goliath (Stone Giant)", classLevels: { Fighter: 5 } }), "species.giant-ancestry");
  assert.equal(goliath.maxUses, 3);
  assert.equal(goliath.label, "Stone’s Endurance · Giant Ancestry");

  assert.equal(resource(hero({ species: "Dragonborn (Gold)", classLevels: { Fighter: 4 } }), "species.draconic-flight"), undefined);
  assert.equal(resource(hero({ species: "Dragonborn (Gold)", classLevels: { Fighter: 5 } }), "species.draconic-flight").maxUses, 1);

  assert.equal(resource(hero({ species: "Elf (Wood Elf)", classLevels: { Fighter: 2 } }), "species.lineage-spell-3"), undefined);
  const woodElf = hero({ species: "Elf (Wood Elf)", classLevels: { Fighter: 5 } });
  assert.equal(resource(woodElf, "species.lineage-spell-3").label, "Longstrider · Elven Lineage");
  assert.equal(resource(woodElf, "species.lineage-spell-5").label, "Pass without Trace · Elven Lineage");
  assert.equal(resource(hero({ species: "Tiefling (Infernal)", classLevels: { Fighter: 3 } }), "species.lineage-spell-3").label, "Hellish Rebuke · Fiendish Legacy");
  assert.equal(resource(hero({ species: "Tiefling", classLevels: { Fighter: 3 } }), "species.lineage-spell-3").label, "Level 3 lineage spell · Fiendish Legacy");

  assert.equal(resource(hero({ species: "Gnome (Forest Gnome)", classLevels: { Fighter: 9 } }), "species.lineage-spell").maxUses, 4);
  assert.equal(resource(hero({ species: "Gnome (Rock Gnome)" }), "species.lineage-spell"), undefined);
});

test("Human Resourceful grants Heroic Inspiration on a Long Rest without a separate counter", () => {
  const human = hero({ species: "Human", heroicInspiration: false, currentHitPoints: 5 });
  assert.equal(resource(human, "species.resourceful"), undefined);
  assert.equal(restCharacter(human, "Long Rest").heroicInspiration, true);
  assert.equal(restCharacter(human, "Short Rest").heroicInspiration, undefined);
  assert.equal(restCharacter(hero({ species: "Dwarf", heroicInspiration: false }), "Long Rest").heroicInspiration, undefined);
});

test("resistance rounds down before vulnerability doubles", () => {
  const character = hero();
  assert.equal(adjustedDamage(character, 7, "resistant"), 3);
  assert.equal(adjustedDamage(character, 7, "vulnerable"), 14);
  assert.equal(adjustedDamage(character, 7, "immune"), 0);
  const petrified = hero({ combat: { conditions: ["Petrified"], effects: [] } });
  assert.equal(adjustedDamage(petrified, 7, "vulnerable"), 6);
});

test("saved species skill choices survive reloads; invalid values are dropped", () => {
  const details = { abilityMethod: "standard", baseAbilityScores: {}, backgroundAbilityBoosts: {}, classSkills: [], languages: ["Common"], speciesSkillProficiency: "Perception" };
  assert.equal(normalizeCharacter(hero({ species: "Elf", creationDetails: details })).creationDetails.speciesSkillProficiency, "Perception");
  assert.equal(normalizeCharacter(hero({ creationDetails: { ...details, speciesSkillProficiency: "Lockpicking" } })).creationDetails.speciesSkillProficiency, undefined);
});

test("creation ability scores reject point-buy loopholes and out-of-range manual entries", () => {
  const scores = (values) => Object.fromEntries(["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"].map((ability, index) => [ability, values[index]]));
  assert.deepEqual(baseAbilityScoreErrors("point-buy", scores([15, 15, 15, 8, 8, 8])), []);
  assert.match(baseAbilityScoreErrors("point-buy", scores([15, 15, 15, 8, 8, 7]))[0], /from 8 to 15/);
  assert.match(baseAbilityScoreErrors("point-buy", scores([15, 15, 14, 8, 8, 8]))[0], /spent 25/);
  assert.deepEqual(baseAbilityScoreErrors("manual", scores([3, 18, 20, 1, 10, 10])), []);
  assert.match(baseAbilityScoreErrors("manual", scores([0, 10, 10, 10, 10, 21]))[0], /Strength, Charisma/);
});
