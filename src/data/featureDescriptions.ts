import type { Character } from "./characters";
import { BACKGROUNDS } from "./creationOptions";
import { CLASS_CATALOG, FEAT_CATALOG, SPELL_CATALOG, classLevel, gainedRuleFeatures, subclassOf } from "./rulesCatalog";
import speciesCatalog from "./speciesCatalog.json" with { type: "json" };
import { ORIGIN_REFERENCES } from "./abilityReferences";

const normalize = (name: string) => name.trim().toLowerCase().replace(/[’']/g, "").replace(/ feat$/, "").replace(/\s*\([^)]*\)$/, "").replace(/\.$/, "");
export const SPECIES_CATALOG = speciesCatalog;
export function speciesReference(character: Character) {
  const aliases: Record<string, string> = { "high elf": "Elf", "wood elf": "Elf", drow: "Elf", "forest gnome": "Gnome", "rock gnome": "Gnome" };
  return SPECIES_CATALOG.find((entry) => normalize(entry.name) === normalize(aliases[normalize(character.species)] ?? character.species));
}
export function speciesFeatureDescriptions(character: Character) {
  const species = speciesReference(character);
  const level = Object.values(character.classLevels ?? {}).reduce((sum, value) => sum + value, 0) || character.level;
  const selected = character.species.match(/\((.*)\)/)?.[1] ?? (species && normalize(character.species) !== normalize(species.name) ? character.species : undefined);
  return (species?.traits ?? []).filter((trait) => trait.minimumLevel <= level).map((trait) => {
    let description = trait.description;
    if (selected && /lineage|ancestry|legacy/i.test(trait.name)) description += "\n\nRecorded lineage / ancestry: " + selected + ".";
    if (["Skillful", "Keen Senses"].includes(trait.name) && character.creationDetails?.speciesSkillProficiency) description += "\n\nChosen skill: " + character.creationDetails.speciesSkillProficiency + ".";
    return { ...trait, description, source: species!.name };
  });
}

export function featureDescription(name: string, character?: Character): string {
  const saved = character?.features.find((feature) => normalize(feature.name) === normalize(name) && feature.description.trim());
  if (saved) return saved.description;
  const feat = FEAT_CATALOG.find((entry) => normalize(entry.name) === normalize(name));
  if (feat) return feat.description;
  const origin = Object.entries(ORIGIN_REFERENCES).find(([key]) => normalize(key) === normalize(name));
  if (origin) return origin[1];
  const species = character ? speciesReference(character) : undefined;
  const trait = species?.traits.find((entry) => normalize(entry.name) === normalize(name));
  if (trait) return speciesFeatureDescriptions(character!).find((entry) => entry.name === trait.name)?.description ?? trait.description;
  const catalogs = character ? CLASS_CATALOG.filter((entry) => classLevel(character, entry.subclass_of?.name ?? entry.name) > 0 && (!entry.subclass_of || normalize(subclassOf(character, entry.subclass_of.name)) === normalize(entry.name))) : CLASS_CATALOG;
  for (const catalog of catalogs) for (const feature of catalog.features) {
    if (normalize(feature.name) === normalize(name) && feature.desc.trim() !== "[Column data]") return feature.desc;
    for (const section of feature.desc.split(/(?=^#{2,4} )/m)) {
      const heading = section.match(/^#{2,4} (.+)\n/);
      if (heading && normalize(heading[1].replaceAll("*", "")) === normalize(name)) return section.slice(heading[0].length).trim();
    }
    for (const paragraph of feature.desc.split(/\n\n(?=\*\*)/)) {
      const heading = paragraph.match(/^\*\*([^*]+)\*\*\.?\s*/);
      if (heading && normalize(heading[1]) === normalize(name)) return paragraph.slice(heading[0].length).trim();
    }
  }
  return "";
}

export function characterRuleFeatures(character: Character) {
  const levels = Object.keys(character.classLevels ?? {}).length ? character.classLevels : { [character.characterClass]: character.level };
  const features = Object.entries(levels).flatMap(([name, level]) => Array.from({ length: level }, (_, index) => index + 1).flatMap((index) => gainedRuleFeatures(name, index, subclassOf(character, name)).map((feature) => ({ ...feature, level: index }))));
  return [...new Map(features.filter((feature) => feature.description.trim() && feature.description !== "[Column data]").map((feature) => [feature.source + feature.level + feature.name, feature])).values()];
}

export function originDescriptions(character: Character) {
  const feat = BACKGROUNDS[character.background]?.feat;
  return [
    ...(feat ? [{ name: feat, source: character.background + " background", description: featureDescription(feat, character) }] : []),
    ...speciesFeatureDescriptions(character),
  ];
}

export function buildChoiceDescriptions(character: Character) {
  const recorded = (character.creationDetails?.classChoices ?? "").split(/[,;\n]/).map((choice) => choice.trim()).filter(Boolean).map((choice) => { const name = choice.replace(/^[^:]+:\s*/, ""); return { name, source: character.characterClass + " · Recorded class choice", description: featureDescription(name, character) || "No bundled rules match this custom choice. Add its description under Your features." }; });
  return [...recorded, ...Object.entries(character.rulesChoices ?? {}).flatMap(([key, choices]) => choices.map((choice) => {
    const parts = key.split(":"), kind = parts[1] ?? key;
    const parent = /expertise/i.test(kind) ? "Expertise" : /scholar/i.test(kind) ? "Scholar" : /skilled/i.test(kind) ? "Skilled" : /lore-skills/i.test(kind) ? "Bonus Proficiencies" : parts[0] === "feat" ? kind : kind.replaceAll("-", " ");
    const description = featureDescription(choice, character) || featureDescription(parent, character);
    return { name: choice, source: parts[0] + " · " + parent, description: description || "No bundled rules match this custom choice. Add its description under Your features." };
  }))];
}

export function referencedSpells(description: string) {
  const cells = description.split("|").map((cell) => cell.trim().toLowerCase());
  return SPELL_CATALOG.filter((spell) => description.includes("*" + spell.name + "*") || description.toLowerCase().includes(spell.name.toLowerCase() + " cantrip") || description.toLowerCase().includes(spell.name.toLowerCase() + " spell") || cells.includes(spell.name.toLowerCase()));
}
