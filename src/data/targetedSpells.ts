import type { AbilityName, Character } from "./characters";
import { activeConditions, automaticSaveFailure, isIncapacitated, type RollMode } from "./conditions";
import { calculateCharacterStats } from "./calculations";
import { activeEffects, effectDice, makeEffect } from "./effects";
import { adjustedDamage, applyDamage, combatState, healCharacter, rollD20, rollDie, spellSlotKey } from "./gameplay";
import { resolveSpellCast, SPELL_FORMULAS } from "./spellEffects";
import { subclassIs } from "./rulesCatalog";

export const TARGETED_SPELLS = ["Cure Wounds", "Healing Word", "Fire Bolt", "Sacred Flame", "Guiding Bolt", "Thunderwave", "Shatter", "Fireball", "Bless", "Bane", "Shield"];
export type TargetChoice = { id: string; mode?: RollMode; defense?: "normal" | "resistant" | "vulnerable" | "immune" };
export type TargetCast = { casterId: string; spellId: string; slotKey?: string; className: string; targets: TargetChoice[]; mode?: RollMode };
const SAVE_ABILITIES: Record<string, AbilityName> = { "Sacred Flame": "Dexterity", Thunderwave: "Constitution", Shatter: "Constitution", Fireball: "Dexterity", Bane: "Charisma" };

export function resolveTargetedSpell(caster: Character, targets: Character[], request: TargetCast, id: string, die = rollDie) {
  if (request.mode && !["normal", "advantage", "disadvantage"].includes(request.mode)) throw new Error("Invalid spell attack mode.");
  const spell = caster.spells.find((entry) => entry.id === request.spellId);
  const automation = spell?.automation ?? "";
  if (!spell || !TARGETED_SPELLS.includes(automation)) throw new Error("Choose a supported spell automation.");
  if (!Array.isArray(request.targets) || request.targets.length === 0 || request.targets.length > 20 || new Set(request.targets.map((target) => target.id)).size !== request.targets.length) throw new Error("Choose distinct spell targets (1–20).");
  const slotLevel = calculateCharacterStats(caster).spellSlots.find((slot) => spellSlotKey(slot.pool, slot.spellLevel) === request.slotKey)?.spellLevel ?? 0;
  const limit = ["Bless", "Bane"].includes(automation) ? 3 + Math.max(0, slotLevel - 1) : ["Thunderwave", "Shatter", "Fireball"].includes(automation) ? 20 : 1;
  if (request.targets.length > limit || (automation === "Shield" && request.targets[0].id !== caster.id)) throw new Error(`This spell allows ${automation === "Shield" ? "only the caster" : `up to ${limit} targets`}.`);
  const selected = request.targets.map((choice) => {
    const character = targets.find((entry) => entry.id === choice.id);
    if (!character) throw new Error("A target is no longer available in the shared encounter.");
    if (choice.mode && !["normal", "advantage", "disadvantage"].includes(choice.mode)) throw new Error("Invalid target saving throw mode.");
    if (choice.defense && !["normal", "resistant", "vulnerable", "immune"].includes(choice.defense)) throw new Error("Invalid damage defense.");
    return { character, choice };
  });
  // Slot and action are spent exactly once. All target changes are built before committing.
  const expectedLevel = ["Fire Bolt", "Sacred Flame"].includes(automation) ? 0 : ["Shatter"].includes(automation) ? 2 : automation === "Fireball" ? 3 : 1;
  if (spell.level !== expectedLevel) throw new Error("The spell level does not match its selected automation.");
  const castingTime = automation === "Shield" ? "reaction" : automation === "Healing Word" ? "bonus action" : "action";
  const canonicalCaster = { ...caster, spells: caster.spells.map((entry) => entry.id === spell.id ? { ...entry, castingTime, concentration: ["Bless", "Bane"].includes(automation) || entry.concentration } : entry) };
  const result = resolveSpellCast(canonicalCaster, spell.id, request.slotKey, request.className, false, die, request.mode ?? "normal", null);
  let nextCaster = { ...caster, ...result.updates };
  const progression = calculateCharacterStats(caster).spellcastingProgressions.find((entry) => entry.className === request.className);
  if (!progression) throw new Error("Choose the spellcasting class.");
  if (spell.className && spell.className !== request.className) throw new Error("This spell belongs to another spellcasting class.");
  const changed = new Map<string, Character>([[caster.id, nextCaster]]);
  const summaries: string[] = [];
  const formula = SPELL_FORMULAS.find((entry) => entry.name === automation);
  // resolveSpellCast exposes a single shared damage/healing roll and the attack result.
  for (const { character: original, choice } of selected) {
    let target = changed.get(original.id) ?? original;
    if (["Bless", "Bane", "Shield"].includes(automation)) {
      let saved = false;
      if (automation === "Bane") {
        const roll = rollD20(target, "save", choice.mode ?? "normal", "Charisma", false, false, die);
        const total = roll.natural + calculateCharacterStats(target).savingThrows.Charisma + effectDice(target, "save", die).total;
        saved = total >= progression.saveDC; summaries.push(`${target.name}: Charisma save ${total} vs DC ${progression.saveDC} · ${saved ? "saved" : "failed"}`);
      }
      if (!saved) {
        const effect = { ...makeEffect(automation, `${id}-${target.id}`), durationOwnerId: caster.id, sourceCharacterId: automation === "Shield" ? undefined : caster.id, sourceConcentrationId: automation === "Shield" ? undefined : nextCaster.combat?.concentrationId, sourceSpell: spell.name };
        target = { ...target, combat: { ...combatState(target), effects: [...combatState(target).effects.filter((entry) => entry.name !== automation), effect] } };
        summaries.push(`${target.name}: ${automation} applied`);
      }
    } else if (formula?.kind === "healing") {
      target = { ...target, ...healCharacter(target, result.amount ?? 0) };
      summaries.push(`${target.name}: heals ${result.amount ?? 0} HP before maximum`);
    } else {
      let amount = result.amount ?? 0;
      const saveAbility = SAVE_ABILITIES[automation];
      if (saveAbility) {
        const autoFail = automaticSaveFailure(target, saveAbility);
        const roll = rollD20(target, "save", choice.mode ?? "normal", saveAbility, false, false, die);
        const total = roll.natural + calculateCharacterStats(target).savingThrows[saveAbility] + effectDice(target, "save", die).total;
        const success = !autoFail && total >= progression.saveDC;
        summaries.push(`${target.name}: ${saveAbility} save ${autoFail ? "automatic failure" : `${total} vs DC ${progression.saveDC}`} · ${success ? "saved" : "failed"}`);
        const evasion = saveAbility === "Dexterity" && ["Thunderwave", "Shatter", "Fireball"].includes(automation) && !activeConditions(target).includes("Incapacitated") && ((target.classLevels.Rogue ?? 0) >= 7 || (target.classLevels.Monk ?? 0) >= 7);
        if (evasion) amount = success ? 0 : Math.floor(amount / 2);
        else if (success) amount = automation === "Sacred Flame" ? (subclassIs(caster, "Wizard", "Evok") ? Math.floor(amount / 2) : 0) : Math.floor(amount / 2);
      } else if (result.attack) {
        const ac = calculateCharacterStats(target).armorClass;
        const hit = result.attack.natural !== 1 && (result.attack.critical || result.attack.total >= ac);
        if (!hit) amount = spell.level === 0 && subclassIs(caster, "Wizard", "Evok") ? Math.floor(result.rolledAmount / 2) : 0;
        summaries.push(`${target.name}: attack ${result.attack.total} vs AC ${ac} · ${hit ? "hit" : "miss"}`);
      }
      amount = adjustedDamage(target, amount, choice.defense ?? "normal");
      if (amount > 0 && target.combat?.concentration && typeof target.combat.concentrationDC === "number") throw new Error(`${target.name} must resolve the outstanding concentration check before taking more spell damage.`);
      target = { ...target, ...applyDamage(target, amount, result.attack?.critical ?? false) };
      summaries.push(`${target.name}: ${amount} ${formula?.type ?? ""} damage after save/defenses`);
      if (target.combat?.concentration && target.combat.concentrationDC !== null) {
        const dc = target.combat.concentrationDC;
        const roll = rollD20(target, "save", "normal", "Constitution", activeEffects(target).some((effect) => effect.concentrationAdvantage), false, die);
        const total = roll.natural + calculateCharacterStats(target).savingThrows.Constitution + effectDice(target, "save", die).total;
        const success = total >= dc;
        target = { ...target, combat: { ...target.combat, concentration: success ? target.combat.concentration : "", concentrationDC: null } };
        summaries.push(`${target.name}: concentration save [${roll.rolls.join(", ")}] total ${total} vs DC ${dc} · ${success ? "maintained" : "lost"}`);
      }
    }
    changed.set(target.id, target);
  }
  // Blessed Healer only triggers when healing someone other than yourself.
  if (formula?.kind === "healing" && slotLevel > 0 && selected.some(({ character }) => character.id !== caster.id) && subclassIs(caster, "Cleric", "Life", 6)) {
    nextCaster = changed.get(caster.id)!; changed.set(caster.id, { ...nextCaster, ...healCharacter(nextCaster, 2 + slotLevel) });
  }
  return { characters: [...changed.values()], summary: `${caster.name} casts ${spell.name}. ${result.summary} ${summaries.join("; ")}`.slice(0, 4000) };
}

export function cleanConcentrationEffects(characters: Character[]): Character[] {
  const byId = new Map(characters.map((character) => [character.id, character]));
  return characters.map((character) => {
    const combat = combatState(character);
    const effects = combat.effects.filter((effect) => {
      if (!effect.sourceCharacterId) return true;
      const source = byId.get(effect.sourceCharacterId);
      return !!source?.combat?.concentration && source.combat.concentrationId === effect.sourceConcentrationId && !isIncapacitated(source);
    });
    return effects.length === combat.effects.length ? character : { ...character, combat: { ...combat, effects } };
  });
}
