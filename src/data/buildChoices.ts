import type { Character } from './characters';
import { CLASS_CATALOG, FEAT_CATALOG, SPELL_CATALOG, classLevel } from './rulesCatalog';
import { BACKGROUNDS } from './creationOptions';

export const INVOCATIONS = (CLASS_CATALOG.find(c => c.name === 'Warlock')?.features.find(f => f.name === 'Eldritch Invocation Options')?.desc ?? '').split(/\n### /).slice(1).map(section => {
  const [heading, ...body] = section.split('\n'); const description = body.join('\n').trim();
  return { name: heading.replaceAll('*', '').trim(), description, minimum: Number(description.match(/Level (\d+)\+ Warlock/)?.[1] ?? 1), dependency: description.match(/, ([^,*\n]+) Invocation/)?.[1] };
});
export const METAMAGIC = ['Careful Spell', 'Distant Spell', 'Empowered Spell', 'Extended Spell', 'Heightened Spell', 'Quickened Spell', 'Seeking Spell', 'Subtle Spell', 'Transmuted Spell', 'Twinned Spell'];
export const choiceBase = (name: string) => name.replace(/ \(.+\)$/, '');
export const recordedChoices = (character: Character, kind: string) => Object.entries(character.rulesChoices ?? {}).filter(([key]) => key.startsWith(kind)).flatMap(([, values]) => values);
export function pruneChoices(values: Record<string, string[]>, definitions: { key: string; options: string[] }[]) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => definitions.some(choice => choice.key === key)).map(([key, selected]) => [key, selected.filter(value => definitions.find(choice => choice.key === key)!.options.includes(value))]));
}
export function invocationOptions(character: Character, level: number) {
  const cantrips = character.spells.filter(s => s.level === 0 && (s.className ?? character.characterClass) === 'Warlock');
  return INVOCATIONS.filter(i => i.minimum <= level).flatMap(invocation => {
    if (['Agonizing Blast', 'Eldritch Spear', 'Repelling Blast'].includes(invocation.name)) return cantrips.filter(spell => {
      const description = SPELL_CATALOG.find(s => s.key === spell.catalogKey || s.name === spell.name)?.description ?? spell.description;
      return /damage/i.test(description) && (invocation.name !== 'Repelling Blast' || /spell attack/i.test(description)) && (invocation.name !== 'Eldritch Spear' || Number(spell.range.match(/\d+/)?.[0] ?? 0) >= 10);
    }).map(spell => `${invocation.name} (${spell.name})`);
    if (invocation.name === 'Lessons of the First Ones') return FEAT_CATALOG.filter(f => f.type === 'Origin' && f.name !== BACKGROUNDS[character.background]?.feat && !character.features.some(feature => feature.category === 'feat' && !feature.source?.startsWith('invocation-grant:') && feature.name === f.name)).map(feat => `${invocation.name} (${feat.name})`);
    return [invocation.name];
  });
}
export function invocationErrors(values: string[], level: number, character: Character) {
  const errors: string[] = [], bases = values.map(choiceBase), options = invocationOptions(character, level);
  for (const value of values) {
    const entry = INVOCATIONS.find(i => i.name === choiceBase(value));
    // Unqualified legacy repeatable records need their cantrip/feat specified again.
    if (!entry || !options.includes(value)) errors.push(`Choose an eligible invocation: ${value}.`);
    if (entry?.dependency && !bases.includes(entry.dependency)) errors.push(`${entry.name} requires ${entry.dependency}.`);
  }
  if (new Set(values).size !== values.length) errors.push('Each invocation and repeatable target must be distinct.');
  return errors;
}
export type ChoiceReplacement = { key: string; from: string; to: string };
export function replaceChoices(character: Character, replacements: ChoiceReplacement[] = []) {
  const result = Object.fromEntries(Object.entries(character.rulesChoices ?? {}).map(([key, values]) => [key, [...values]]));
  for (const replacement of replacements) if (result[replacement.key]) result[replacement.key] = result[replacement.key].map(value => value === replacement.from ? replacement.to : value);
  return result;
}
export function replacementGroups(character: Character, className: string) {
  if (classLevel(character, className) < 1) return [];
  const kind = className === 'Warlock' ? 'invocations:' : className === 'Sorcerer' ? 'metamagic:' : className === 'Fighter' ? 'style:' : '';
  if (!kind) return [];
  const known = recordedChoices(character, `${className}:${kind}`);
  const primary = Object.entries(character.rulesChoices ?? {}).filter(([key]) => key.startsWith(`${className}:${kind}`)).flatMap(([key, values]) => values.map(from => ({ key, from, title: className === 'Warlock' ? 'Eldritch Invocation' : className === 'Sorcerer' ? 'Metamagic' : 'Fighting Style', options: (className === 'Warlock' ? invocationOptions(character, classLevel(character, className) + 1) : className === 'Sorcerer' ? METAMAGIC : FEAT_CATALOG.filter(f => f.type === 'Fighting Style').map(f => f.name)).filter(value => !known.includes(value)) })));
  const arcanum = className === 'Warlock' ? Object.entries(character.rulesChoices ?? {}).filter(([key]) => key.startsWith('Warlock:arcanum:')).flatMap(([key, values]) => values.map(from => ({ key, from, title: 'Mystic Arcanum', options: SPELL_CATALOG.filter(spell => spell.classes.includes('Warlock') && spell.level === Number(key.split(':')[2]) && !values.includes(spell.name)).map(spell => spell.name) }))) : [];
  return [...primary, ...arcanum];
}
