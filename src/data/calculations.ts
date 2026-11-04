import type { AbilityName, Character, CreatureSize, SkillName } from "./characters";
import { SKILLS } from "./characters";
import { classProgressionAtLevel } from "./classProgression";

const HIT_DICE: Record<string, number> = {
  barbarian: 12,
  fighter: 10,
  paladin: 10,
  ranger: 10,
  bard: 8,
  cleric: 8,
  druid: 8,
  monk: 8,
  rogue: 8,
  warlock: 8,
  sorcerer: 6,
  wizard: 6,
};

const CLASS_SAVE_PROFICIENCIES: Record<string, AbilityName[]> = {
  barbarian: ["Strength", "Constitution"], bard: ["Dexterity", "Charisma"],
  cleric: ["Wisdom", "Charisma"], druid: ["Intelligence", "Wisdom"],
  fighter: ["Strength", "Constitution"], monk: ["Strength", "Dexterity"],
  paladin: ["Wisdom", "Charisma"], ranger: ["Strength", "Dexterity"],
  rogue: ["Dexterity", "Intelligence"], sorcerer: ["Constitution", "Charisma"],
  warlock: ["Wisdom", "Charisma"], wizard: ["Intelligence", "Wisdom"],
};

const CLASS_SPELLCASTING_ABILITIES: Record<string, AbilityName> = {
  bard: "Charisma", cleric: "Wisdom", druid: "Wisdom", paladin: "Charisma",
  ranger: "Wisdom", sorcerer: "Charisma", warlock: "Charisma", wizard: "Intelligence",
};

const SIZE_MULTIPLIER: Record<CreatureSize, number> = {
  Tiny: 7.5,
  Small: 15,
  Medium: 15,
  Large: 30,
  Huge: 60,
  Gargantuan: 120,
};

export type CalculatedStats = {
  totalLevel: number;
  classBreakdown: { name: string; level: number; hitDie: number }[];
  proficiencyBonus: number;
  abilityModifiers: Record<AbilityName, number>;
  savingThrows: Record<AbilityName, number>;
  skillBonuses: Record<SkillName, number>;
  passivePerception: number;
  initiative: number;
  armorClass: number;
  maxHitPoints: number | null;
  hitDie: number | null;
  speed: number;
  carryingCapacity: number;
  pushDragLift: number;
  effectiveSize: CreatureSize;
  spellSaveDC: number | null;
  spellAttackBonus: number | null;
  spellSlots: { spellLevel: number; total: number; pool: string }[];
  spellSlotRecovery: "Long Rest" | "Short or Long Rest";
  appliedClassFeatures: string[];
  classResources: { label: string; value: string }[];
  classFeatures: { level: number; name: string }[];
  cantrips: number | null;
  preparedSpellCount: number | null;
  spellCountLabel: string | null;
  spellcastingProgressions: { className: string; cantrips: number | null; count: number | null; label: string | null; saveDC: number; attackBonus: number }[];
  multiclassWarnings: string[];
};

const FULL_CASTER_SLOTS: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const WARLOCK_SLOT_COUNTS = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
const WARLOCK_SLOT_LEVELS = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

/** Formulas follow the free 2024 rules: https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game and /creating-a-character. */
export function calculateCharacterStats(character: Character): CalculatedStats {
  const classes = getClassLevels(character);
  const level = clamp(classes.reduce((sum, entry) => sum + entry.level, 0) || Math.trunc(character.level), 1, 20);
  const primaryClass = character.characterClass.trim().toLowerCase();
  const proficiencyBonus = Math.floor((level - 1) / 4) + 2;
  const abilityModifiers = Object.fromEntries(
    Object.entries(character.abilityScores).map(([ability, score]) => [ability, Math.floor((score - 10) / 2)]),
  ) as Record<AbilityName, number>;

  const savingThrows = Object.fromEntries(
    Object.entries(abilityModifiers).map(([ability, modifier]) => [
      ability,
      modifier + (isSavingThrowProficient(character, ability as AbilityName) ? proficiencyBonus : 0),
    ]),
  ) as Record<AbilityName, number>;

  const skillBonuses = Object.fromEntries(SKILLS.map(({ name, ability }) => {
    const rank = character.skillProficiencies[name] ?? 0;
    return [name, abilityModifiers[ability] + proficiencyBonus * rank];
  })) as Record<SkillName, number>;

  const className = primaryClass;
  const progression = classes.flatMap(({ name, level: classLevel }) => classProgressionAtLevel(name, classLevel, character.classSubclasses?.[capitalize(name)] ?? (name === primaryClass ? character.subclass : "")).gainedFeatures.map((feature) => ({ ...feature, name: `${capitalize(name)} ${feature.name}` })));
  const dexterityModifier = abilityModifiers.Dexterity;
  let armorBase = character.armorMode === "unarmored" ? 10 + dexterityModifier : character.armorBaseAC + armorDexterity(character, dexterityModifier);
  const appliedClassFeatures: string[] = [];
  const barbarianLevel = classLevelOf(classes, "barbarian");
  const monkLevel = classLevelOf(classes, "monk");
  const defenseChoice = character.unarmoredDefenseChoice || (className === "monk" ? "Monk" : className === "barbarian" ? "Barbarian" : barbarianLevel > 0 ? "Barbarian" : "Monk");
  if (character.armorMode === "unarmored" && barbarianLevel > 0 && defenseChoice === "Barbarian") {
    armorBase = 10 + dexterityModifier + abilityModifiers.Constitution;
    appliedClassFeatures.push("Barbarian Unarmored Defense");
  } else if (character.armorMode === "unarmored" && monkLevel > 0 && !character.hasShield && defenseChoice === "Monk") {
    armorBase = 10 + dexterityModifier + abilityModifiers.Wisdom;
    appliedClassFeatures.push("Monk Unarmored Defense");
  }
  const armorClass = armorBase + (character.hasShield ? 2 : 0) + character.otherAcBonus;
  const hitDie = HIT_DICE[className] ?? null;
  const constitutionModifier = abilityModifiers.Constitution;
  const maxHitPoints = classes.length === 0 ? null : classes.reduce((total, entry) => {
    const average = Math.floor(HIT_DICE[entry.name] / 2) + 1;
    const levels = entry.level - (entry.name === className ? 1 : 0);
    return total + levels * Math.max(1, average + constitutionModifier);
  }, Math.max(1, (HIT_DICE[className] ?? 0) + constitutionModifier));

  const effectiveSize = character.powerfulBuild ? increaseSize(character.size) : character.size;
  const carryingCapacity = character.abilityScores.Strength * SIZE_MULTIPLIER[effectiveSize];
  let classSpeedBonus = 0;
  if (monkLevel >= 2 && character.armorMode === "unarmored" && !character.hasShield) {
    classSpeedBonus = monkLevel >= 18 ? 30 : monkLevel >= 14 ? 25 : monkLevel >= 10 ? 20 : monkLevel >= 6 ? 15 : 10;
    appliedClassFeatures.push(`Monk Unarmored Movement +${classSpeedBonus} ft.`);
  } else if (barbarianLevel >= 5 && character.armorMode !== "heavy") {
    classSpeedBonus = 10;
    appliedClassFeatures.push("Barbarian Fast Movement +10 ft.");
  }
  const armorReducesSpeed = character.armorMode === "heavy"
    && character.armorStrengthRequirement > 0
    && character.abilityScores.Strength < character.armorStrengthRequirement;
  const speed = Math.max(0, character.speedFeet + character.otherSpeedBonus + classSpeedBonus - (armorReducesSpeed ? 10 : 0));
  const spellcastingAbility = character.spellcastingAbility || CLASS_SPELLCASTING_ABILITIES[character.characterClass.trim().toLowerCase()] || "";
  const spellModifier = spellcastingAbility ? abilityModifiers[spellcastingAbility] : null;
  const spellSlots = spellSlotsForClasses(classes, character.classSubclasses ?? { [capitalize(className)]: character.subclass });
  const classResources = classes.flatMap(({ name, level: classLevel }) => classResourcesFor({ ...character, characterClass: capitalize(name) }, classLevel, abilityModifiers).map((resource) => ({ ...resource, label: classes.length > 1 ? `${capitalize(name)} · ${resource.label}` : resource.label })));
  const preparedSpellCount = spellCountFor(className, classes.find((entry) => entry.name === className)?.level ?? level, abilityModifiers);
  const spellcastingProgressions = classes.flatMap(({ name, level: classLevel }) => {
    const classProgression = classProgressionAtLevel(name, classLevel);
    const ability = spellAbilityFor(name, character.classSubclasses?.[capitalize(name)] ?? (name === className ? character.subclass : ""), name === className ? character.spellcastingAbility : "");
    if (!ability) return [];
    const count = spellCountFor(name, classLevel, abilityModifiers);
    return [{ className: capitalize(name), cantrips: classProgression.cantrips, count: count.value, label: count.label, saveDC: 8 + abilityModifiers[ability] + proficiencyBonus, attackBonus: abilityModifiers[ability] + proficiencyBonus }];
  });
  const multiclassWarnings = multiclassPrerequisiteWarnings(classes, character.abilityScores);
  const extraAttackClasses = classes.filter(({ name, level: classLevel }) => classProgressionAtLevel(name, classLevel).gainedFeatures.some(({ name: feature }) => feature === "Extra Attack"));
  if (extraAttackClasses.length > 1) multiclassWarnings.push("Extra Attack features from different classes don’t stack (except features that explicitly grant additional attacks, such as Fighter’s higher-level feature).");

  return {
    totalLevel: level,
    classBreakdown: classes.map(({ name, level: classLevel }) => ({ name: capitalize(name), level: classLevel, hitDie: HIT_DICE[name] })),
    proficiencyBonus,
    abilityModifiers,
    savingThrows,
    skillBonuses,
    passivePerception: 10 + skillBonuses.Perception,
    initiative: dexterityModifier,
    armorClass,
    maxHitPoints,
    hitDie,
    speed,
    carryingCapacity,
    pushDragLift: carryingCapacity * 2,
    effectiveSize,
    spellSaveDC: spellModifier === null ? null : 8 + spellModifier + proficiencyBonus,
    spellAttackBonus: spellModifier === null ? null : spellModifier + proficiencyBonus,
    spellSlots,
    spellSlotRecovery: classes.length === 1 && className === "warlock" ? "Short or Long Rest" : "Long Rest",
    appliedClassFeatures,
    classResources,
    classFeatures: progression,
    cantrips: classProgressionAtLevel(className, classes.find((entry) => entry.name === className)?.level ?? level, character.subclass).cantrips,
    preparedSpellCount: preparedSpellCount.value,
    spellCountLabel: preparedSpellCount.label,
    spellcastingProgressions,
    multiclassWarnings,
  };
}

function spellAbilityFor(className: string, subclass: string, override: AbilityName | ""): AbilityName | null {
  if (override) return override;
  if (CLASS_SPELLCASTING_ABILITIES[className]) return CLASS_SPELLCASTING_ABILITIES[className];
  const subclassName = subclass.toLowerCase();
  if (className === "fighter" && subclassName.includes("eldritch knight")) return "Intelligence";
  if (className === "rogue" && subclassName.includes("arcane trickster")) return "Intelligence";
  return null;
}

function multiclassPrerequisiteWarnings(classes: { name: string; level: number }[], scores: Record<AbilityName, number>): string[] {
  if (classes.length < 2) return [];
  const required: Record<string, AbilityName[]> = {
    barbarian: ["Strength"], bard: ["Charisma"], cleric: ["Wisdom"], druid: ["Wisdom"],
    fighter: ["Strength", "Dexterity"], monk: ["Dexterity", "Wisdom"],
    paladin: ["Strength", "Charisma"], ranger: ["Dexterity", "Wisdom"], rogue: ["Dexterity"],
    sorcerer: ["Charisma"], warlock: ["Charisma"], wizard: ["Intelligence"],
  };
  return classes.flatMap(({ name }) => {
    const abilities = required[name] ?? [];
    const qualifies = name === "fighter" ? abilities.some((ability) => scores[ability] >= 13) : abilities.every((ability) => scores[ability] >= 13);
    return qualifies ? [] : [`Multiclassing requires ${name === "fighter" ? "Strength or Dexterity" : abilities.join(" and ")} 13 or higher.`];
  });
}

function spellCountFor(className: string, level: number, modifiers: Record<AbilityName, number>) {
  if (["cleric", "druid", "wizard"].includes(className)) {
    const actualModifier = className === "cleric" || className === "druid" ? modifiers.Wisdom : modifiers.Intelligence;
    return { value: Math.max(1, level + actualModifier), label: "Prepared spells" };
  }
  if (["paladin", "ranger"].includes(className)) {
    const actualModifier = className === "paladin" ? modifiers.Charisma : modifiers.Wisdom;
    return { value: Math.max(1, Math.floor(level / 2) + actualModifier), label: "Prepared spells" };
  }
  const known = classProgressionAtLevel(className, level).preparedSpells;
  return known === null ? { value: null, label: null } : { value: known, label: "Spells known" };
}

export function isClassSavingThrowProficient(character: Character, ability: AbilityName): boolean {
  return CLASS_SAVE_PROFICIENCIES[character.characterClass.trim().toLowerCase()]?.includes(ability) ?? false;
}

export function isSavingThrowProficient(character: Character, ability: AbilityName): boolean {
  return isClassSavingThrowProficient(character, ability) || character.savingThrowProficiencies[ability];
}

function spellSlotsForClasses(classes: { name: string; level: number }[], subclasses: Record<string, string>): { spellLevel: number; total: number; pool: string }[] {
  const casterLevel = classes.reduce((total, { name, level }) => {
    if (["bard", "cleric", "druid", "sorcerer", "wizard"].includes(name)) return total + level;
    if (["paladin", "ranger"].includes(name)) return total + Math.ceil(level / 2);
    const subclass = subclasses[capitalize(name)]?.toLowerCase() ?? "";
    if ((name === "fighter" && subclass.includes("eldritch knight"))
      || (name === "rogue" && subclass.includes("arcane trickster"))) return total + Math.floor(level / 3);
    return total;
  }, 0);
  const regular = casterLevel > 0 ? slotsFromRow(FULL_CASTER_SLOTS[clamp(casterLevel, 1, 20) - 1]).map((slot) => ({ ...slot, pool: "Spellcasting · Long Rest" })) : [];
  const warlock = classes.find(({ name }) => name === "warlock");
  const pact = warlock ? [{ spellLevel: WARLOCK_SLOT_LEVELS[warlock.level - 1], total: WARLOCK_SLOT_COUNTS[warlock.level - 1], pool: "Pact Magic · Short or Long Rest" }] : [];
  return [...regular, ...pact];
}

function slotsFromRow(row: number[]): { spellLevel: number; total: number }[] {
  return row.flatMap((total, index) => total > 0 ? [{ spellLevel: index + 1, total }] : []);
}

function getClassLevels(character: Character): { name: string; level: number }[] {
  const entries = Object.entries(character.classLevels ?? {})
    .map(([name, level]) => ({ name: name.trim().toLowerCase(), level: clamp(Math.trunc(level), 0, 20) }))
    .filter(({ name, level }) => name && level > 0);
  if (entries.length) return entries;
  return character.characterClass.trim() ? [{ name: character.characterClass.trim().toLowerCase(), level: clamp(Math.trunc(character.level), 1, 20) }] : [];
}

function classLevelOf(classes: { name: string; level: number }[], name: string): number {
  return classes.find((entry) => entry.name === name)?.level ?? 0;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function classResourcesFor(character: Character, level: number, modifiers: Record<AbilityName, number>): { label: string; value: string }[] {
  const className = character.characterClass.trim().toLowerCase();
  switch (className) {
    case "barbarian":
      return [
        { label: "Rage uses", value: String(level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2) },
        { label: "Rage damage", value: `+${level >= 16 ? 4 : level >= 9 ? 3 : 2}` },
        { label: "Weapon Mastery", value: String(level >= 10 ? 4 : level >= 4 ? 3 : 2) },
      ];
    case "bard":
      return [{ label: "Bardic Inspiration", value: `${level >= 15 ? "d12" : level >= 10 ? "d10" : level >= 5 ? "d8" : "d6"} · ${Math.max(1, modifiers.Charisma)} uses` }];
    case "cleric":
      return level >= 2 ? [{ label: "Channel Divinity", value: `${level >= 6 ? 3 : 2} uses` }] : [];
    case "druid":
      return level >= 2 ? [{ label: "Wild Shape", value: `${level >= 17 ? 4 : level >= 6 ? 3 : 2} uses` }] : [];
    case "fighter":
      return [
        { label: "Second Wind", value: `${level >= 10 ? 4 : level >= 4 ? 3 : 2} uses` },
        { label: "Weapon Mastery", value: `${level >= 16 ? 6 : level >= 10 ? 5 : level >= 4 ? 4 : 3} weapons` },
      ];
    case "monk":
      return level >= 2 ? [
        { label: "Focus Points", value: String(level) },
        { label: "Martial Arts die", value: level >= 17 ? "d12" : level >= 11 ? "d10" : level >= 5 ? "d8" : "d6" },
      ] : [{ label: "Martial Arts die", value: "d6" }];
    case "paladin":
      return [
        { label: "Lay On Hands pool", value: `${5 * level} HP` },
        ...(level >= 3 ? [{ label: "Channel Divinity", value: `${level >= 11 ? 3 : 2} uses` }] : []),
      ];
    case "ranger":
      return [{ label: "Favored Enemy", value: `${level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2} free Hunter’s Mark casts` }];
    case "rogue":
      return [{ label: "Sneak Attack", value: `${Math.ceil(level / 2)}d6` }];
    case "sorcerer":
      return [
        { label: "Innate Sorcery", value: "2 uses" },
        ...(level >= 2 ? [{ label: "Sorcery Points", value: String(level) }] : []),
      ];
    case "warlock": {
      const invocations = [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10][level - 1];
      return [{ label: "Eldritch Invocations", value: String(invocations) }];
    }
    case "wizard":
      return [{ label: "Arcane Recovery", value: `Recover spell slots totaling up to ${Math.ceil(level / 2)} spell levels once per Long Rest` }];
    default:
      return [];
  }
}

function armorDexterity(character: Character, dexterityModifier: number): number {
  if (character.armorMode === "light") return dexterityModifier;
  if (character.armorMode === "medium") return Math.min(dexterityModifier, 2);
  return 0;
}

function increaseSize(size: CreatureSize): CreatureSize {
  const sizes: CreatureSize[] = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
  return sizes[Math.min(sizes.indexOf(size) + 1, sizes.length - 1)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
