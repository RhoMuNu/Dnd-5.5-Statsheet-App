import type { Character } from "./characters";
import { calculateCharacterStats } from "./calculations";
import { classProgressionAtLevel } from "./classProgression";
import { SPELL_CATALOG, classLevel, spellFromCatalog, rulesSubclass } from "./rulesCatalog";
import { subclassSpellGrants } from "./subclassSpells";

export function startingSpellLimits(character: Character, name: string) {
  const level = classLevel(character, name), subclass = rulesSubclass(character, name);
  if (level < 1) return { cantrips: 0, spells: 0, prepared: 0, maxLevel: 0 };
  const progression = classProgressionAtLevel(name, level, subclass);
  const maxLevel = Math.max(0, ...calculateCharacterStats({ ...character, characterClass: name, subclass, classLevels: { [name]: level } }).spellSlots.map((slot) => slot.spellLevel));
  const spells = maxLevel === 0 ? 0 : name === "Wizard" ? 6 + 2 * (level - 1) + (subclass === "Evoker" && level >= 3 ? 2 + [5, 7, 9, 11, 13, 15, 17].filter((threshold) => level >= threshold).length : 0) : progression.preparedSpells ?? 0;
  return { cantrips: progression.cantrips ?? 0, spells, prepared: progression.preparedSpells ?? 0, maxLevel };
}

export function startingSpellErrors(character: Character, selections: Record<string, string[]>) {
  const grantedNames = Object.entries(character.rulesChoices ?? {}).filter(([key]) => /:order-cantrip$|:tome-/.test(key)).flatMap(([, values]) => values);
  const classes = Object.keys(character.classLevels ?? {}).length ? Object.keys(character.classLevels) : [character.characterClass];
  const missing = classes.filter((name) => { const limits = startingSpellLimits(character, name); return (limits.cantrips > 0 || limits.spells > 0) && !(name in selections); }).map((name) => `${name}: select starting spells or choose spells later.`);
  return [...missing, ...Object.entries(selections).flatMap(([name, keys]) => {
    const limits = startingSpellLimits(character, name);
    const spells = keys.map((key) => SPELL_CATALOG.find((spell) => spell.key === key));
    const automatic = subclassSpellGrants(rulesSubclass(character, name), classLevel(character, name), name, "starting");
    const errors: string[] = [];
    if (new Set(keys).size !== keys.length || spells.some((spell) => !spell || !spell.classes.includes(name) || spell.level > limits.maxLevel || grantedNames.includes(spell.name) || automatic.some((granted) => granted.catalogKey === spell.key))) errors.push(`${name}: choose only available, distinct class spells; build-granted spells are additional.`);
    if (spells.filter((spell) => spell?.level === 0).length !== limits.cantrips) errors.push(`${name}: choose ${limits.cantrips} cantrips.`);
    if (spells.filter((spell) => spell && spell.level > 0).length !== limits.spells) errors.push(`${name}: choose ${limits.spells} leveled spells.`);
    if (name === "Wizard") {
      // Higher-level starting books still include spells learned at earlier levels.
      for (let spellLevel = 2; spellLevel <= limits.maxLevel; spellLevel++) {
        const earlierLevel = 2 * spellLevel - 2;
        const earlier = startingSpellLimits({ ...character, level: earlierLevel, classLevels: { Wizard: earlierLevel } }, "Wizard");
        if (spells.filter((spell) => spell && spell.level >= spellLevel).length > limits.spells - earlier.spells) errors.push(`Wizard: too many spells of level ${spellLevel} or higher for your starting spellbook.`);
      }
    }
    return errors;
  })];
}

export function createStartingSpells(character: Character, selections: Record<string, string[]>) {
  const errors = startingSpellErrors(character, selections);
  if (errors.length) throw new Error(errors.join(" "));
  return Object.entries(selections).flatMap(([name, keys]) => {
    let prepared = 0;
    const limit = startingSpellLimits(character, name).prepared;
    return [...keys.map((key, index) => {
      const spell = spellFromCatalog(key, `starting-${name}-${index}`, name);
      return { ...spell, prepared: spell.level === 0 || ++prepared <= limit };
    }), ...subclassSpellGrants(rulesSubclass(character, name), classLevel(character, name), name, `starting-${name}`)];
  });
}
