export type Character = {
  id: string;
  name: string;
  concept: string;
  species: string;
  characterClass: string;
  subclass: string;
  classLevels: Record<string, number>;
  classSubclasses: Record<string, string>;
  resourceUses: Record<string, number>;
  customResources: CustomResource[];
  unarmoredDefenseChoice: "Barbarian" | "Monk" | "";
  background: string;
  level: number;
  abilityScores: Record<AbilityName, number>;
  savingThrowProficiencies: Record<AbilityName, boolean>;
  skillProficiencies: Record<SkillName, 0 | 1 | 2>;
  size: CreatureSize;
  speedFeet: number;
  otherSpeedBonus: number;
  powerfulBuild: boolean;
  armorMode: ArmorMode;
  armorBaseAC: number;
  hasShield: boolean;
  otherAcBonus: number;
  armorStrengthRequirement: number;
  spellcastingAbility: AbilityName | "";
  createdAt: string;
  updatedAt: string;
};

export type CustomResource = { id: string; name: string; maxUses: number; used: number; recovery: "short-one" | "short-all" | "long" | "manual" };

export type CharacterDraft = Omit<Character, "id" | "createdAt" | "updatedAt">;
export type AbilityName = "Strength" | "Dexterity" | "Constitution" | "Intelligence" | "Wisdom" | "Charisma";
export type SkillName =
  | "Acrobatics" | "Animal Handling" | "Arcana" | "Athletics" | "Deception" | "History"
  | "Insight" | "Intimidation" | "Investigation" | "Medicine" | "Nature" | "Perception"
  | "Performance" | "Persuasion" | "Religion" | "Sleight of Hand" | "Stealth" | "Survival";
export type CreatureSize = "Tiny" | "Small" | "Medium" | "Large" | "Huge" | "Gargantuan";
export type ArmorMode = "unarmored" | "light" | "medium" | "heavy" | "custom";

export const ABILITIES: AbilityName[] = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

export const CLASSES = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"] as const;

export const SKILLS: { name: SkillName; ability: AbilityName }[] = [
  { name: "Acrobatics", ability: "Dexterity" },
  { name: "Animal Handling", ability: "Wisdom" },
  { name: "Arcana", ability: "Intelligence" },
  { name: "Athletics", ability: "Strength" },
  { name: "Deception", ability: "Charisma" },
  { name: "History", ability: "Intelligence" },
  { name: "Insight", ability: "Wisdom" },
  { name: "Intimidation", ability: "Charisma" },
  { name: "Investigation", ability: "Intelligence" },
  { name: "Medicine", ability: "Wisdom" },
  { name: "Nature", ability: "Intelligence" },
  { name: "Perception", ability: "Wisdom" },
  { name: "Performance", ability: "Charisma" },
  { name: "Persuasion", ability: "Charisma" },
  { name: "Religion", ability: "Intelligence" },
  { name: "Sleight of Hand", ability: "Dexterity" },
  { name: "Stealth", ability: "Dexterity" },
  { name: "Survival", ability: "Wisdom" },
];

export function defaultCharacterStats(): Pick<Character,
  "subclass" |
  "classLevels" |
  "classSubclasses" |
  "resourceUses" |
  "customResources" |
  "unarmoredDefenseChoice" |
  "abilityScores" | "savingThrowProficiencies" | "skillProficiencies" | "size" | "speedFeet" |
  "otherSpeedBonus" |
  "powerfulBuild" | "armorMode" | "armorBaseAC" | "hasShield" | "otherAcBonus" |
  "armorStrengthRequirement" | "spellcastingAbility"
> {
  return {
    subclass: "",
    classLevels: {},
    classSubclasses: {},
    resourceUses: {},
    customResources: [],
    unarmoredDefenseChoice: "",
    abilityScores: Object.fromEntries(ABILITIES.map((ability) => [ability, 10])) as Record<AbilityName, number>,
    savingThrowProficiencies: Object.fromEntries(ABILITIES.map((ability) => [ability, false])) as Record<AbilityName, boolean>,
    skillProficiencies: Object.fromEntries(SKILLS.map((skill) => [skill.name, 0])) as Record<SkillName, 0 | 1 | 2>,
    size: "Medium",
    speedFeet: 30,
    otherSpeedBonus: 0,
    powerfulBuild: false,
    armorMode: "unarmored",
    armorBaseAC: 10,
    hasShield: false,
    otherAcBonus: 0,
    armorStrengthRequirement: 0,
    spellcastingAbility: "",
  };
}

const CHARACTERS_KEY = "taleforge.characters.v1";
const ACTIVE_CHARACTER_KEY = "taleforge.activeCharacter.v1";

export function loadCharacters(): Character[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CHARACTERS_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.map(normalizeCharacter).filter((character): character is Character => character !== null);
  } catch {
    return [];
  }
}

export function normalizeCharacter(value: unknown): Character | null {
  if (!isBaseCharacter(value)) return null;
  const character = value as Character;
  const defaults = defaultCharacterStats();
  return {
    ...defaults,
    ...character,
    resourceUses: character.resourceUses ?? {},
    customResources: Array.isArray(character.customResources) ? character.customResources.filter(isCustomResource).map((resource) => ({ ...resource, used: Math.min(Math.trunc(resource.maxUses), Math.max(0, Math.trunc(resource.used))) })) : [],
    subclass: character.subclass ?? "",
    classLevels: character.classLevels && Object.keys(character.classLevels).length
      ? character.classLevels
      : character.characterClass ? { [character.characterClass]: character.level } : {},
    classSubclasses: character.classSubclasses && Object.keys(character.classSubclasses).length
      ? character.classSubclasses
      : character.characterClass && character.subclass ? { [character.characterClass]: character.subclass } : {},
    unarmoredDefenseChoice: character.unarmoredDefenseChoice ?? "",
    abilityScores: { ...defaults.abilityScores, ...character.abilityScores },
    savingThrowProficiencies: { ...defaults.savingThrowProficiencies, ...character.savingThrowProficiencies },
    skillProficiencies: { ...defaults.skillProficiencies, ...character.skillProficiencies },
  };
}

function isCustomResource(value: unknown): value is CustomResource {
  if (!value || typeof value !== "object") return false;
  const resource = value as Partial<CustomResource>;
  return typeof resource.id === "string" && typeof resource.name === "string"
    && typeof resource.maxUses === "number" && Number.isFinite(resource.maxUses) && resource.maxUses > 0
    && typeof resource.used === "number" && Number.isFinite(resource.used)
    && ["short-one", "short-all", "long", "manual"].includes(resource.recovery ?? "");
}

export function saveCharacters(characters: Character[]): boolean {
  try {
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify(characters));
    return true;
  } catch {
    return false;
  }
}

export function loadActiveCharacterId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CHARACTER_KEY);
  } catch {
    return null;
  }
}

export function saveActiveCharacterId(id: string | null): boolean {
  try {
    if (id) localStorage.setItem(ACTIVE_CHARACTER_KEY, id);
    else localStorage.removeItem(ACTIVE_CHARACTER_KEY);
    return true;
  } catch {
    return false;
  }
}

export function makeCharacterId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isBaseCharacter(value: unknown): value is Omit<Character, keyof ReturnType<typeof defaultCharacterStats>> & Partial<ReturnType<typeof defaultCharacterStats>> {
  if (!value || typeof value !== "object") return false;
  const character = value as Partial<Character>;
  return typeof character.id === "string"
    && typeof character.name === "string"
    && typeof character.concept === "string"
    && typeof character.species === "string"
    && typeof character.characterClass === "string"
    && (character.subclass === undefined || typeof character.subclass === "string")
    && (character.classLevels === undefined || (typeof character.classLevels === "object" && character.classLevels !== null))
    && (character.classSubclasses === undefined || (typeof character.classSubclasses === "object" && character.classSubclasses !== null))
    && (character.unarmoredDefenseChoice === undefined || character.unarmoredDefenseChoice === "" || character.unarmoredDefenseChoice === "Barbarian" || character.unarmoredDefenseChoice === "Monk")
    && typeof character.background === "string"
    && typeof character.level === "number"
    && typeof character.createdAt === "string"
    && typeof character.updatedAt === "string";
}
