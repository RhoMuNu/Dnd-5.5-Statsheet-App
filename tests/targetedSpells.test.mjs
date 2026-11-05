import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, defaultCombatState } from "../src/data/characters.ts";
import { resolveTargetedSpell, cleanConcentrationEffects } from "../src/data/targetedSpells.ts";
import { spellFromCatalog, SPELL_CATALOG } from "../src/data/rulesCatalog.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";
import { freshTurn } from "../src/data/economy.ts";

function hero(id, className = "Wizard", level = 5, extra = {}) { return { ...defaultCharacterStats(), id, name: id, concept: "", species: "Human", characterClass: className, classLevels: { [className]: level }, level, background: "", createdAt: "today", updatedAt: "today", abilityScores: { Strength: 10, Dexterity: 10, Constitution: 14, Intelligence: 16, Wisdom: 16, Charisma: 14 }, combat: { ...defaultCombatState(), turn: freshTurn() }, ...extra }; }
function caster(name, className = "Wizard", level = 5, extra = {}) {
  const character = hero("caster", className, level, extra);
  character.spells = [spellFromCatalog(SPELL_CATALOG.find((spell) => spell.name === name).key, "spell", className)];
  return character;
}
const slot = (character, level) => { const entry = calculateCharacterStats(character).spellSlots.find((slot) => slot.spellLevel === level); return `spell-slot:${entry.pool}:${level}`; };
test("area damage rolls once, resolves each save/defense and spends exactly one slot and action", () => {
  const source = caster("Fireball"), target = hero("target", "Fighter", 10), resistant = hero("resistant", "Fighter", 10);
  const request = { casterId: source.id, spellId: "spell", className: "Wizard", slotKey: slot(source, 3), targets: [{ id: target.id }, { id: resistant.id, defense: "resistant" }] };
  const result = resolveTargetedSpell(source, [source, target, resistant], request, "cast", (sides) => sides === 20 ? 1 : 3);
  const next = new Map(result.characters.map((character) => [character.id, character]));
  assert.equal(next.get("target").currentHitPoints, calculateCharacterStats(target).maxHitPoints - 24);
  assert.equal(next.get("resistant").currentHitPoints, calculateCharacterStats(resistant).maxHitPoints - 12);
  assert.equal(next.get("caster").resourceUses[request.slotKey], 1);
  assert.equal(next.get("caster").combat.turn.actionUsed, true);
  assert.equal(source.resourceUses[request.slotKey], undefined);
});
test("Evasion applies to Dexterity half-damage saves and automatic failures cannot become successes", () => {
  const source = caster("Fireball"), rogue = hero("rogue", "Rogue", 7);
  const request = { casterId: "caster", spellId: "spell", className: "Wizard", slotKey: slot(source, 3), targets: [{ id: "rogue" }] };
  const result = resolveTargetedSpell(source, [rogue], request, "fire", (sides) => sides === 20 ? 20 : 3);
  assert.equal(result.characters.find((character) => character.id === "rogue").currentHitPoints, null);
  rogue.combat.conditions = ["Paralyzed"];
  const failed = resolveTargetedSpell(source, [rogue], request, "fire2", (sides) => sides === 20 ? 20 : 3);
  assert.equal(failed.characters.find((character) => character.id === "rogue").currentHitPoints, calculateCharacterStats(rogue).maxHitPoints - 24);
});
test("Life Domain healing and Blessed Healer apply to the right recipients", () => {
  const source = caster("Healing Word", "Cleric", 6, { subclass: "Life Domain", classSubclasses: { Cleric: "Life Domain" }, currentHitPoints: 10 });
  const target = hero("fighter", "Fighter", 5, { currentHitPoints: 1 });
  const result = resolveTargetedSpell(source, [target], { casterId: source.id, spellId: "spell", className: "Cleric", slotKey: slot(source, 1), targets: [{ id: target.id }] }, "heal", () => 2);
  assert.equal(result.characters.find((character) => character.id === target.id).currentHitPoints, 11);
  assert.equal(result.characters.find((character) => character.id === source.id).currentHitPoints, 13);
  assert.equal(result.characters.find((character) => character.id === source.id).combat.turn.bonusUsed, true);
});
test("Bless applies source-linked effects and recasting or losing concentration clears old recipients", () => {
  const source = caster("Bless", "Cleric"), target = hero("friend", "Fighter");
  const result = resolveTargetedSpell(source, [target], { casterId: source.id, spellId: "spell", className: "Cleric", slotKey: slot(source, 1), targets: [{ id: target.id }] }, "bless", () => 1);
  const nextSource = result.characters.find((character) => character.id === source.id), nextTarget = result.characters.find((character) => character.id === target.id);
  assert.equal(nextTarget.combat.effects[0].sourceConcentrationId, nextSource.combat.concentrationId);
  assert.equal(cleanConcentrationEffects(result.characters)[1].combat.effects.length, 1);
  nextSource.combat.concentration = "";
  assert.equal(cleanConcentrationEffects(result.characters).find((character) => character.id === target.id).combat.effects.length, 0);
});
test("Bane makes a Charisma save and Shield rejects other targets", () => {
  const source = caster("Bane", "Cleric"), target = hero("enemy", "Fighter");
  const result = resolveTargetedSpell(source, [target], { casterId: source.id, spellId: "spell", className: "Cleric", slotKey: slot(source, 1), targets: [{ id: target.id }] }, "bane", () => 20);
  assert.equal(result.characters.find((character) => character.id === target.id).combat.effects.length, 0);
  const shield = caster("Shield");
  assert.throws(() => resolveTargetedSpell(shield, [target], { casterId: shield.id, spellId: "spell", className: "Wizard", slotKey: slot(shield, 1), targets: [{ id: target.id }] }, "shield"), /only the caster/);
});
test("invalid target selections and unavailable resources reject the whole cast without mutating any character", () => {
  const source = caster("Cure Wounds", "Cleric"), target = hero("target", "Fighter");
  const before = structuredClone(source), request = { casterId: source.id, spellId: "spell", className: "Cleric", slotKey: slot(source, 1), targets: [{ id: target.id }, { id: "missing" }] };
  assert.throws(() => resolveTargetedSpell(source, [target], request, "bad")); assert.deepEqual(source, before);
});

test("Evoker Potent Cantrip deals half rolled damage on a missed Fire Bolt", () => {
  const source = caster("Fire Bolt", "Wizard", 3, { subclass: "Evoker", classSubclasses: { Wizard: "Evoker" } });
  const target = hero("tank", "Fighter", 10, { armorMode: "custom", armorBaseAC: 30 });
  const result = resolveTargetedSpell(source, [target], { casterId: source.id, spellId: "spell", className: "Wizard", targets: [{ id: target.id }] }, "potent", (sides) => sides === 20 ? 1 : 6);
  assert.equal(result.characters.find((character) => character.id === target.id).currentHitPoints, calculateCharacterStats(target).maxHitPoints - 3);
});

test("targeted damage rolls concentration immediately and losing it clears linked recipients", () => {
  const source = caster("Fire Bolt");
  const target = hero("concentrator", "Wizard", 5);
  target.combat.concentration = "Bless"; target.combat.concentrationId = "source-link";
  const friend = hero("friend", "Fighter", 5);
  friend.combat.effects = [{ id: "linked", name: "Bless", rounds: 10, sourceCharacterId: target.id, sourceConcentrationId: "source-link" }];
  const result = resolveTargetedSpell(source, [target], { casterId: source.id, spellId: "spell", className: "Wizard", targets: [{ id: target.id }] }, "concentration", (sides) => sides === 20 ? 2 : 4);
  // The attack misses on 2, so force the attack to hit and the following save to fail.
  let d20 = 0;
  const hit = resolveTargetedSpell(source, [target], { casterId: source.id, spellId: "spell", className: "Wizard", targets: [{ id: target.id }] }, "concentration-hit", (sides) => sides === 20 ? (++d20 === 1 ? 15 : 1) : 4);
  assert.equal(hit.characters.find((character) => character.id === target.id).combat.concentration, "");
  assert.equal(cleanConcentrationEffects([...hit.characters, friend]).find((character) => character.id === friend.id).combat.effects.length, 0);
  assert.equal(result.characters.find((character) => character.id === target.id).combat.concentration, "Bless");
});
