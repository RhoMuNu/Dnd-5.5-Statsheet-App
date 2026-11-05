import spells from "./spellCatalog.json" with { type: "json" };
import classes from "./classCatalog.json" with { type: "json" };
import feats from "./featCatalog.json" with { type: "json" };
import type { Character, CharacterSpell } from "./characters";

export const SPELL_CATALOG = spells;
export const CLASS_CATALOG = classes;
export const findSpellByName = (name: string) => SPELL_CATALOG.find((spell) => spell.name.toLowerCase() === name.trim().toLowerCase());
export const FEAT_CATALOG = [...feats, ...[
  ["Tough", "Origin", "", "Gain 2 maximum HP per character level."],
  ["War Caster", "General", "Level 4+, Spellcasting or Pact Magic Feature", "+1 Intelligence, Wisdom, or Charisma. Advantage on saves to maintain concentration. Spell reactions and occupied hands still require their normal conditions."],
  ["Resilient", "General", "Level 4+", "+1 to one ability score and proficiency in that ability’s saving throws."],
  ["Speedy", "General", "Level 4+, Dexterity or Constitution 13+", "+1 Dexterity or Constitution; +10 feet speed. Other movement benefits depend on the situation."],
].map(([name, type, prerequisite, description]) => ({ key: name.toLowerCase().replaceAll(" ", "-"), name, type, prerequisite, description }))];

export function spellFromCatalog(key: string, id: string, className: string): CharacterSpell {
  const spell = SPELL_CATALOG.find((entry) => entry.key === key);
  if (!spell) throw new Error("Unknown spell selection.");
  const automated = ["Cure Wounds", "Healing Word", "Fire Bolt", "Sacred Flame", "Guiding Bolt", "Thunderwave", "Shatter", "Fireball", "Bless", "Bane", "Shield"];
  return { id, name: spell.name, level: spell.level, school: spell.school, castingTime: spell.castingTime, range: spell.range, components: spell.components, concentration: spell.concentration, description: spell.description, prepared: true, className, catalogKey: key, automation: automated.includes(spell.name) ? spell.name : "" };
}
export function classLevel(character: Character, name: string): number {
  const entry = Object.entries(character.classLevels ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? (character.characterClass.toLowerCase() === name.toLowerCase() ? character.level : 0);
}
export function subclassOf(character: Character, name: string): string {
  return character.classSubclasses?.[name] ?? (character.characterClass === name ? character.subclass : "");
}
export function subclassIs(character: Character, name: string, part: string, minimum = 3) {
  return classLevel(character, name) >= minimum && subclassOf(character, name).toLowerCase().includes(part.toLowerCase());
}
export function gainedRuleFeatures(className: string, level: number, subclass: string) {
  return CLASS_CATALOG.filter((entry) => entry.name.toLowerCase() === className.toLowerCase() || (entry.name.toLowerCase() === subclass.toLowerCase() && entry.subclass_of?.name.toLowerCase() === className.toLowerCase()))
    .flatMap((entry) => entry.features.filter((feature) => feature.feature_type === "CLASS_LEVEL_FEATURE" && feature.gained_at.some((gain) => gain.level === level)).map((feature) => ({ name: feature.name, description: feature.desc, source: entry.name })));
}
