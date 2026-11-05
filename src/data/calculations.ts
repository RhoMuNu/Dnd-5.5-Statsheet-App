import { hasFeat } from "./advancement";
import { classLevel, subclassIs } from "./rulesCatalog";
import { inventoryArmor } from "./equipment";
import type { AbilityName, Character, CreatureSize, SkillName } from "./characters";
import { SKILLS } from "./characters";
import { classProgressionAtLevel } from "./classProgression";
import { activeEffects, effectTotal } from "./effects";
import { activeConditions, exhaustionLevel, isIncapacitated } from "./conditions";

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
  classResources: { key?: string; label: string; value: string; maxUses?: number; used?: number; recovery?: "Short Rest" | "Long Rest"; shortRestRecovery?: "one" | "all" }[];
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
  const equipment = character.armorSource === "inventory" ? inventoryArmor(character) : null;
  if (equipment) character = { ...character, armorMode: equipment.armorMode, armorBaseAC: equipment.armorBaseAC, armorStrengthRequirement: equipment.armorStrengthRequirement, hasShield: equipment.hasShield };
  const classes = getClassLevels(character);
  const level = clamp(classes.reduce((sum, entry) => sum + entry.level, 0) || Math.trunc(character.level), 1, 20);
  const primaryClass = character.characterClass.trim().toLowerCase();
  const exhaustion = exhaustionLevel(character);
  const proficiencyBonus = Math.floor((level - 1) / 4) + 2;
  const abilityModifiers = Object.fromEntries(
    Object.entries(character.abilityScores).map(([ability, score]) => [ability, Math.floor((score - 10) / 2)]),
  ) as Record<AbilityName, number>;

  const auraBonus = classLevel(character, "Paladin") >= 6 && !isIncapacitated(character) ? Math.max(1, abilityModifiers.Charisma) : 0;
  const savingThrows = Object.fromEntries(
    Object.entries(abilityModifiers).map(([ability, modifier]) => [
      ability,
      modifier + (isSavingThrowProficient(character, ability as AbilityName) ? proficiencyBonus : 0) + effectTotal(character, "save") + auraBonus - 2 * exhaustion,
    ]),
  ) as Record<AbilityName, number>;

  const skillBonuses = Object.fromEntries(SKILLS.map(({ name, ability }) => {
    const rank = character.skillProficiencies[name] ?? 0;
    const jack = rank === 0 && classLevelOf(classes, "bard") >= 2 ? Math.floor(proficiencyBonus / 2) : 0;
    return [name, abilityModifiers[ability] + proficiencyBonus * rank + jack + effectTotal(character, "check") - 2 * exhaustion];
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
  if (character.armorMode === "unarmored" && subclassIs(character, "Sorcerer", "Draconic")) { armorBase = Math.max(armorBase, 10 + dexterityModifier + abilityModifiers.Charisma); appliedClassFeatures.push("Draconic Resilience AC"); }
  const armorClass = armorBase + (equipment ? equipment.shieldBonus : character.hasShield ? 2 : 0) + character.otherAcBonus + effectTotal(character, "ac") + (character.armorMode !== "unarmored" && hasFeat(character, "Defense") ? 1 : 0);
  const hitDie = HIT_DICE[className] ?? null;
  const constitutionModifier = abilityModifiers.Constitution;
  const calculatedHitPoints = classes.length === 0 ? null : classes.reduce((total, entry) => {
    const average = Math.floor(HIT_DICE[entry.name] / 2) + 1;
    const levels = entry.level - (entry.name === className ? 1 : 0);
    return total + levels * Math.max(1, average + constitutionModifier);
  }, Math.max(1, (HIT_DICE[className] ?? 0) + constitutionModifier));
  // Dwarven Toughness grants 1 additional HP per character level in the 2024 rules.
  const maxHitPoints = calculatedHitPoints === null ? null : calculatedHitPoints + (character.species.toLowerCase().startsWith("dwarf") ? level : 0) + effectTotal(character, "hpPerLevel") * level + (character.hitPointAdjustment ?? 0) + (subclassIs(character, "Sorcerer", "Draconic") ? classLevel(character, "Sorcerer") : 0);

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
  const immobile = activeConditions(character).some((condition) => ["Grappled", "Restrained", "Paralyzed", "Petrified", "Unconscious"].includes(condition)) || character.combat?.dead;
  const speed = immobile ? 0 : Math.max(0, character.speedFeet + character.otherSpeedBonus + classSpeedBonus - (armorReducesSpeed ? 10 : 0) - exhaustion * 5 + effectTotal(character, "speed") + (hasFeat(character, "Speedy") ? 10 : 0));
  const spellcastingAbility = character.spellcastingAbility || CLASS_SPELLCASTING_ABILITIES[character.characterClass.trim().toLowerCase()] || "";
  const spellModifier = spellcastingAbility ? abilityModifiers[spellcastingAbility] : null;
  const spellSlots = spellSlotsForClasses(classes, { [capitalize(className)]: character.subclass, ...character.classSubclasses });
  const classResources = classes.flatMap(({ name, level: classLevel }) => classResourcesFor({ ...character, characterClass: capitalize(name) }, classLevel, abilityModifiers).map((resource) => {
    const key = resource.key ? `${name}.${resource.key}` : undefined;
    return { ...resource, key, used: key && resource.maxUses !== undefined ? Math.min(resource.maxUses, Math.max(0, character.resourceUses?.[key] ?? 0)) : undefined, label: classes.length > 1 ? `${capitalize(name)} · ${resource.label}` : resource.label };
  })).concat(speciesResources(character, proficiencyBonus), originFeatResources(character));
  const preparedSpellCount = spellCountFor(className, classes.find((entry) => entry.name === className)?.level ?? level);
  const spellcastingProgressions = classes.flatMap(({ name, level: classLevel }) => {
    const classProgression = classProgressionAtLevel(name, classLevel);
    const ability = spellAbilityFor(name, character.classSubclasses?.[capitalize(name)] ?? (name === className ? character.subclass : ""), name === className ? character.spellcastingAbility : "");
    if (!ability) return [];
    const count = spellCountFor(name, classLevel);
    return [{ className: capitalize(name), cantrips: classProgression.cantrips, count: count.value, label: count.label, saveDC: 8 + abilityModifiers[ability] + proficiencyBonus, attackBonus: abilityModifiers[ability] + proficiencyBonus - 2 * exhaustion + effectTotal(character, "attack") }];
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
    initiative: dexterityModifier - 2 * exhaustion + effectTotal(character, "check") + effectTotal(character, "initiative") + (activeEffects(character).some((effect) => effect.initiativeProficiency) ? proficiencyBonus : 0),
    armorClass,
    maxHitPoints,
    hitDie,
    speed,
    carryingCapacity,
    pushDragLift: carryingCapacity * 2,
    effectiveSize,
    spellSaveDC: spellModifier === null ? null : 8 + spellModifier + proficiencyBonus,
    spellAttackBonus: spellModifier === null ? null : spellModifier + proficiencyBonus - 2 * exhaustion + effectTotal(character, "attack"),
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

function speciesResources(character: Character, proficiencyBonus: number) {
  const species = character.species.toLowerCase().split(" (")[0].trim();
  const source = species === "aasimar" ? [
    { key: "species.healing-hands", label: "Healing Hands", value: `1d4 × ${proficiencyBonus} HP`, maxUses: proficiencyBonus },
    { key: "species.celestial-revelation", label: "Celestial Revelation", value: "", maxUses: 1 },
  ] : species === "dragonborn" ? [
    { key: "species.breath-weapon", label: "Breath Weapon", value: "", maxUses: proficiencyBonus },
  ] : species === "dwarf" ? [
    { key: "species.stonecunning", label: "Stonecunning", value: "", maxUses: proficiencyBonus },
  ] : species === "goliath" ? [
    { key: "species.large-form", label: "Large Form", value: "", maxUses: proficiencyBonus },
  ] : species === "orc" ? [
    { key: "species.adrenaline-rush", label: "Adrenaline Rush", value: "", maxUses: proficiencyBonus },
  ] : species === "human" ? [
    { key: "species.resourceful", label: "Heroic Inspiration · Resourceful", value: "", maxUses: 1 },
  ] : [];
  return source.map((resource) => ({
    ...resource,
    recovery: "Long Rest" as const,
    used: Math.min(resource.maxUses, Math.max(0, character.resourceUses?.[resource.key] ?? 0)),
    label: resource.label,
  }));
}

function originFeatResources(character: Character) {
  const background = character.background.toLowerCase();
  if (background !== "acolyte" && background !== "sage") return [];
  const key = "origin.magic-initiate";
  return [{ key, label: "Magic Initiate · Free Level 1 Spell", value: "Once per Long Rest", maxUses: 1, used: Math.min(1, Math.max(0, character.resourceUses?.[key] ?? 0)), recovery: "Long Rest" as const }];
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

function spellCountFor(className: string, level: number) {
  const known = classProgressionAtLevel(className, level).preparedSpells;
  return known === null ? { value: null, label: null } : { value: known, label: "Prepared spells" };
}

export function isClassSavingThrowProficient(character: Character, ability: AbilityName): boolean {
  return CLASS_SAVE_PROFICIENCIES[character.characterClass.trim().toLowerCase()]?.includes(ability) ?? false;
}

export function isSavingThrowProficient(character: Character, ability: AbilityName): boolean {
  return isClassSavingThrowProficient(character, ability) || character.savingThrowProficiencies[ability] || (hasFeat(character, "Resilient") && character.rulesChoices?.["feat:Resilient"]?.includes(ability) === true) || classLevel(character, "Monk") >= 14 || (classLevel(character, "Rogue") >= 15 && ["Wisdom", "Charisma"].includes(ability));
}

function spellSlotsForClasses(classes: { name: string; level: number }[], subclasses: Record<string, string>): { spellLevel: number; total: number; pool: string }[] {
  // A lone half caster uses its own class table, not the multiclass table.
  const spellcasters = classes.filter(({ name }) => ["bard", "cleric", "druid", "sorcerer", "wizard", "paladin", "ranger"].includes(name)
    || (name === "fighter" && (subclasses.Fighter ?? "").toLowerCase().includes("eldritch knight"))
    || (name === "rogue" && (subclasses.Rogue ?? "").toLowerCase().includes("arcane trickster")));
  const casterLevel = classes.reduce((total, { name, level }) => {
    if (["bard", "cleric", "druid", "sorcerer", "wizard"].includes(name)) return total + level;
    if (["paladin", "ranger"].includes(name)) return total + (spellcasters.length === 1 ? (level === 1 ? 1 : Math.floor(level / 2)) : Math.ceil(level / 2));
    const subclass = subclasses[capitalize(name)]?.toLowerCase() ?? "";
    if ((name === "fighter" && subclass.includes("eldritch knight"))
      || (name === "rogue" && subclass.includes("arcane trickster"))) return total + Math.floor(level / 3);
    return total;
  }, 0);
  let row = casterLevel > 0 ? FULL_CASTER_SLOTS[clamp(casterLevel, 1, 20) - 1] : [];
  if (spellcasters.length === 1) {
    const { name, level } = spellcasters[0];
    if (["paladin", "ranger"].includes(name)) {
      row = [[2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
        [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
        [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]][level - 1];
    } else if (["fighter", "rogue"].includes(name)) {
      row = level < 3 ? [] : level === 3 ? [2] : level < 7 ? [3] : level < 10 ? [4, 2]
        : level < 13 ? [4, 3] : level < 16 ? [4, 3, 2] : level < 19 ? [4, 3, 3] : [4, 3, 3, 1];
    }
  }
  const regular = slotsFromRow(row).map((slot) => ({ ...slot, pool: "Spellcasting · Long Rest" }));
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

function classResourcesFor(character: Character, level: number, modifiers: Record<AbilityName, number>): { key?: string; label: string; value: string; maxUses?: number; recovery?: "Short Rest" | "Long Rest"; shortRestRecovery?: "one" | "all" }[] {
  const className = character.characterClass.trim().toLowerCase();
  switch (className) {
    case "barbarian":
      return [
        { key: "rage", label: "Rage", value: "", maxUses: level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2, recovery: "Short Rest", shortRestRecovery: "one" },
        { label: "Rage damage", value: `+${level >= 16 ? 4 : level >= 9 ? 3 : 2}` },
        { label: "Weapon Mastery", value: String(level >= 10 ? 4 : level >= 4 ? 3 : 2) },
        ...(level >= 15 ? [{ key: "persistent-rage-recovery", label: "Persistent Rage · Initiative Recovery", value: "", maxUses: 1, recovery: "Long Rest" as const }] : []),
      ];
    case "bard":
      return [{ key: "bardic-inspiration", label: "Bardic Inspiration", value: level >= 15 ? "d12" : level >= 10 ? "d10" : level >= 5 ? "d8" : "d6", maxUses: Math.max(1, modifiers.Charisma), recovery: level >= 5 ? "Short Rest" : "Long Rest", shortRestRecovery: "all" }];
    case "cleric":
      return [
        ...(level >= 2 ? [{ key: "channel-divinity", label: "Channel Divinity", value: "", maxUses: level >= 6 ? 3 : 2, recovery: "Short Rest" as const, shortRestRecovery: "one" as const }] : []),
        ...(level >= 10 ? [{ key: "divine-intervention", label: "Divine Intervention", value: "", maxUses: 1, recovery: "Long Rest" as const }] : []),
      ];
    case "druid":
      return level >= 2 ? [{ key: "wild-shape", label: "Wild Shape", value: "", maxUses: level >= 17 ? 4 : level >= 6 ? 3 : 2, recovery: "Short Rest", shortRestRecovery: "one" }] : [];
    case "fighter":
      return [
        { key: "second-wind", label: "Second Wind", value: "", maxUses: level >= 10 ? 4 : level >= 4 ? 3 : 2, recovery: "Short Rest", shortRestRecovery: "one" },
        ...(level >= 2 ? [{ key: "action-surge", label: "Action Surge", value: "", maxUses: level >= 17 ? 2 : 1, recovery: "Short Rest" as const, shortRestRecovery: "all" as const }] : []),
        ...(level >= 9 ? [{ key: "indomitable", label: "Indomitable", value: "", maxUses: level >= 17 ? 3 : level >= 13 ? 2 : 1, recovery: "Long Rest" as const }] : []),
        { label: "Weapon Mastery", value: `${level >= 16 ? 6 : level >= 10 ? 5 : level >= 4 ? 4 : 3} weapons` },
      ];
    case "monk":
      return level >= 2 ? [
        { key: "focus-points", label: "Focus Points", value: "", maxUses: level, recovery: "Short Rest", shortRestRecovery: "all" },
        { label: "Martial Arts die", value: level >= 17 ? "d12" : level >= 11 ? "d10" : level >= 5 ? "d8" : "d6" },
      ] : [{ label: "Martial Arts die", value: "d6" }];
    case "paladin":
      return [
        { key: "lay-on-hands", label: "Lay On Hands pool", value: "HP", maxUses: 5 * level, recovery: "Long Rest" },
        ...(level >= 5 ? [{ key: "faithful-steed", label: "Faithful Steed · Free Find Steed", value: "", maxUses: 1, recovery: "Long Rest" as const }] : []),
        ...(level >= 3 ? [{ key: "channel-divinity", label: "Channel Divinity", value: "", maxUses: level >= 11 ? 3 : 2, recovery: "Short Rest" as const, shortRestRecovery: "one" as const }] : []),
      ];
    case "ranger":
      return [
        { key: "favored-enemy", label: "Favored Enemy", value: "free Hunter’s Mark casts", maxUses: level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2, recovery: "Long Rest" },
        ...(level >= 10 ? [{ key: "tireless", label: "Tireless · Temporary HP", value: "uses", maxUses: Math.max(1, modifiers.Wisdom), recovery: "Long Rest" as const }] : []),
        ...(level >= 14 ? [{ key: "natures-veil", label: "Nature’s Veil", value: "", maxUses: Math.max(1, modifiers.Wisdom), recovery: "Long Rest" as const }] : []),
      ];
    case "rogue":
      return [
        { label: "Sneak Attack", value: `${Math.ceil(level / 2)}d6` },
        ...(level >= 20 ? [{ key: "stroke-of-luck", label: "Stroke of Luck", value: "", maxUses: 1, recovery: "Short Rest" as const, shortRestRecovery: "all" as const }] : []),
      ];
    case "sorcerer":
      return [
        { key: "innate-sorcery", label: "Innate Sorcery", value: "", maxUses: 2, recovery: "Long Rest" },
        ...(level >= 2 ? [{ key: "sorcery-points", label: "Sorcery Points", value: "", maxUses: level, recovery: "Long Rest" as const }] : []),
        ...(level >= 5 ? [{ key: "sorcerous-restoration", label: "Sorcerous Restoration", value: "", maxUses: 1, recovery: "Long Rest" as const }] : []),
      ];
    case "warlock": {
      const invocations = [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10][level - 1];
      return [
        { label: "Eldritch Invocations", value: String(invocations) },
        ...(level >= 2 ? [{ key: "magical-cunning", label: "Magical Cunning", value: "", maxUses: 1, recovery: "Long Rest" as const }] : []),
        ...(level >= 9 ? [{ key: "contact-patron", label: "Contact Patron · Free Contact Other Plane", value: "", maxUses: 1, recovery: "Long Rest" as const }] : []),
        ...[11, 13, 15, 17].filter((threshold) => level >= threshold).map((threshold) => ({ key: `mystic-arcanum-${Math.floor((threshold + 1) / 2)}`, label: `Mystic Arcanum · Level ${Math.floor((threshold + 1) / 2)}`, value: "", maxUses: 1, recovery: "Long Rest" as const })),
      ];
    }
    case "wizard":
      return [{ key: "arcane-recovery", label: "Arcane Recovery", value: `spell levels · up to ${Math.ceil(level / 2)}`, maxUses: 1, recovery: "Long Rest" }];
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
