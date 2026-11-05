import type { Character } from "./characters";
import { BACKGROUNDS, SPECIES } from "./creationOptions";
import { CLASS_CATALOG, FEAT_CATALOG, classLevel, gainedRuleFeatures, subclassOf } from "./rulesCatalog";

const normalize = (name: string) => name.trim().toLowerCase().replace(/ feat$/, "").replace(/\s*\([^)]*\)$/, "");

export function featureDescription(name: string, character?: Character): string {
  const feat = FEAT_CATALOG.find((entry) => normalize(entry.name) === normalize(name));
  if (feat) return feat.description;
  const catalogs = character ? CLASS_CATALOG.filter((entry) => classLevel(character, entry.subclass_of?.name ?? entry.name) > 0 && (!entry.subclass_of || subclassOf(character, entry.subclass_of.name) === entry.name)) : CLASS_CATALOG;
  return catalogs.flatMap((entry) => entry.features.map((feature: { name: string; desc: string }) => ({ name: feature.name, desc: feature.desc }))).find((entry) => normalize(entry.name) === normalize(name))?.desc ?? "";
}

export function characterRuleFeatures(character: Character) {
  const levels = Object.keys(character.classLevels ?? {}).length ? character.classLevels : { [character.characterClass]: character.level };
  return Object.entries(levels).flatMap(([name, level]) => Array.from({ length: level }, (_, index) => index + 1).flatMap((index) => gainedRuleFeatures(name, index, subclassOf(character, name)).map((feature) => ({ ...feature, level: index }))));
}

export function originDescriptions(character: Character) {
  const feat = BACKGROUNDS[character.background]?.feat;
  const species = character.species.split(" (")[0];
  return [
    ...(feat ? [{ name: feat, description: featureDescription(feat) || "This background grants this origin feat. Enter its rules below if it is outside the included catalog." }] : []),
    ...(SPECIES[species] ? [{ name: `${character.species} traits`, description: SPECIES[species].note }] : []),
  ];
}
