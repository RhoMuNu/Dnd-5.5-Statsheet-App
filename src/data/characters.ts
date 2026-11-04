export type Character = {
  id: string;
  name: string;
  concept: string;
  species: string;
  characterClass: string;
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
  "abilityScores" | "savingThrowProficiencies" | "skillProficiencies" | "size" | "speedFeet" |
  "otherSpeedBonus" |
  "powerfulBuild" | "armorMode" | "armorBaseAC" | "hasShield" | "otherAcBonus" |
  "armorStrengthRequirement" | "spellcastingAbility"
> {
  return {
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
    return value.filter(isBaseCharacter).map((character) => ({
      ...defaultCharacterStats(),
      ...character,
      abilityScores: { ...defaultCharacterStats().abilityScores, ...character.abilityScores },
      savingThrowProficiencies: { ...defaultCharacterStats().savingThrowProficiencies, ...character.savingThrowProficiencies },
      skillProficiencies: { ...defaultCharacterStats().skillProficiencies, ...character.skillProficiencies },
    }));
  } catch {
    return [];
  }
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
    && typeof character.background === "string"
    && typeof character.level === "number"
    && typeof character.createdAt === "string"
    && typeof character.updatedAt === "string";
}
