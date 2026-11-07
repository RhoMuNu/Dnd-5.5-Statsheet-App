import type { RuleChoice } from '../data/advancement';
import { featureDescription } from '../data/featureDescriptions';
import { choiceBase, INVOCATIONS } from '../data/buildChoices';
import { RulesDescription } from './RulesDescription';

export function BuildChoicePicker({ choices, values, onChange }: { choices: RuleChoice[]; values: Record<string, string[]>; onChange: (values: Record<string, string[]>) => void }) {
  return <>{choices.map(choice => <section className="level-choice-section" key={choice.key}><h3>{choice.title} <small>{values[choice.key]?.length ?? 0} / {choice.count}</small></h3><p>{choice.description}</p><div className="build-choice-options">{choice.options.map(option => { const description = INVOCATIONS.find(i => i.name === choiceBase(option))?.description ?? featureDescription(option); return <article key={option}><label><input type="checkbox" checked={values[choice.key]?.includes(option) ?? false} onChange={event => { const selected = values[choice.key] ?? []; onChange({ ...values, [choice.key]: event.target.checked ? selected.length < choice.count ? [...selected, option] : choice.count === 1 ? [option] : selected : selected.filter(value => value !== option) }); }} />{option}</label>{description && <details><summary>What it does</summary><RulesDescription description={description} /></details>}</article>; })}</div></section>)}</>;
}
