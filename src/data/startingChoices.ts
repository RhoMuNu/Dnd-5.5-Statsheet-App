import { levelChoices, newLevelUpPlan } from './advancement';
import { choiceBase, INVOCATIONS } from './buildChoices';
import { featureDescription } from './featureDescriptions';
import { FEAT_CATALOG, SPELL_CATALOG, spellFromCatalog } from './rulesCatalog';
import type { Character, CharacterFeature, SkillName } from './characters';
import { SKILLS } from './characters';
import { BACKGROUNDS } from './creationOptions';

export function startingClassChoices(character: Character, choices: Record<string, string[]>) {
  const base = { ...character, level: 0, classLevels: { [character.characterClass]: 0 }, rulesChoices: {}, features: [] };
  const result = levelChoices(base, { ...newLevelUpPlan(base), choices });
  const origin = BACKGROUNDS[character.background]?.feat ?? '';
  if (/^Human(?:\s*\(|$)/.test(character.species)) result.push({ key: 'Human:origin-feat', title: 'Versatile · Origin feat', count: 1, options: FEAT_CATALOG.filter(feat => feat.type === 'Origin' && feat.name !== origin).map(feat => feat.name), description: 'Choose the extra Origin feat granted by your Human species.' });
  const selected = [origin, ...(choices['Human:origin-feat'] ?? [])];
  if (selected.includes('Skilled')) result.push({ key: 'Origin:skilled', title: 'Skilled proficiencies', count: 3, options: SKILLS.filter(skill => !character.skillProficiencies[skill.name]).map(skill => String(skill.name)).concat(["Alchemist’s Supplies", "Brewer’s Supplies", "Calligrapher’s Supplies", "Carpenter’s Tools", "Cartographer’s Tools", "Cook’s Utensils", "Disguise Kit", "Forgery Kit", "Herbalism Kit", "Jeweler’s Tools", "Leatherworker’s Tools", "Mason’s Tools", "Navigator’s Tools", "Poisoner’s Kit", "Potter’s Tools", "Smith’s Tools", "Thieves’ Tools", "Tinker’s Tools", "Weaver’s Tools", "Woodcarver’s Tools"].map(tool => `Tool: ${tool}`)), description: 'Choose three additional skill or tool proficiencies for your Origin feat.' });
  for (const [index, feat] of selected.entries()) if (feat.startsWith('Magic Initiate')) {
    const prefix = `Origin:magic-${index}`, fixedList = feat.match(/\((.*)\)/)?.[1], list = fixedList ?? choices[prefix + '-class']?.[0];
    if (!fixedList) result.push({ key: prefix + '-class', title: 'Magic Initiate · spell list', count: 1, options: ['Cleric', 'Druid', 'Wizard'].filter(name => !origin.includes(`(${name})`)), description: 'Choose a different spell list for each instance of this feat.' });
    result.push({ key: prefix + '-ability', title: 'Magic Initiate · casting ability', count: 1, options: ['Intelligence', 'Wisdom', 'Charisma'], description: 'Record the feat’s casting ability; use it when resolving these feat spells manually.' });
    if (list) for (const [level, count] of [[0, 2], [1, 1]]) result.push({ key: prefix + '-spells-' + level, title: `Magic Initiate · ${level ? 'level 1 spell' : 'cantrips'}`, count, options: SPELL_CATALOG.filter(spell => spell.level === level && spell.classes.includes(list)).map(spell => spell.name), description: 'Save the feat’s spells as build references. Add them to the Spellbook if desired; their chosen ability and free Long Rest casting remain manual.' });
  }
  return result;
}
export function startingChoiceErrors(character: Character, values: Record<string, string[]>) {
  const choices = startingClassChoices(character, values);
  return [...choices.filter(choice => { const selected = values[choice.key] ?? []; return selected.length !== choice.count || new Set(selected).size !== selected.length || selected.some(value => !choice.options.includes(value)); }).map(choice => `Choose ${choice.count} valid option(s) for ${choice.title}.`), ...(Object.keys(values).some(key => !choices.some(choice => choice.key === key)) ? ['Remove choices that do not belong to this class.'] : [])];
}
export function applyStartingChoices(character: Character, values: Record<string, string[]>): Partial<Character> {
  const errors = startingChoiceErrors(character, values); if (errors.length) throw new Error(errors.join(' '));
  const skills = { ...character.skillProficiencies }, features: CharacterFeature[] = [...character.features], spells = [...character.spells];
  for (const [key, selected] of Object.entries(values)) for (const value of selected) {
    if (key.includes(':expertise:')) skills[value as SkillName] = 2;
    if (key === 'Origin:skilled' && !value.startsWith('Tool:')) skills[value as SkillName] = 1;
    const feat = FEAT_CATALOG.find(feat => feat.name === value);
    features.push({ id: `starting-choice-${features.length}`, name: value, category: feat ? 'feat' : 'class', description: INVOCATIONS.find(i => i.name === choiceBase(value))?.description || featureDescription(value, character) || SPELL_CATALOG.find(spell => spell.name === value)?.description || featureDescription(key.includes(":mastery:") ? "Weapon Mastery" : key.includes(":tome-") ? "Pact of the Tome" : "", character) || startingClassChoices(character, values).find(choice => choice.key === key)?.description || "Resolve this chosen ability using its parent feature’s rules.", source: character.characterClass + (key.includes(':tome-') ? ' · Book of Shadows' : ' · starting choice') });
    if (/:order-cantrip$|:tome-/.test(key)) { const spell = SPELL_CATALOG.find(spell => spell.name === value); if (spell) spells.push({ ...spellFromCatalog(spell.key, 'starting-grant-' + spells.length, character.characterClass), alwaysPrepared: true, grantedBy: key.includes(":tome-") ? "invocation:Pact of the Tome" : key }); }
  }
  return { rulesChoices: values, skillProficiencies: skills, features, spells };
}
