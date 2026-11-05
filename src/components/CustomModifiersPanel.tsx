import { useState, type FormEvent } from "react";
import { makeCharacterId, type Character } from "../data/characters";
import { modifierTargets, type CustomModifier } from "../data/customModifiers";

export function CustomModifiersPanel({ character, onChange, readOnly = false }: { character: Character; onChange?: (updates: Partial<Character>) => void; readOnly?: boolean }) {
  const modifiers = character.customModifiers ?? [];
  const [name, setName] = useState("");
  const [target, setTarget] = useState("ac");
  const [amount, setAmount] = useState("1");
  const targets = modifierTargets();
  const update = (id: string, patch: Partial<CustomModifier>) => onChange?.({ customModifiers: modifiers.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) });
  function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !amount.trim() || !Number.isInteger(Number(amount)) || Math.abs(Number(amount)) > 100 || modifiers.length >= 100) return;
    onChange?.({ customModifiers: [...modifiers, { id: makeCharacterId(), name: name.trim(), target, amount: Number(amount), enabled: true }] }); setName("");
  }
  return <details className="sheet-panel custom-modifier-panel"><summary><strong>Custom stat boosts</strong><span>{modifiers.filter((entry) => entry.enabled).length} active</span></summary><p className="setup-note">Add homebrew, magic-item, or situational bonuses. Enabled boosts stack and apply in every mode. Turn a source off when it no longer applies. Negative values apply penalties.</p><fieldset disabled={readOnly || !onChange}>
    <div className="custom-modifier-list">{modifiers.map((entry) => <article className="custom-modifier-row" key={entry.id}><label className="toggle-row"><input type="checkbox" aria-label={`Enable ${entry.name}`} checked={entry.enabled} onChange={(event) => update(entry.id, { enabled: event.target.checked })} />Active</label><label>Source<input aria-label={`${entry.name} source`} maxLength={80} value={entry.name} onChange={(event) => update(entry.id, { name: event.target.value })} /></label><label>Stat<select aria-label={`${entry.name} stat`} value={entry.target} onChange={(event) => update(entry.id, { target: event.target.value })}>{targets.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</select></label><label>Bonus<input aria-label={`${entry.name} bonus`} type="number" min={-100} max={100} value={entry.amount} onChange={(event) => { const amount = Number(event.target.value); if (Number.isInteger(amount) && Math.abs(amount) <= 100) update(entry.id, { amount }); }} /></label><button type="button" className="text-button" aria-label={`Remove ${entry.name} boost`} onClick={() => onChange?.({ customModifiers: modifiers.filter((item) => item.id !== entry.id) })}>Remove</button></article>)}</div>
    <form onSubmit={add} className="custom-modifier-add"><label>Boost source<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ring of protection" /></label><label>Boost stat<select value={target} onChange={(event) => setTarget(event.target.value)}>{targets.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</select></label><label>Boost amount<input required type="number" min={-100} max={100} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><button className="primary-button" type="submit" disabled={modifiers.length >= 100}>Add boost</button></form>
  </fieldset></details>;
}
