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
  currentHitPoints: number | null;
  temporaryHitPoints: number;
  combat?: CombatState;
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
  abilityScoreOverrides?: Partial<Record<AbilityName, number>>;
  creationDetails?: CharacterCreationDetails;
  features: CharacterFeature[];
  inventory: CharacterInventory;
  spells: CharacterSpell[];
  notes: CharacterNotes;
  createdAt: string;
  updatedAt: string;
};

export type CustomResource = { id: string; name: string; maxUses: number; used: number; recovery: "short-one" | "short-all" | "long" | "manual" };

export type CombatState = {
  deathSuccesses: number;
  deathFailures: number;
  stable: boolean;
  dead: boolean;
  hitDiceUsed: Record<string, number>;
  concentration: string;
  concentrationDC: number | null;
};

export function defaultCombatState(): CombatState {
  return { deathSuccesses: 0, deathFailures: 0, stable: false, dead: false, hitDiceUsed: {}, concentration: "", concentrationDC: null };
}

export type CharacterDraft = Omit<Character, "id" | "createdAt" | "updatedAt">;
export type CharacterFeature = { id: string; name: string; category: "class" | "species" | "feat" | "other"; description: string };
export type InventoryCurrency = { cp: number; sp: number; ep: number; gp: number; pp: number };
export type InventoryItem = { id: string; name: string; quantity: number; weight: number; category: string; equipped: boolean; notes: string };
export type CharacterInventory = { items: InventoryItem[]; currency: InventoryCurrency; startingKitsAdded: boolean };
export type CharacterSpell = { id: string; name: string; level: number; school: string; castingTime: string; range: string; components: string; concentration: boolean; description: string; prepared: boolean };
export type CharacterNotes = { backstory: string; entries: { id: string; title: string; body: string; createdAt: string; updatedAt: string }[] };
export type CharacterCreationDetails = {
  abilityMethod: "standard" | "point-buy" | "manual" | "rolled";
  baseAbilityScores: Record<AbilityName, number>;
  backgroundAbilityBoosts: Partial<Record<AbilityName, 0 | 1 | 2>>;
  classSkills: SkillName[];
  languages: string[];
  toolProficiency: string;
  classToolProficiency: string;
  equipmentChoice: "A" | "B" | "gold";
  classEquipment: string;
  classEquipmentOption: "A" | "B" | "C" | "custom";
  classChoices: string;
  appearance: string;
  abilityScoreOverrides?: Partial<Record<AbilityName, number>>;
  speciesSkillProficiency?: SkillName;
};
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
  "currentHitPoints" |
  "temporaryHitPoints" |
  "unarmoredDefenseChoice" |
  "abilityScores" | "savingThrowProficiencies" | "skillProficiencies" | "size" | "speedFeet" |
  "otherSpeedBonus" |
  "powerfulBuild" | "armorMode" | "armorBaseAC" | "hasShield" | "otherAcBonus" |
  "armorStrengthRequirement" | "spellcastingAbility" | "features" | "inventory" | "spells" | "notes"
> {
  return {
    subclass: "",
    classLevels: {},
    classSubclasses: {},
    resourceUses: {},
    customResources: [],
    currentHitPoints: null,
    temporaryHitPoints: 0,
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
    features: [],
    inventory: { items: [], currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, startingKitsAdded: false },
    spells: [],
    notes: { backstory: "", entries: [] },
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
    currentHitPoints: Number.isFinite(character.currentHitPoints) ? Math.max(0, Math.trunc(character.currentHitPoints!)) : null,
    temporaryHitPoints: Number.isFinite(character.temporaryHitPoints) ? Math.max(0, Math.trunc(character.temporaryHitPoints!)) : 0,
    combat: normalizeCombatState(character.combat),
    subclass: character.subclass ?? "",
    classLevels: character.classLevels && Object.keys(character.classLevels).length
      ? character.classLevels
      : character.characterClass ? { [character.characterClass]: character.level } : {},
    classSubclasses: character.classSubclasses && Object.keys(character.classSubclasses).length
      ? character.classSubclasses
      : character.characterClass && character.subclass ? { [character.characterClass]: character.subclass } : {},
    unarmoredDefenseChoice: character.unarmoredDefenseChoice ?? "",
    abilityScores: { ...defaults.abilityScores, ...character.abilityScores },
    abilityScoreOverrides: normalizeAbilityScoreOverrides(character.abilityScoreOverrides),
    savingThrowProficiencies: { ...defaults.savingThrowProficiencies, ...character.savingThrowProficiencies },
    skillProficiencies: { ...defaults.skillProficiencies, ...character.skillProficiencies },
    creationDetails: normalizeCreationDetails(character.creationDetails),
    features: Array.isArray(character.features) ? character.features.filter(isCharacterFeature) : [],
    inventory: normalizeInventory(character.inventory),
    spells: Array.isArray(character.spells) ? character.spells.filter(isCharacterSpell) : [],
    notes: normalizeNotes(character.notes),
  };
}

function normalizeCombatState(value: unknown): CombatState {
  const state = value && typeof value === "object" ? value as Partial<CombatState> : {};
  const count = (value: unknown, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.trunc(value))) : 0;
  return {
    deathSuccesses: count(state.deathSuccesses, 3), deathFailures: count(state.deathFailures, 3),
    stable: state.stable === true, dead: state.dead === true,
    hitDiceUsed: Object.fromEntries(Object.entries(state.hitDiceUsed && typeof state.hitDiceUsed === "object" ? state.hitDiceUsed : {}).map(([key, used]) => [key, count(used, 20)])),
    concentration: typeof state.concentration === "string" ? state.concentration.slice(0, 100) : "",
    concentrationDC: typeof state.concentrationDC === "number" && Number.isFinite(state.concentrationDC) ? Math.max(10, Math.min(30, Math.trunc(state.concentrationDC))) : null,
  };
}

function isCharacterFeature(value: unknown): value is CharacterFeature {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CharacterFeature>;
  return typeof item.id === "string" && typeof item.name === "string"
    && ["class", "species", "feat", "other"].includes(item.category ?? "")
    && typeof item.description === "string";
}

function isInventoryItem(value: unknown): value is InventoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<InventoryItem>;
  return typeof item.id === "string" && typeof item.name === "string"
    && Number.isInteger(item.quantity) && (item.quantity ?? 0) >= 0
    && Number.isFinite(item.weight) && (item.weight ?? -1) >= 0
    && typeof item.category === "string" && typeof item.equipped === "boolean"
    && typeof item.notes === "string";
}

function isCharacterSpell(value: unknown): value is CharacterSpell {
  if (!value || typeof value !== "object") return false;
  const spell = value as Partial<CharacterSpell>;
  return typeof spell.id === "string" && typeof spell.name === "string"
    && Number.isInteger(spell.level) && (spell.level ?? -1) >= 0 && (spell.level ?? 10) <= 9
    && typeof spell.school === "string" && typeof spell.castingTime === "string"
    && typeof spell.range === "string" && typeof spell.components === "string"
    && typeof spell.concentration === "boolean" && typeof spell.description === "string"
    && typeof spell.prepared === "boolean";
}

function normalizeInventory(value: unknown): CharacterInventory {
  const defaults: CharacterInventory = { items: [], currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, startingKitsAdded: false };
  if (!value || typeof value !== "object") return defaults;
  const inventory = value as Partial<CharacterInventory>;
  const currency = inventory.currency && typeof inventory.currency === "object" ? inventory.currency as Partial<InventoryCurrency> : {};
  return {
    items: Array.isArray(inventory.items) ? inventory.items.filter(isInventoryItem) : [],
    currency: Object.fromEntries((Object.keys(defaults.currency) as (keyof InventoryCurrency)[]).map((key) => [key, Math.max(0, Math.trunc(Number(currency[key]) || 0))])) as InventoryCurrency,
    startingKitsAdded: inventory.startingKitsAdded === true,
  };
}

function normalizeNotes(value: unknown): CharacterNotes {
  if (!value || typeof value !== "object") return { backstory: "", entries: [] };
  const notes = value as Partial<CharacterNotes>;
  return {
    backstory: typeof notes.backstory === "string" ? notes.backstory : "",
    entries: Array.isArray(notes.entries) ? notes.entries.filter((entry) => entry && typeof entry.id === "string" && typeof entry.title === "string" && typeof entry.body === "string" && typeof entry.createdAt === "string" && typeof entry.updatedAt === "string") : [],
  };
}

function normalizeAbilityScoreOverrides(value: unknown): Partial<Record<AbilityName, number>> {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>).filter(([key, score]) => ABILITIES.includes(key as AbilityName) && Number.isInteger(score) && Number(score) >= 1 && Number(score) <= 30);
  return Object.fromEntries(entries) as Partial<Record<AbilityName, number>>;
}

function normalizeCreationDetails(value: unknown): CharacterCreationDetails | undefined {
  if (!value || typeof value !== "object") return undefined;
  const details = value as Partial<CharacterCreationDetails>;
  const abilityMethod = ["standard", "point-buy", "manual", "rolled"].includes(details.abilityMethod ?? "") ? details.abilityMethod! : "manual";
  const baseAbilityScores = Object.fromEntries(ABILITIES.map((ability) => {
    const score = Number(details.baseAbilityScores?.[ability]);
    return [ability, Number.isInteger(score) ? Math.min(30, Math.max(1, score)) : 10];
  })) as Record<AbilityName, number>;
  const boosts = normalizeAbilityScoreOverrides(details.backgroundAbilityBoosts);
  const backgroundAbilityBoosts = Object.fromEntries(Object.entries(boosts).map(([ability, score]) => [ability, Math.min(2, score) as 0 | 1 | 2])) as Partial<Record<AbilityName, 0 | 1 | 2>>;
  const classSkills = Array.isArray(details.classSkills) ? details.classSkills.filter((skill): skill is SkillName => SKILLS.some((entry) => entry.name === skill)).slice(0, 18) : [];
  const languages = Array.isArray(details.languages) ? details.languages.filter((language): language is string => typeof language === "string").slice(0, 12) : ["Common"];
  const equipmentChoice = ["A", "B", "gold"].includes(details.equipmentChoice ?? "") ? details.equipmentChoice! : "A";
  const classEquipmentOption = ["A", "B", "C", "custom"].includes(details.classEquipmentOption ?? "") ? details.classEquipmentOption! : "A";
  return {
    abilityMethod,
    baseAbilityScores,
    backgroundAbilityBoosts,
    classSkills,
    languages,
    toolProficiency: typeof details.toolProficiency === "string" ? details.toolProficiency.slice(0, 120) : "",
    classToolProficiency: typeof details.classToolProficiency === "string" ? details.classToolProficiency.slice(0, 120) : "",
    equipmentChoice,
    classEquipment: typeof details.classEquipment === "string" ? details.classEquipment.slice(0, 300) : "",
    classEquipmentOption,
    classChoices: typeof details.classChoices === "string" ? details.classChoices.slice(0, 300) : "",
    appearance: typeof details.appearance === "string" ? details.appearance.slice(0, 200) : "",
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
