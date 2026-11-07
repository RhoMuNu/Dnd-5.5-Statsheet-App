import { INVOCATIONS, METAMAGIC, choiceBase, invocationOptions, invocationErrors, recordedChoices, replacementGroups, replaceChoices, type ChoiceReplacement } from "./buildChoices";
export { INVOCATIONS } from "./buildChoices";
import { subclassSpellGrants, subclassSpellNames } from "./subclassSpells";
import { ABILITIES, CLASSES, SKILLS, type AbilityName, type Character, type SkillName } from "./characters";
import { calculateCharacterStats } from "./calculations";
import { CLASS_PROGRESSION, classProgressionAtLevel } from "./classProgression";
import { CLASS_CATALOG, FEAT_CATALOG, SPELL_CATALOG, classLevel, gainedRuleFeatures, spellFromCatalog, subclassOf, rulesSubclass } from "./rulesCatalog";
import { validCustomSubclass, type CustomSubclassFeature } from "./customSubclasses";
import { BACKGROUNDS } from "./creationOptions";

export type LevelUpPlan = { className: string; subclass: string; customSubclass?: boolean; customDescription?: string; customFeatures?: CustomSubclassFeature[]; feat: string; boosts: Partial<Record<AbilityName, number>>; spellKeys: string[]; choices: Record<string, string[]>; hpRoll: number | null; replacements?: ChoiceReplacement[]; spellReplacements?: { fromId: string; toKey: string }[] };
export type AdvancementRecord = { id: string; level: number; className: string; classLevel: number; subclass: string; feat: string; boosts: Partial<Record<AbilityName, number>>; spells: string[]; choices: Record<string, string[]>; hpRoll: number | null; createdAt: string };
export type RuleChoice = { key: string; title: string; count: number; options: string[]; description: string };

export function hasFeat(character: Character, name: string) {
  return character.features.some((feature) => !feature.manualOnly && feature.category === "feat" && feature.name.toLowerCase().replace(/ feat$/, "") === name.toLowerCase()) || BACKGROUNDS[character.background]?.feat === name;
}
export function availableSpellClasses(character: Character, plan: LevelUpPlan) {
  return plan.className === "Bard" && classLevel(previewLevel(character, plan), "Bard") >= 10 ? ["Bard", "Cleric", "Druid", "Wizard"] : [plan.className];
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
  const effective = { ...character, rulesChoices: replaceChoices(character, plan.replacements), spells: [...character.spells, ...plan.spellKeys.filter(key => SPELL_CATALOG.some(spell => spell.key === key)).map((key, i) => spellFromCatalog(key, `pending-${i}`, name))] };
  const choices: RuleChoice[] = [];
  const add = (key: string, title: string, count: number, options: string[], description: string) => choices.push({ key: `${name}:${key}`, title, count, options, description });
  const skills = SKILLS.filter((skill) => character.skillProficiencies[skill.name] > 0 && character.skillProficiencies[skill.name] < 2).map((skill) => skill.name);
  if ((name === "Rogue" && [1, 6].includes(level)) || (name === "Bard" && [2, 9].includes(level)) || (name === "Ranger" && [2, 9].includes(level))) add(`expertise:${level}`, "Expertise", name === "Ranger" && level === 2 ? 1 : 2, skills, "Double proficiency for the chosen proficient skills.");
  if (name === "Wizard" && level === 2) add("scholar", "Scholar expertise", 1, skills.filter((skill) => ["Arcana", "History", "Investigation", "Medicine", "Nature", "Religion"].includes(skill)), "Choose a proficient knowledge skill for expertise.");
  if ((name === "Fighter" && level === 1) || (["Paladin", "Ranger"].includes(name) && level === 2) || (name === "Fighter" && level === 7 && !plan.customSubclass && plan.subclass === "Champion")) add(`style:${level}`, "Fighting Style", 1, [...FEAT_CATALOG.filter(feat => feat.type === "Fighting Style").map(feat => feat.name), ...(["Paladin", "Ranger"].includes(name) ? [name === "Paladin" ? "Blessed Warrior" : "Druidic Warrior"] : [])].filter((style) => !hasFeat(character, style)), "Choose a fighting style. Conditional weapon benefits require the weapon flags in the attack editor.");
  if (name === "Cleric" && level === 1) add("divine-order", "Divine Order", 1, ["Protector", "Thaumaturge"], "Protector grants martial/heavy armor training. Thaumaturge grants an extra cantrip and knowledge benefits.");
  if (name === "Druid" && level === 1) add("primal-order", "Primal Order", 1, ["Magician", "Warden"], "Magician grants an extra cantrip. Warden grants martial weapon/medium armor training.");
  if (name === "Warlock") {
    const totals = [0, 1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10];
    const existing = recordedChoices(effective, 'Warlock:invocations:');
    const count = Math.max(0, totals[level] - existing.length);
    if (count > 0) add(`invocations:${level}`, "Eldritch Invocations", count, invocationOptions(effective, level).filter(value => !existing.includes(value)), "Choose eligible invocations, including any missing choices from an older sheet. Repeatable invocations identify their cantrip or Origin feat. Prerequisites are checked across the completed build.");
  }
  if (name === "Sorcerer" && [2, 10, 17].includes(level)) add(`metamagic:${level}`, "Metamagic", 2, METAMAGIC.filter((option) => !Object.values(effective.rulesChoices ?? {}).flat().includes(option)), "Record your Metamagic options; spend Sorcery Points when applying them.");
  if (name === "Ranger" && level === 3 && !plan.customSubclass && plan.subclass === "Hunter") add("hunters-prey", "Hunter’s Prey", 1, ["Colossus Slayer", "Horde Breaker"], "Colossus Slayer adds 1d8 once per turn to a wounded target; Horde Breaker needs a nearby second target.");
  if (name === "Ranger" && level === 7 && !plan.customSubclass && plan.subclass === "Hunter") add("defensive-tactics", "Defensive Tactics", 1, ["Escape the Horde", "Multiattack Defense"], "Choose the defensive feature to record on your sheet.");
  if (name === "Bard" && level === 3 && !plan.customSubclass && plan.subclass === "College of Lore") add("lore-skills", "Bonus proficiencies", 3, SKILLS.filter((skill) => !character.skillProficiencies[skill.name]).map((skill) => skill.name), "Gain proficiency in three skills.");
  if (plan.feat === "Skilled" && hasFeatChoice(character, plan)) add("skilled", "Skilled proficiencies", 3, [...SKILLS.filter((skill) => !character.skillProficiencies[skill.name]).map((skill) => skill.name), ...["Alchemist’s Supplies", "Brewer’s Supplies", "Calligrapher’s Supplies", "Carpenter’s Tools", "Cartographer’s Tools", "Cook’s Utensils", "Disguise Kit", "Forgery Kit", "Herbalism Kit", "Jeweler’s Tools", "Leatherworker’s Tools", "Mason’s Tools", "Navigator’s Tools", "Poisoner’s Kit", "Potter’s Tools", "Smith’s Tools", "Thieves’ Tools", "Tinker’s Tools", "Weaver’s Tools", "Woodcarver’s Tools"].map((tool) => `Tool: ${tool}`)].filter((option) => !Object.values(character.rulesChoices ?? {}).flat().includes(option)), "Choose three skill or tool proficiencies.");
  const selected = [...Object.values(plan.choices).flat(), ...(plan.replacements ?? []).map(change => change.to)];
  if (selected.includes("Lessons of the First Ones (Skilled)")) add("lessons-skilled", "Lessons · Skilled proficiencies", 3, SKILLS.filter(skill => !character.skillProficiencies[skill.name]).map(skill => String(skill.name)).concat(["Alchemist’s Supplies", "Brewer’s Supplies", "Calligrapher’s Supplies", "Carpenter’s Tools", "Cartographer’s Tools", "Cook’s Utensils", "Disguise Kit", "Forgery Kit", "Herbalism Kit", "Jeweler’s Tools", "Leatherworker’s Tools", "Mason’s Tools", "Navigator’s Tools", "Poisoner’s Kit", "Potter’s Tools", "Smith’s Tools", "Thieves’ Tools", "Tinker’s Tools", "Weaver’s Tools", "Woodcarver’s Tools"].map(tool => `Tool: ${tool}`)), "Choose three new skill or tool proficiencies for this feat.");
  if (selected.includes("Lessons of the First Ones (Magic Initiate)")) {
    add("lessons-magic-class", "Lessons · Magic Initiate spell list", 1, ["Cleric", "Druid", "Wizard"], "Choose this feat’s spell list. Its casting ability and spells are independent of your Warlock casting.");
    add("lessons-magic-ability", "Lessons · Magic Initiate ability", 1, ["Intelligence", "Wisdom", "Charisma"], "Record the feat’s casting ability. Resolve feat-granted casting manually using this ability, and track its free daily use separately.");
    const list = plan.choices[`${name}:lessons-magic-class`]?.[0];
    if (list) { add("lessons-magic-cantrips", "Lessons · Magic Initiate cantrips", 2, SPELL_CATALOG.filter(spell => spell.level === 0 && spell.classes.includes(list)).map(spell => spell.name), "Record two cantrips from the chosen list. Their feat casting remains manual."); add("lessons-magic-spell", "Lessons · Magic Initiate spell", 1, SPELL_CATALOG.filter(spell => spell.level === 1 && spell.classes.includes(list)).map(spell => spell.name), "Record a level 1 spell; its free Long Rest use and chosen casting ability remain manual."); }
  }
  if (selected.includes("Pact of the Tome")) {
    add("tome-cantrips", "Book of Shadows cantrips", 3, SPELL_CATALOG.filter(spell => spell.level === 0 && !effective.spells.some(known => known.name === spell.name && known.prepared)).map(spell => spell.name), "Choose the book’s three cantrips from any class. These are available while you possess the book; change them when you conjure a new book after a rest.");
    add("tome-rituals", "Book of Shadows rituals", 2, SPELL_CATALOG.filter(spell => spell.level === 1 && spell.ritual && !effective.spells.some(known => known.name === spell.name && known.prepared)).map(spell => spell.name), "Choose two level 1 ritual spells from any class. Book-dependent casting remains manual.");
  }
  if (name === "Cleric" && level === 7) add("blessed-strikes", "Blessed Strikes", 1, ["Divine Strike", "Potent Spellcasting"], "Choose your Blessed Strikes benefit; apply its situational effects at the table.");
  if (name === "Druid" && level === 7) add("elemental-fury", "Elemental Fury", 1, ["Primal Strike", "Potent Spellcasting"], "Choose your Elemental Fury benefit; apply its situational effects at the table.");
  const masteryCounts: Record<string, (level: number) => number> = { Barbarian: level => level < 1 ? 0 : level >= 10 ? 4 : level >= 4 ? 3 : 2, Fighter: level => level < 1 ? 0 : level >= 16 ? 6 : level >= 10 ? 5 : level >= 4 ? 4 : 3, Paladin: level => level > 0 ? 2 : 0, Ranger: level => level > 0 ? 2 : 0, Rogue: level => level > 0 ? 2 : 0 };
  const masteryCount = masteryCounts[name] ? masteryCounts[name](level) - masteryCounts[name](level - 1) : 0;
  if (masteryCount) add(`mastery:${level}`, "Weapon Mastery", masteryCount, ["Club", "Dagger", "Greatclub", "Handaxe", "Javelin", "Light Hammer", "Mace", "Quarterstaff", "Sickle", "Spear", "Dart", "Light Crossbow", "Shortbow", "Sling", ...(!["Rogue"].includes(name) ? ["Battleaxe", "Flail", "Glaive", "Greataxe", "Greatsword", "Halberd", "Lance", "Longsword", "Maul", "Morningstar", "Pike", "Rapier", "Scimitar", "Shortsword", "Trident", "War Pick", "Warhammer", "Whip", "Blowgun", "Hand Crossbow", "Heavy Crossbow", "Longbow", "Musket", "Pistol"] : ["Hand Crossbow", "Rapier", "Scimitar", "Shortsword", "Whip"])].filter(value => !recordedChoices(character, `${name}:mastery:`).includes(value)), "Record the weapons whose mastery properties you can use. Resolve mastery effects manually; Long Rest changes remain available by editing your recorded weapon notes.");
  if (name === "Bard" && level === 6 && !plan.customSubclass && plan.subclass === "College of Lore") add("magical-discoveries", "Magical Discoveries", 2, SPELL_CATALOG.filter(spell => spell.level > 0 && spell.level <= 3 && spell.classes.some(name => ["Cleric", "Druid", "Wizard"].includes(name)) && !character.spells.some(known => known.name === spell.name)).map(spell => spell.name), "Choose two Cleric, Druid, or Wizard spells of levels 1–3; these are always-prepared Bard spells.");
  if (name === "Wizard" && level === 18) { for (const spellLevel of [1, 2]) add(`spell-mastery:${spellLevel}`, `Spell Mastery · level ${spellLevel}`, 1, character.spells.filter(spell => spell.level === spellLevel && spell.castingTime.toLowerCase() === "action" && (spell.className ?? character.characterClass) === "Wizard").map(spell => spell.name), "Choose a spell in your spellbook with an action casting time. Its free casting remains manual."); }
  if (name === "Wizard" && level === 20) add("signature-spells", "Signature Spells", 2, character.spells.filter(spell => spell.level === 3 && (spell.className ?? character.characterClass) === "Wizard").map(spell => spell.name), "Choose two level 3 spellbook spells; track their free uses manually.");
  if (name === "Warlock" && [11, 13, 15, 17].includes(level)) { const spellLevel = (level + 1) / 2; add(`arcanum:${spellLevel}`, `Mystic Arcanum · level ${spellLevel}`, 1, SPELL_CATALOG.filter(spell => spell.classes.includes("Warlock") && spell.level === spellLevel).map(spell => spell.name), "Choose the arcanum spell gained at this class level. Casting and its once-per-Long-Rest use remain manual."); }
  if ((name === "Cleric" && selected.includes("Thaumaturge")) || (name === "Druid" && selected.includes("Magician"))) add("order-cantrip", "Order bonus cantrip", 1, SPELL_CATALOG.filter(spell => spell.level === 0 && spell.classes.includes(name) && !effective.spells.some(known => known.name === spell.name)).map(spell => spell.name), "Learn one additional class cantrip.");
  const warrior = name === "Paladin" ? "Blessed Warrior" : name === "Ranger" ? "Druidic Warrior" : "";
  if (warrior && selected.includes(warrior)) add("warrior-cantrips", warrior + " cantrips", 2, SPELL_CATALOG.filter(spell => spell.level === 0 && spell.classes.includes(name === "Paladin" ? "Cleric" : "Druid")).map(spell => spell.name), "These cantrips use your Paladin or Ranger spellcasting ability.");
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
export function spellReplacementOptions(character: Character, plan: LevelUpPlan) {
  if (classLevel(character, plan.className) < 1) return [];
  const cantrip = ["Bard", "Cleric", "Druid", "Sorcerer", "Warlock"].includes(plan.className);
  const leveled = ["Bard", "Sorcerer", "Warlock"].includes(plan.className);
  const maxLevel = spellLimits(character, plan).maxLevel;
  const warriorClass = plan.className === "Paladin" ? "Cleric" : plan.className === "Ranger" ? "Druid" : "";
  return character.spells.filter(spell => (spell.className ?? character.characterClass) === plan.className && ((!spell.alwaysPrepared && (spell.level === 0 ? cantrip : leveled && spell.level <= maxLevel)) || (!!warriorClass && spell.grantedBy === `${plan.className}:warrior-cantrips`))).map(spell => ({ spell, options: SPELL_CATALOG.filter(option => option.classes.some(name => (spell.grantedBy === `${plan.className}:warrior-cantrips` ? [warriorClass] : availableSpellClasses(character, plan)).includes(name)) && (spell.level === 0 ? option.level === 0 : option.level > 0 && option.level <= maxLevel) && !character.spells.some(known => known.name === option.name && (known.className ?? character.characterClass) === plan.className) && !plan.spellKeys.includes(option.key)) }));
}
function spellReplacementErrors(character: Character, plan: LevelUpPlan) {
  const changes = plan.spellReplacements ?? [], errors: string[] = [];
  if (!Array.isArray(changes) || changes.length > 2) return ["Replace at most one cantrip and one leveled spell."];
  const options = spellReplacementOptions(character, plan), kinds: number[] = [];
  for (const change of changes) {
    const source = options.find(option => option.spell.id === change?.fromId);
    if (!source || !source.options.some(option => option.key === change.toKey)) errors.push("Choose an eligible spell replacement from this class.");
    if (source) kinds.push(source.spell.level === 0 ? 0 : 1);
  }
  if (new Set(kinds).size !== kinds.length || new Set(changes.map(change => change.toKey)).size !== changes.length) errors.push("Replace at most one spell of each kind, without duplicate destinations.");
  return errors;
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
  const allowedKeys = new Set(levelChoices(character, plan).map(choice => choice.key));
  if (Object.keys(plan.choices).some(key => !allowedKeys.has(key))) errors.push("An unrecognized feature choice was supplied.");
  const groups = replacementGroups(character, plan.className);
  if (!Array.isArray(plan.replacements ?? []) || (plan.replacements?.length ?? 0) > 2) errors.push("Replace at most one class option and one arcanum per class level.");
  else for (const change of plan.replacements ?? []) if (!change || !groups.some(group => group.key === change.key && group.from === change.from && group.options.includes(change.to))) errors.push("Choose a valid replacement from this class’s recorded options.");
  const swapKinds = (plan.replacements ?? []).map(change => change.key?.includes(":arcanum:") ? "arcanum" : "class");
  if (new Set(swapKinds).size !== swapKinds.length) errors.push("Replace at most one option of each kind per class level.");
  const updatedChoices = { ...replaceChoices(character, plan.replacements ?? []), ...plan.choices };
  if (plan.className === "Warlock") {
    const activeInvocations = recordedChoices({ ...character, rulesChoices: updatedChoices }, "Warlock:invocations:");
    const spellPreview = { ...next, spells: [...character.spells.filter(spell => !(plan.spellReplacements ?? []).some(change => change.fromId === spell.id)), ...plan.spellKeys.map((key, index) => spellFromCatalog(key, 'preview-' + index, plan.className)), ...(plan.spellReplacements ?? []).filter(change => SPELL_CATALOG.some(spell => spell.key === change.toKey)).map((change, index) => spellFromCatalog(change.toKey, 'swap-' + index, plan.className))] };
    errors.push(...invocationErrors(activeInvocations, level, spellPreview));
    for (const change of plan.replacements ?? []) { const dependent = activeInvocations.map(choiceBase).find(name => INVOCATIONS.find(invocation => invocation.name === name)?.dependency === choiceBase(change.from)); if (dependent) errors.push(`Cannot replace ${change.from}: ${dependent} requires it.`); }
  }
  errors.push(...spellReplacementErrors(character, plan));
  const limits = spellLimits(character, plan), selected = plan.spellKeys.map((key) => SPELL_CATALOG.find((spell) => spell.key === key));
  if (new Set(plan.spellKeys).size !== plan.spellKeys.length) errors.push("Select each spell only once.");
  if (selected.some((spell) => !spell || !spell.classes.some(name => availableSpellClasses(character, plan).includes(name)) || spell.level > limits.maxLevel || character.spells.some((known) => (known.catalogKey === spell.key || known.name === spell.name) && (known.className ?? character.characterClass) === plan.className))) errors.push("Select new spells from this class’s available spell levels.");
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
  next.rulesChoices = { ...replaceChoices(character, plan.replacements), ...plan.choices };
  next.skillProficiencies = { ...character.skillProficiencies };
  for (const choice of levelChoices(character, plan)) for (const selected of plan.choices[choice.key] ?? []) {
    if (choice.key.includes("expertise") || choice.key.endsWith("scholar")) next.skillProficiencies[selected as SkillName] = 2;
    if (choice.key.endsWith("lore-skills") || choice.key.endsWith("skilled")) if (!selected.startsWith("Tool:")) next.skillProficiencies[selected as SkillName] = 1;
  }
  if (featChoice && plan.feat === "Resilient") next.rulesChoices["feat:Resilient"] = Object.entries(plan.boosts).filter(([, boost]) => boost === 1).map(([ability]) => ability);
  const invocationFeatures = levelChoices(character, plan).filter((choice) => choice.key.includes(":invocations:")).flatMap((choice) => plan.choices[choice.key] ?? []).map((name, index) => ({ id: `${id}-invocation-${index}`, name, category: "class" as const, description: INVOCATIONS.find((entry) => entry.name === choiceBase(name))?.description ?? "" }));
  const features = gainedRuleFeatures(plan.className, level, plan.customSubclass ? "" : plan.subclass).map((feature, index) => ({ id: `${id}-feature-${index}`, name: feature.name, category: "class" as const, description: feature.description }));
  const customFeatures = (plan.customFeatures ?? []).map((feature, index) => ({ id: `${id}-custom-${index}`, name: feature.name.trim(), description: feature.description.trim(), category: "class" as const, manualOnly: true, source: `${plan.subclass} · ${plan.className} ${level}` }));
  const styles = levelChoices(character, plan).filter((choice) => choice.key.includes(":style:")).flatMap((choice) => plan.choices[choice.key] ?? []);
  const removedNames = new Set((plan.replacements ?? []).map(change => change.from));
  const replacementFeatures = (plan.replacements ?? []).map((change, index) => ({ id: id + '-replacement-' + index, name: change.to, category: (change.key.includes(':style:') ? 'feat' : 'class') as 'feat' | 'class', description: INVOCATIONS.find(i => i.name === choiceBase(change.to))?.description ?? FEAT_CATALOG.find(f => f.name === change.to)?.description ?? '', source: plan.className + ' · replacement' }));
  next.features = [...character.features.filter(feature => feature.manualOnly || !removedNames.has(feature.name)), ...replacementFeatures, ...features, ...invocationFeatures, ...[...(featChoice && plan.feat !== "Ability Score Improvement" ? [plan.feat] : []), ...styles].map((name, index) => ({ id: `${id}-feat-${index}`, name, category: "feat" as const, description: FEAT_CATALOG.find((feat) => feat.name === name)?.description ?? "" }))];
  next.features.push(...customFeatures);
  next.features = next.features.filter(feature => !feature.source?.startsWith('invocation-grant:'));
  for (const value of recordedChoices(next, 'Warlock:invocations:').filter(value => value.startsWith('Lessons of the First Ones ('))) {
    const featName = value.slice('Lessons of the First Ones ('.length, -1), feat = FEAT_CATALOG.find(feat => feat.name === featName);
    if (feat) next.features.push({ id: id + '-lesson-' + next.features.length, name: feat.name, category: 'feat', description: feat.description, source: 'invocation-grant:' + value });
  }
  next.spells = [...character.spells.filter(spell => !removedNames.has(spell.grantedBy?.replace("invocation:", "") ?? "") && !(plan.replacements ?? []).some(change => change.key.includes(":arcanum:") && spell.name === change.from && (spell.className ?? character.characterClass) === "Warlock") && !(plan.spellReplacements ?? []).some(change => change.fromId === spell.id)), ...(plan.spellReplacements ?? []).map((change, index) => ({ ...spellFromCatalog(change.toKey, id + "-swap-" + index, plan.className), ...(character.spells.find(spell => spell.id === change.fromId)?.grantedBy ? { grantedBy: character.spells.find(spell => spell.id === change.fromId)?.grantedBy, alwaysPrepared: true } : {}) })), ...plan.spellKeys.map((key, index) => spellFromCatalog(key, `${id}-spell-${index}`, plan.className))];
  for (const choice of levelChoices(character, plan).filter(choice => /:order-cantrip$|:warrior-cantrips$|:arcanum:|:tome-|:magical-discoveries$/.test(choice.key))) for (const name of plan.choices[choice.key] ?? []) {
    const spell = SPELL_CATALOG.find(spell => spell.name === name);
    if (spell && !next.spells.some(known => known.name === name && known.className === plan.className)) next.spells.push({ ...spellFromCatalog(spell.key, id + '-grant-' + next.spells.length, plan.className), alwaysPrepared: true, grantedBy: choice.key.includes(":tome-") ? "invocation:Pact of the Tome" : choice.key });
  }
  for (const change of (plan.replacements ?? []).filter(change => change.key.includes(':arcanum:'))) { const spell = SPELL_CATALOG.find(spell => spell.name === change.to); if (spell) next.spells.push({ ...spellFromCatalog(spell.key, id + '-arcanum-swap', 'Warlock'), alwaysPrepared: true, grantedBy: change.key }); }
  if (removedNames.has('Pact of the Tome')) { for (const key of Object.keys(next.rulesChoices)) if (key.startsWith('Warlock:tome-')) delete next.rulesChoices[key]; next.features = next.features.filter(feature => feature.source !== 'Warlock · Book of Shadows'); }
  next.customResources = [...character.customResources];
  for (const key of Object.keys(next.rulesChoices).filter(key => key.startsWith('Warlock:arcanum:'))) if (!next.customResources.some(resource => resource.id === key)) next.customResources.push({ id: key, name: 'Mystic Arcanum · level ' + key.split(':')[2], maxUses: 1, used: 0, recovery: 'long' });
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
  next.advancement = [...(character.advancement ?? []), { id, level: next.level, className: plan.className, classLevel: level, subclass: plan.subclass, feat: featChoice ? plan.feat : "", boosts: plan.boosts, spells: plan.spellKeys, choices: { ...plan.choices, ...((plan.replacements?.length ?? 0) ? { replacements: plan.replacements!.map(change => change.from + " → " + change.to) } : {}), ...((plan.spellReplacements?.length ?? 0) ? { spellReplacements: plan.spellReplacements!.map(change => (character.spells.find(spell => spell.id === change.fromId)?.name ?? change.fromId) + " → " + (SPELL_CATALOG.find(spell => spell.key === change.toKey)?.name ?? change.toKey)) } : {}) }, hpRoll: plan.hpRoll, createdAt: now }];
  return { customResources: next.customResources, customSubclasses: next.customSubclasses, level: next.level, classLevels: next.classLevels, subclass: next.subclass, classSubclasses: next.classSubclasses, abilityScores: next.abilityScores, abilityScoreOverrides: next.abilityScoreOverrides, rulesChoices: next.rulesChoices, skillProficiencies: next.skillProficiencies, features: next.features, spells: next.spells, hitPointAdjustment: next.hitPointAdjustment, currentHitPoints: next.currentHitPoints, advancement: next.advancement };
}
