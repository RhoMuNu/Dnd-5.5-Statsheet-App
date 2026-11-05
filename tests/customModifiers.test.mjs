import test from "node:test";
import assert from "node:assert/strict";
import { defaultCharacterStats, normalizeCharacter } from "../src/data/characters.ts";
import { normalizeCustomModifiers } from "../src/data/customModifiers.ts";
import { calculateCharacterStats } from "../src/data/calculations.ts";
import { attackNumbers, makeWeaponAttack, rollWeaponAttack } from "../src/data/attacks.ts";
import { createCharacterBackup, parseCharacterBackup } from "../src/data/backup.ts";
import { restCharacter, deathSave, castCharacterSpell } from "../src/data/gameplay.ts";
import { spellFromCatalog, findSpellByName } from "../src/data/rulesCatalog.ts";
import { resolveSpellCast } from "../src/data/spellEffects.ts";

const boost = (target, amount, id = target) => ({ id, name: id, target, amount, enabled: true });
const hero = (name = "Wizard") => ({ ...defaultCharacterStats(), id: "hero", name: "Hero", concept: "", species: "Human", background: "", characterClass: name, classLevels: { [name]: 3 }, level: 3, abilityScores: { Strength: 16, Dexterity: 14, Constitution: 14, Intelligence: 16, Wisdom: 16, Charisma: 10 }, createdAt: "today", updatedAt: "today" });

test("custom sources update shared AC, initiative, specific skills/saves, spells, HP and speed without changing base scores", () => {
  const base = hero(), before = calculateCharacterStats(base);
  const character = { ...base, customModifiers: [boost("ac", 2), boost("initiative", 3), boost("check", 1), boost("skill:Perception", 4), boost("save", 1), boost("save:Wisdom", 2), boost("attack", 2), boost("spellAttack", 3), boost("spellDC", 2), boost("maxHP", 7), boost("speed", 5)] };
  const stats = calculateCharacterStats(character);
  assert.equal(stats.armorClass, before.armorClass + 2);
  assert.equal(stats.initiative, before.initiative + 4);
  assert.equal(stats.skillBonuses.Perception, before.skillBonuses.Perception + 5);
  assert.equal(stats.skillBonuses.Arcana, before.skillBonuses.Arcana + 1);
  assert.equal(stats.passivePerception, before.passivePerception + 5);
  assert.equal(stats.savingThrows.Wisdom, before.savingThrows.Wisdom + 3);
  assert.equal(stats.savingThrows.Constitution, before.savingThrows.Constitution + 1);
  assert.equal(stats.spellAttackBonus, before.spellAttackBonus + 5);
  assert.equal(stats.spellcastingProgressions[0].attackBonus, before.spellcastingProgressions[0].attackBonus + 5);
  assert.equal(stats.spellcastingProgressions[0].saveDC, before.spellcastingProgressions[0].saveDC + 2);
  assert.equal(stats.maxHitPoints, before.maxHitPoints + 7);
  assert.equal(stats.speed, before.speed + 5);
  assert.deepEqual(character.abilityScores, base.abilityScores);
});

test("weapon and spell roll math uses boosts once; spell attack bonuses do not leak into healing", () => {
  const character = { ...hero("Cleric"), customModifiers: [boost("attack", 2), boost("damage", 3), boost("spellAttack", 5)] };
  const attack = makeWeaponAttack(character, "Longsword", "sword");
  assert.equal(attackNumbers(character, attack).toHit, 7);
  assert.equal(attackNumbers(character, attack).damageBonus, 6);
  assert.equal(rollWeaponAttack(character, attack, "normal", 16, false, false, () => 10).total, 17);
  character.spells = [spellFromCatalog(findSpellByName("Cure Wounds").key, "cure", "Cleric")];
  const healed = resolveSpellCast(character, "cure", "spell-slot:Spellcasting · Long Rest:1", "Cleric", false, () => 1);
  assert.equal(healed.amount, 5);
});

test("boosts can be toggled or penalize stats and survive normalization, backups and rest", () => {
  const character = { ...hero(), customModifiers: [boost("ac", 2, "ring"), { ...boost("ac", 10, "inactive"), enabled: false }, boost("initiative", -2, "penalty")] };
  const loaded = parseCharacterBackup(createCharacterBackup([character], character.id)).characters[0];
  assert.deepEqual(loaded.customModifiers, character.customModifiers);
  assert.equal(calculateCharacterStats(loaded).armorClass, calculateCharacterStats(hero()).armorClass + 2);
  assert.equal(calculateCharacterStats(loaded).initiative, calculateCharacterStats(hero()).initiative - 2);
  const rested = { ...loaded, ...restCharacter(loaded, "Long Rest") };
  assert.deepEqual(rested.customModifiers, character.customModifiers);
  assert.equal(calculateCharacterStats(rested).armorClass, calculateCharacterStats(loaded).armorClass);
  assert.deepEqual(normalizeCharacter(hero()).customModifiers, []);
  assert.equal(calculateCharacterStats({ ...hero(), customModifiers: [boost("maxHP", -100)] }).maxHitPoints, 1);
});

test("malformed, duplicate and unsupported modifiers are dropped", () => {
  assert.deepEqual(normalizeCustomModifiers(null), []);
  const valid = boost("skill:Stealth", 2);
  assert.deepEqual(normalizeCustomModifiers([valid, valid, { ...valid, id: "wrong", target: "unknown" }, { ...valid, id: "huge", amount: 1000 }, { ...valid, id: "fraction", amount: 1.5 }, null]), [valid]);
});

test("manual casting bookkeeping spends slots without dice and all-save boosts reach death saves", () => {
  const character = hero("Cleric");
  character.spells = [spellFromCatalog(findSpellByName("Bless").key, "bless", "Cleric")];
  const updates = castCharacterSpell(character, "bless", "spell-slot:Spellcasting · Long Rest:1");
  assert.equal(updates.resourceUses["spell-slot:Spellcasting · Long Rest:1"], 1);
  assert.equal(updates.combat.concentration, "Bless");
  assert.equal(updates.currentHitPoints, undefined);
  const save = deathSave({ ...character, currentHitPoints: 0, customModifiers: [boost("save", 2)] }, 8);
  assert.equal(save.combat.deathSuccesses, 1);
});
