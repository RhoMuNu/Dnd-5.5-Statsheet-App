import { subclassSpellGrants, subclassSpellNames } from "./subclassSpells";
import { ABILITIES, CLASSES, SKILLS, type AbilityName, type Character, type SkillName } from "./characters";
import { calculateCharacterStats } from "./calculations";
import { CLASS_PROGRESSION, classProgressionAtLevel } from "./classProgression";
import { CLASS_CATALOG, FEAT_CATALOG, SPELL_CATALOG, classLevel, gainedRuleFeatures, spellFromCatalog, subclassOf, rulesSubclass } from "./rulesCatalog";
import { validCustomSubclass, type CustomSubclassFeature } from "./customSubclasses";
import { BACKGROUNDS } from "./creationOptions";

export type LevelUpPlan = { className: string; subclass: string; customSubclass?: boolean; customDescription?: string; customFeatures?: CustomSubclassFeature[]; feat: string; boosts: Partial<Record<AbilityName, number>>; spellKeys: string[]; choices: Record<string, string[]>; hpRoll: number | null };
export type AdvancementRecord = { id: string; level: number; className: string; classLevel: number; subclass: string; feat: string; boosts: Partial<Record<AbilityName, number>>; spells: string[]; choices: Record<string, string[]>; hpRoll: number | null; createdAt: string };
export type RuleChoice = { key: string; title: string; count: number; options: string[]; description: string };
export const INVOCATIONS = (CLASS_CATALOG.find((entry) => entry.name === "Warlock")?.features.find((feature) => feature.name === "Eldritch Invocation Options")?.desc ?? "").split(/\n### /).slice(1).map((section) => { const [heading, ...body] = section.split("\n"); const description = body.join("\n").trim(); return { name: heading.replaceAll("*", "").trim(), description, minimum: Number(description.match(/Level (\d+)\+ Warlock/)?.[1] ?? 1), dependency: description.match(/, ([^,*\n]+) Invocation/)?.[1] }; });

export function hasFeat(character: Character, name: string) {
  return character.features.some((feature) => !feature.manualOnly && feature.category === "feat" && feature.name.toLowerCase().replace(/ feat$/, "") === name.toLowerCase()) || BACKGROUNDS[character.background]?.feat === name;
}
const customSubclassSelected = (character: Character, className: string) => !!character.customSubclasses?.[className] || (!!subclassOf(character, className) && !CLASS_CATALOG.some((entry) => entry.subclass_of?.name === className && entry.name === subclassOf(character, className)));
export const newLevelUpPlan = (character: Character, className = character.characterClass): LevelUpPlan => ({ className, subclass: subclassOf(character, className), customSubclass: customSubclassSelected(character, className), customDescription: character.customSubclasses?.[className]?.description ?? "", customFeatures: [], feat: "Ability Score Improvement", boosts: {}, spellKeys: [], choices: {}, hpRoll: null });
export function previewLevel(character: Character, plan: LevelUpPlan): Character {
  const levels = Object.keys(character.classLevels ?? {}).length ? { ...character.classLevels } : { [character.characterClass]: character.level };
  levels[plan.className] = (levels[plan.className] ?? 0) + 1;
  return { ...character, level: Object.values(levels).reduce((sum, value) => sum + value, 0), classLevels: levels,
    subclass: plan.className === character.characterClass ? plan.subclass : character.subclass,
    classSubclasses: { ...character.classSubclasses, [plan.className]: plan.subclass },
    customSubclasses: { ...character.customSubclasses, ...(plan.customSubclass === true ? { [plan.className]: { name: plan.subclass, description: plan.customDescription ?? "" } } : {}) } };
}
export function levelChoices(character: Character, plan: LevelUpPlan): RuleChoice[] {
  const next = previewLevel(character, plan), level = classLevel(next, plan.className), name = plan.className;
  const choices: RuleChoice[] = [];
  const add = (key: string, title: string, count: number, options: string[], description: string) => choices.push({ key: `${name}:${key}`, title, count, options, description });
  const skills = SKILLS.filter((skill) => character.skillProficiencies[skill.name] > 0 && character.skillProficiencies[skill.name] < 2).map((skill) => skill.name);
  if ((name === "Rogue" && [1, 6].includes(level)) || (name === "Bard" && [2, 9].includes(level)) || (name === "Ranger" && [2, 9].includes(level))) add(`expertise:${level}`, "Expertise", name === "Ranger" && level === 2 ? 1 : 2, skills, "Double proficiency for the chosen proficient skills.");
  if (name === "Wizard" && level === 2) add("scholar", "Scholar expertise", 1, skills.filter((skill) => ["Arcana", "History", "Investigation", "Medicine", "Nature", "Religion"].includes(skill)), "Choose a proficient knowledge skill for expertise.");
  if ((name === "Fighter" && level === 1) || (["Paladin", "Ranger"].includes(name) && level === 2) || (name === "Fighter" && level === 7 && !plan.customSubclass && plan.subclass === "Champion")) add(`style:${level}`, "Fighting Style", 1, ["Archery", "Defense", "Great Weapon Fighting", "Two-Weapon Fighting"].filter((style) => !hasFeat(character, style)), "Choose a fighting style. Conditional weapon benefits require the weapon flags in the attack editor.");
  if (name === "Cleric" && level === 1) add("divine-order", "Divine Order", 1, ["Protector", "Thaumaturge"], "Protector grants martial/heavy armor training. Thaumaturge grants an extra cantrip and knowledge benefits.");
  if (name === "Druid" && level === 1) add("primal-order", "Primal Order", 1, ["Magician", "Warden"], "Magician grants an extra cantrip. Warden grants martial weapon/medium armor training.");
  if (name === "Warlock") {
    const totals = [0, 1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10];
    const count = totals[level] - totals[level - 1];
    const known = [...Object.values(character.rulesChoices ?? {}).flat(), ...Object.values(plan.choices).flat()];
    const existing = Object.values(character.rulesChoices ?? {}).flat();
    if (count > 0) add(`invocations:${level}`, "Eldritch Invocations", count, INVOCATIONS.filter((invocation) => invocation.minimum <= level && !existing.includes(invocation.name) && (!invocation.dependency || known.includes(invocation.dependency))).map((invocation) => invocation.name), "Choose new invocations. Their rules are saved as features; conditional casts, pact weapon requirements, and extra feat/spell choices still use feature notes.");
  }
  if (name === "Sorcerer" && [2, 10, 17].includes(level)) add(`metamagic:${level}`, "Metamagic", 2, ["Careful Spell", "Distant Spell", "Empowered Spell", "Extended Spell", "Heightened Spell", "Quickened Spell", "Seeking Spell", "Subtle Spell", "Transmuted Spell", "Twinned Spell"].filter((option) => !Object.values(character.rulesChoices ?? {}).flat().includes(option)), "Record your Metamagic options; spend Sorcery Points when applying them.");
  if (name === "Ranger" && level === 3 && !plan.customSubclass && plan.subclass === "Hunter") add("hunters-prey", "Hunter’s Prey", 1, ["Colossus Slayer", "Horde Breaker"], "Colossus Slayer adds 1d8 once per turn to a wounded target; Horde Breaker needs a nearby second target.");
  if (name === "Ranger" && level === 7 && !plan.customSubclass && plan.subclass === "Hunter") add("defensive-tactics", "Defensive Tactics", 1, ["Escape the Horde", "Multiattack Defense"], "Choose the defensive feature to record on your sheet.");
  if (name === "Bard" && level === 3 && !plan.customSubclass && plan.subclass === "College of Lore") add("lore-skills", "Bonus proficiencies", 3, SKILLS.filter((skill) => !character.skillProficiencies[skill.name]).map((skill) => skill.name), "Gain proficiency in three skills.");
  if (plan.feat === "Skilled" && hasFeatChoice(character, plan)) add("skilled", "Skilled proficiencies", 3, [...SKILLS.filter((skill) => !character.skillProficiencies[skill.name]).map((skill) => skill.name), ...["Alchemist’s Supplies", "Brewer’s Supplies", "Calligrapher’s Supplies", "Carpenter’s Tools", "Cartographer’s Tools", "Cook’s Utensils", "Disguise Kit", "Forgery Kit", "Herbalism Kit", "Jeweler’s Tools", "Leatherworker’s Tools", "Mason’s Tools", "Navigator’s Tools", "Poisoner’s Kit", "Potter’s Tools", "Smith’s Tools", "Thieves’ Tools", "Tinker’s Tools", "Weaver’s Tools", "Woodcarver’s Tools"].map((tool) => `Tool: ${tool}`)].filter((option) => !Object.values(character.rulesChoices ?? {}).flat().includes(option)), "Choose three skill or tool proficiencies.");
  return choices;
}
export function hasFeatChoice(character: Character, plan: LevelUpPlan) {
  return (CLASS_PROGRESSION[plan.className.toLowerCase()]?.features[classLevel(previewLevel(character, plan), plan.className)] ?? []).some((name) => ["Ability Score Improvement", "Epic Boon"].includes(name));
}
export function spellLimits(character: Character, plan: LevelUpPlan) {
  const next = previewLevel(character, plan), level = classLevel(next, plan.className), oldLevel = level - 1;
  const progression = classProgressionAtLevel(plan.className, level, plan.customSubclass ? "" : plan.subclass);
  const before = oldLevel ? classProgressionAtLevel(plan.className, oldLevel, rulesSubclass(character, plan.className)) : { cantrips: 0, preparedSpells: 0 };
  // Individual class slots, never combined multiclass slots, determine learnable spell levels.
  const single = { ...next, characterClass: plan.className, subclass: plan.subclass, classLevels: { [plan.className]: level } };
  const maxLevel = Math.max(0, ...calculateCharacterStats(single).spellSlots.map((slot) => slot.spellLevel));
  const known = character.spells.filter((spell) => spell.className === plan.className || (!spell.className && plan.className === character.characterClass));
  const newCantrips = Math.max(0, (progression.cantrips ?? 0) - (before.cantrips ?? 0));
  const bookCaster = plan.className === "Wizard";
  const preparedCaster = ["Cleric", "Druid", "Paladin"].includes(plan.className);
  let spells = bookCaster ? (level === 1 ? 6 : 2) : Math.max(0, (progression.preparedSpells ?? 0) - (before.preparedSpells ?? 0));
  const evocationBonus = bookCaster && !plan.customSubclass && plan.subclass === "Evoker" ? level === 3 ? 2 : [5, 7, 9, 11, 13, 15, 17].includes(level) ? 1 : 0 : 0;
  spells += evocationBonus;
  const requiredSpells = preparedCaster ? 0 : spells;
  if (preparedCaster) spells = Math.max(spells, (progression.preparedSpells ?? 0) - known.filter((spell) => spell.level > 0 && spell.prepared && !spell.alwaysPrepared).length);
  return { maxLevel, cantrips: newCantrips, spells, requiredSpells, preparedCaster, evocationBonus };
}
export function eligibleFeats(character: Character, plan: LevelUpPlan) {
  const next = previewLevel(character, plan), caster = calculateCharacterStats(next).spellSlots.length > 0;
  return FEAT_CATALOG.filter((feat) => feat.type !== "Fighting Style" && (feat.name === "Ability Score Improvement" || feat.name === "Skilled" || !hasFeat(character, feat.name))
    && (!feat.prerequisite.includes("19+") || next.level >= 19) && (!feat.prerequisite.includes("4+") || next.level >= 4)
    && (!/Spellcasting|Pact Magic/.test(feat.prerequisite) || caster)
    && (feat.name !== "Grappler" || character.abilityScores.Strength >= 13 || character.abilityScores.Dexterity >= 13)
    && (feat.name !== "Speedy" || character.abilityScores.Dexterity >= 13 || character.abilityScores.Constitution >= 13)
    && !["Magic Initiate"].includes(feat.name));
}
export function levelUpErrors(character: Character, plan: LevelUpPlan): string[] {
  const errors: string[] = [];
  if (character.combat?.turn?.enabled) errors.push("Finish combat before leveling up.");
  if (!CLASSES.includes(plan.className as typeof CLASSES[number])) return ["Choose a valid class."];
  const next = previewLevel(character, plan), level = classLevel(next, plan.className);
  if (calculateCharacterStats(character).totalLevel >= 20 || next.level > 20) errors.push("Characters cannot advance past level 20.");
  if (Object.keys(next.classLevels).length > 1) errors.push(...calculateCharacterStats(next).multiclassWarnings.filter((warning) => warning.startsWith("Multiclassing requires")));
  const previousSubclass = subclassOf(character, plan.className);
  if (previousSubclass && plan.subclass !== previousSubclass) errors.push("A level-up cannot replace an existing subclass.");
  if (level >= 3 && !plan.subclass.trim()) errors.push("Choose a subclass.");
  if (plan.customSubclass !== undefined && typeof plan.customSubclass !== "boolean") errors.push("Choose a valid subclass type.");
  if (previousSubclass && customSubclassSelected(character, plan.className) !== !!plan.customSubclass) errors.push("A level-up cannot change an existing subclass’s type.");
  if (plan.customSubclass === true && !validCustomSubclass({ name: plan.subclass, description: plan.customDescription })) errors.push("Custom subclasses need a name (up to 80 characters) and description (up to 10,000 characters).");
  if (!plan.customSubclass && plan.subclass && !CLASS_CATALOG.some((entry) => entry.name === plan.subclass && entry.subclass_of?.name === plan.className) && plan.subclass !== previousSubclass) errors.push("Choose an available subclass or the custom subclass option.");
  if (plan.customFeatures !== undefined && (!Array.isArray(plan.customFeatures) || plan.customFeatures.length > 20 || !plan.customFeatures.every((feature) => feature && typeof feature.name === "string" && feature.name.trim().length > 0 && feature.name.length <= 80 && typeof feature.description === "string" && feature.description.trim().length > 0 && feature.description.length <= 20000))) errors.push("Each custom feature needs a name and description (maximum 20 features per level).");
  if (plan.customFeatures?.length && !plan.customSubclass) errors.push("Custom subclass features require a custom subclass.");
  if (level < 3 && plan.subclass) errors.push("Subclasses unlock at class level 3.");
  const featChoice = hasFeatChoice(character, plan);
  if (featChoice && !eligibleFeats(character, plan).some((feat) => feat.name === plan.feat)) errors.push("Choose a feat for which you qualify.");
  const totalBoost = Object.values(plan.boosts).reduce((sum, value) => sum + (value ?? 0), 0);
  const boostFeat = featChoice ? plan.feat : "";
  const boostCount = boostFeat === "Ability Score Improvement" ? 2 : ["Grappler", "War Caster", "Resilient", "Speedy"].includes(boostFeat) || boostFeat.startsWith("Boon of ") ? 1 : 0;
  if (totalBoost !== boostCount) errors.push(`Assign exactly ${boostCount} ability score point${boostCount === 1 ? "" : "s"}.`);
  for (const [key, boost] of Object.entries(plan.boosts)) {
    const ability = key as AbilityName;
    if (!ABILITIES.includes(ability) || !Number.isInteger(boost) || boost! < 0 || boost! > 2) { errors.push("Ability boosts must be whole points from 0 to 2."); continue; }
    if (boost && character.abilityScores[ability] + boost > (boostFeat.startsWith("Boon of ") ? 30 : 20)) errors.push(`${ability} exceeds this feat’s ability cap.`);
    if (boost && boostFeat === "War Caster" && !["Intelligence", "Wisdom", "Charisma"].includes(ability)) errors.push("War Caster increases Intelligence, Wisdom, or Charisma.");
    if (boost && boostFeat === "Grappler" && !["Strength", "Dexterity"].includes(ability)) errors.push("Grappler increases Strength or Dexterity.");
    if (boost && boostFeat === "Speedy" && !["Dexterity", "Constitution"].includes(ability)) errors.push("Speedy increases Dexterity or Constitution.");
  }
  for (const choice of levelChoices(character, plan)) {
    const selected = plan.choices[choice.key] ?? [];
    if (selected.length !== choice.count || new Set(selected).size !== selected.length || selected.some((option) => !choice.options.includes(option))) errors.push(`Choose ${choice.count} valid option${choice.count > 1 ? "s" : ""} for ${choice.title}.`);
  }
  const limits = spellLimits(character, plan), selected = plan.spellKeys.map((key) => SPELL_CATALOG.find((spell) => spell.key === key));
  if (new Set(plan.spellKeys).size !== plan.spellKeys.length) errors.push("Select each spell only once.");
  if (selected.some((spell) => !spell || !spell.classes.includes(plan.className) || spell.level > limits.maxLevel || character.spells.some((known) => (known.catalogKey === spell.key || known.name === spell.name) && (known.className ?? character.characterClass) === plan.className))) errors.push("Select new spells from this class’s available spell levels.");
  if (selected.some((spell) => spell && subclassSpellNames(plan.customSubclass ? "" : plan.subclass, level).includes(spell.name))) errors.push("Subclass spells are granted automatically; choose other spells for your level-up selections.");
  if (limits.evocationBonus && selected.filter((spell) => spell && spell.level > 0 && spell.school === "Evocation").length < limits.evocationBonus) errors.push(`Choose at least ${limits.evocationBonus} Evocation spells for Evocation Savant.`);
  const cantrips = selected.filter((spell) => spell?.level === 0).length, leveled = selected.filter((spell) => spell && spell.level > 0).length;
  if (cantrips !== limits.cantrips) errors.push(`Choose ${limits.cantrips} new cantrip${limits.cantrips === 1 ? "" : "s"}.`);
  if (leveled < limits.requiredSpells || leveled > limits.spells) errors.push(`Choose ${limits.requiredSpells === limits.spells ? limits.spells : `${limits.requiredSpells}–${limits.spells}`} new leveled spells.`);
  const hitDie = Number(CLASS_CATALOG.find((entry) => entry.name === plan.className)?.hit_dice?.slice(1) ?? 8);
  if (plan.hpRoll !== null && (!Number.isInteger(plan.hpRoll) || plan.hpRoll < 1 || plan.hpRoll > hitDie)) errors.push(`Hit point roll must be between 1 and ${hitDie}.`);
  return [...new Set(errors)];
}
export function applyLevelUp(character: Character, plan: LevelUpPlan, id: string, now: string): Partial<Character> {
  const errors = levelUpErrors(character, plan);
  if (errors.length) throw new Error(errors.join(" "));
  const next = previewLevel(character, plan), level = classLevel(next, plan.className), featChoice = hasFeatChoice(character, plan);
  next.abilityScores = { ...character.abilityScores };
  for (const ability of ABILITIES) next.abilityScores[ability] += plan.boosts[ability] ?? 0;
  next.abilityScoreOverrides = { ...character.abilityScoreOverrides, ...next.abilityScores };
  next.rulesChoices = { ...character.rulesChoices, ...plan.choices };
  next.skillProficiencies = { ...character.skillProficiencies };
  for (const choice of levelChoices(character, plan)) for (const selected of plan.choices[choice.key] ?? []) {
    if (choice.key.includes("expertise") || choice.key.endsWith("scholar")) next.skillProficiencies[selected as SkillName] = 2;
    if (choice.key.endsWith("lore-skills") || choice.key.endsWith("skilled")) if (!selected.startsWith("Tool:")) next.skillProficiencies[selected as SkillName] = 1;
  }
  if (featChoice && plan.feat === "Resilient") next.rulesChoices["feat:Resilient"] = Object.entries(plan.boosts).filter(([, boost]) => boost === 1).map(([ability]) => ability);
  const invocationFeatures = levelChoices(character, plan).filter((choice) => choice.key.includes(":invocations:")).flatMap((choice) => plan.choices[choice.key] ?? []).map((name, index) => ({ id: `${id}-invocation-${index}`, name, category: "class" as const, description: INVOCATIONS.find((entry) => entry.name === name)?.description ?? "" }));
  const features = gainedRuleFeatures(plan.className, level, plan.customSubclass ? "" : plan.subclass).map((feature, index) => ({ id: `${id}-feature-${index}`, name: feature.name, category: "class" as const, description: feature.description }));
  const customFeatures = (plan.customFeatures ?? []).map((feature, index) => ({ id: `${id}-custom-${index}`, name: feature.name.trim(), description: feature.description.trim(), category: "class" as const, manualOnly: true, source: `${plan.subclass} · ${plan.className} ${level}` }));
  const styles = levelChoices(character, plan).filter((choice) => choice.key.includes(":style:")).flatMap((choice) => plan.choices[choice.key] ?? []);
  next.features = [...character.features, ...features, ...invocationFeatures, ...[...(featChoice && plan.feat !== "Ability Score Improvement" ? [plan.feat] : []), ...styles].map((name, index) => ({ id: `${id}-feat-${index}`, name, category: "feat" as const, description: FEAT_CATALOG.find((feat) => feat.name === name)?.description ?? "" }))];
  next.features.push(...customFeatures);
  next.spells = [...character.spells, ...plan.spellKeys.map((key, index) => spellFromCatalog(key, `${id}-spell-${index}`, plan.className))];
  const subclassGrants = subclassSpellGrants(plan.customSubclass ? "" : plan.subclass, level, plan.className, id);
  for (const granted of subclassGrants) {
    const known = next.spells.find((spell) => spell.name === granted.name && (spell.className ?? character.characterClass) === plan.className);
    if (known) { next.spells = next.spells.map((spell) => spell.id === known.id ? { ...spell, prepared: true, alwaysPrepared: true } : spell); }
    else next.spells.push(granted);
  }
  const hitDie = Number(CLASS_CATALOG.find((entry) => entry.name === plan.className)?.hit_dice?.slice(1) ?? 8);
  next.hitPointAdjustment = (character.hitPointAdjustment ?? 0) + (plan.hpRoll === null ? 0 : Math.max(1, plan.hpRoll + Math.floor((next.abilityScores.Constitution - 10) / 2)) - Math.max(1, Math.floor(hitDie / 2) + 1 + Math.floor((next.abilityScores.Constitution - 10) / 2)));
  const oldMax = calculateCharacterStats(character).maxHitPoints ?? 0, newMax = calculateCharacterStats(next).maxHitPoints ?? 0;
  next.currentHitPoints = character.currentHitPoints === null ? null : character.currentHitPoints === 0 ? 0 : Math.min(newMax, character.currentHitPoints + newMax - oldMax);
  next.advancement = [...(character.advancement ?? []), { id, level: next.level, className: plan.className, classLevel: level, subclass: plan.subclass, feat: featChoice ? plan.feat : "", boosts: plan.boosts, spells: plan.spellKeys, choices: plan.choices, hpRoll: plan.hpRoll, createdAt: now }];
  return { customSubclasses: next.customSubclasses, level: next.level, classLevels: next.classLevels, subclass: next.subclass, classSubclasses: next.classSubclasses, abilityScores: next.abilityScores, abilityScoreOverrides: next.abilityScoreOverrides, rulesChoices: next.rulesChoices, skillProficiencies: next.skillProficiencies, features: next.features, spells: next.spells, hitPointAdjustment: next.hitPointAdjustment, currentHitPoints: next.currentHitPoints, advancement: next.advancement };
}
