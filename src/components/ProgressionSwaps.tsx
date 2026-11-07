import type { Character } from '../data/characters';
import { spellReplacementOptions, type LevelUpPlan } from '../data/advancement';
import { replacementGroups } from '../data/buildChoices';

export function ProgressionSwaps({ character, plan, onChange, section }: { character: Character; plan: LevelUpPlan; onChange: (plan: LevelUpPlan) => void; section: 'features' | 'spells' }) {
  if (section === 'features') {
    const groups = replacementGroups(character, plan.className);
    if (!groups.length) return null;
    return <>{['class', 'arcanum'].map(kind => {
      const available = groups.filter(group => group.key.includes(':arcanum:') === (kind === 'arcanum'));
      if (!available.length) return null;
      const selected = (plan.replacements ?? []).find(change => change.key.includes(':arcanum:') === (kind === 'arcanum'));
      const source = available.find(group => group.key === selected?.key && group.from === selected?.from);
      const update = (value: typeof selected) => onChange({ ...plan, replacements: [...(plan.replacements ?? []).filter(change => change.key.includes(':arcanum:') !== (kind === 'arcanum')), ...(value ? [value] : [])] });
      return <section className="level-choice-section" key={kind}><h3>{kind === 'arcanum' ? 'Optional Mystic Arcanum replacement' : 'Optional class option replacement'}</h3><p>Replace one option when gaining a level in its class. Dependent invocations must retain their prerequisite. Arcanum replacements keep the same spell level.</p><label>Replace existing {kind === 'arcanum' ? 'arcanum' : 'class option'}<select value={source ? available.indexOf(source) : ''} onChange={event => { const group = available[Number(event.target.value)]; update(event.target.value === '' ? undefined : { key: group.key, from: group.from, to: '' }); }}><option value="">Keep existing choices</option>{available.map((group, index) => <option key={group.key + group.from} value={index}>{group.title}: {group.from}</option>)}</select></label>{source && <label>New {kind === 'arcanum' ? 'arcanum spell' : 'class option'}<select value={selected?.to ?? ''} onChange={event => update({ ...selected!, to: event.target.value })}><option value="">Choose replacement…</option>{source.options.map(option => <option key={option}>{option}</option>)}</select></label>}</section>;
    })}</>;
  }
  const sources = spellReplacementOptions(character, plan);
  if (!sources.length) return null;
  return <section className="level-choice-section"><h3>Optional spell replacements</h3><p>These replace existing spells separately from new spell selections. Granted spells and spells from other classes are protected.</p>{[0, 1].map(kind => { const available = sources.filter(source => Number(source.spell.level > 0) === kind); if (!available.length) return null; const selected = (plan.spellReplacements ?? []).find(change => available.some(source => source.spell.id === change.fromId)); const source = available.find(source => source.spell.id === selected?.fromId); const update = (value: { fromId: string; toKey: string } | null) => onChange({ ...plan, spellReplacements: [...(plan.spellReplacements ?? []).filter(change => !available.some(source => source.spell.id === change.fromId)), ...(value ? [value] : [])] }); return <div className="play-controls" key={kind}><label>{kind ? 'Replace one leveled spell' : 'Replace one cantrip'}<select value={source?.spell.id ?? ''} onChange={event => update(event.target.value ? { fromId: event.target.value, toKey: '' } : null)}><option value="">Keep existing spells</option>{available.map(source => <option key={source.spell.id} value={source.spell.id}>{source.spell.name}</option>)}</select></label>{source && <label>Replacement spell<select value={selected?.toKey ?? ''} onChange={event => update({ fromId: source.spell.id, toKey: event.target.value })}><option value="">Choose replacement…</option>{source.options.map(spell => <option key={spell.key} value={spell.key}>{spell.name} · {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}</option>)}</select></label>}</div>; })}</section>;
}
