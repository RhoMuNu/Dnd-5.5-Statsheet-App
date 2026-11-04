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
  spellSlots: { spellLevel: number; total: number }[];
  spellSlotRecovery: "Long Rest" | "Short or Long Rest";
  appliedClassFeatures: string[];
  classResources: { label: string; value: string }[];
  classFeatures: { level: number; name: string }[];
  cantrips: number | null;
  preparedSpellCount: number | null;
  spellCountLabel: string | null;
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
  const level = clamp(Math.trunc(character.level), 1, 20);
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

  const className = character.characterClass.trim().toLowerCase();
  const progression = classProgressionAtLevel(className, level, character.subclass);
  const dexterityModifier = abilityModifiers.Dexterity;
  let armorBase = character.armorMode === "unarmored" ? 10 + dexterityModifier : character.armorBaseAC + armorDexterity(character, dexterityModifier);
  const appliedClassFeatures: string[] = [];
  if (character.armorMode === "unarmored" && className === "barbarian") {
    armorBase = 10 + dexterityModifier + abilityModifiers.Constitution;
    appliedClassFeatures.push("Barbarian Unarmored Defense");
  } else if (character.armorMode === "unarmored" && className === "monk" && !character.hasShield) {
    armorBase = 10 + dexterityModifier + abilityModifiers.Wisdom;
    appliedClassFeatures.push("Monk Unarmored Defense");
  }
  const armorClass = armorBase + (character.hasShield ? 2 : 0) + character.otherAcBonus;
  const hitDie = HIT_DICE[character.characterClass.trim().toLowerCase()] ?? null;
  const constitutionModifier = abilityModifiers.Constitution;
  const firstLevelHp = hitDie === null ? null : Math.max(1, hitDie + constitutionModifier);
  const fixedHpPerLevel = hitDie === null ? null : Math.floor(hitDie / 2) + 1;
  const maxHitPoints = firstLevelHp === null || fixedHpPerLevel === null
    ? null
    : firstLevelHp + (level - 1) * Math.max(1, fixedHpPerLevel + constitutionModifier);

  const effectiveSize = character.powerfulBuild ? increaseSize(character.size) : character.size;
  const carryingCapacity = character.abilityScores.Strength * SIZE_MULTIPLIER[effectiveSize];
  let classSpeedBonus = 0;
  if (className === "monk" && level >= 2 && character.armorMode === "unarmored" && !character.hasShield) {
    classSpeedBonus = level >= 18 ? 30 : level >= 14 ? 25 : level >= 10 ? 20 : level >= 6 ? 15 : 10;
    appliedClassFeatures.push(`Monk Unarmored Movement +${classSpeedBonus} ft.`);
  } else if (className === "barbarian" && level >= 5 && character.armorMode !== "heavy") {
    classSpeedBonus = 10;
    appliedClassFeatures.push("Barbarian Fast Movement +10 ft.");
  }
  const armorReducesSpeed = character.armorMode === "heavy"
    && character.armorStrengthRequirement > 0
    && character.abilityScores.Strength < character.armorStrengthRequirement;
  const speed = Math.max(0, character.speedFeet + character.otherSpeedBonus + classSpeedBonus - (armorReducesSpeed ? 10 : 0));
  const spellcastingAbility = character.spellcastingAbility || CLASS_SPELLCASTING_ABILITIES[character.characterClass.trim().toLowerCase()] || "";
  const spellModifier = spellcastingAbility ? abilityModifiers[spellcastingAbility] : null;
  const spellSlots = spellSlotsForClass(character.characterClass, level);
  const classResources = classResourcesFor(character, level, abilityModifiers);
  const preparedSpellCount = spellCountFor(className, level, abilityModifiers);

  return {
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
    spellSlotRecovery: character.characterClass.trim().toLowerCase() === "warlock" ? "Short or Long Rest" : "Long Rest",
    appliedClassFeatures,
    classResources,
    classFeatures: progression.gainedFeatures,
    cantrips: progression.cantrips,
    preparedSpellCount: preparedSpellCount.value,
    spellCountLabel: preparedSpellCount.label,
  };
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

function spellSlotsForClass(characterClass: string, level: number): { spellLevel: number; total: number }[] {
  const className = characterClass.trim().toLowerCase();
  if (["bard", "cleric", "druid", "sorcerer", "wizard"].includes(className)) {
    return slotsFromRow(FULL_CASTER_SLOTS[level - 1]);
  }
  if (["paladin", "ranger"].includes(className)) {
    return slotsFromRow(FULL_CASTER_SLOTS[Math.ceil(level / 2) - 1]);
  }
  if (className === "warlock") {
    return [{ spellLevel: WARLOCK_SLOT_LEVELS[level - 1], total: WARLOCK_SLOT_COUNTS[level - 1] }];
  }
  return [];
}

function slotsFromRow(row: number[]): { spellLevel: number; total: number }[] {
  return row.flatMap((total, index) => total > 0 ? [{ spellLevel: index + 1, total }] : []);
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
