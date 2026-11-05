import { useState } from "react";
import { makeCharacterId, type Character } from "../data/characters";
import { activeEffects, advanceEffects, EFFECT_PRESETS, makeEffect, type ActiveEffect } from "../data/effects";
import { combatState } from "../data/gameplay";

export function EffectsPanel({ character, onChange, readOnly = false }: { character: Character; onChange?: (updates: Partial<Character>) => void; readOnly?: boolean }) {
  const [preset, setPreset] = useState("Bless");
  const applied = activeEffects(character);
  const automatic = applied.filter((effect) => effect.id.startsWith("automatic-") || effect.id === "eldritch-mind");
  const effects = applied.filter((effect) => !automatic.includes(effect));
  const save = (next: ActiveEffect[]) => onChange?.({ combat: { ...combatState(character), effects: next } });
  const update = (id: string, patch: Partial<ActiveEffect>) => save(effects.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  return <section className="derived-panel gameplay-panel" aria-label="Active effects and feat modifiers"><p className="eyebrow">EFFECTS, FEATS &amp; CUSTOM MODIFIERS</p>
    <p className="setup-note">Add effects after receiving them or choosing a feat. These modifiers apply to your sheet. Keep effects on each recipient; remove them when their source ends.</p>
    {automatic.map((effect) => <p className="setup-note" key={effect.id}><strong>{effect.name}</strong> · applied automatically from your features or background.</p>)}
    <fieldset disabled={readOnly}><div className="play-controls"><label>Effect template<select value={preset} onChange={(event) => setPreset(event.target.value)}>{Object.keys(EFFECT_PRESETS).map((name) => <option key={name}>{name}</option>)}</select></label><button type="button" disabled={effects.length >= 50 || (preset !== "Custom modifier" && effects.some((effect) => effect.name === preset))} onClick={() => save([...effects, { ...makeEffect(preset, makeCharacterId()), ...(preset === "Custom modifier" ? { name: `Custom modifier ${effects.length + 1}` } : {}) }])}>Add effect</button></div>
      {effects.map((effect) => <article className="attack-card" key={effect.id}><strong>{effect.name} · {effect.rounds === null ? "until removed" : `${effect.rounds} rounds remaining`}</strong><div className="play-controls"><button type="button" onClick={() => save(effects.filter((entry) => entry.id !== effect.id))}>End {effect.name}</button></div><details><summary>Edit modifiers &amp; duration</summary>
        <div className="play-controls"><label>Effect name<input maxLength={80} value={effect.name} onChange={(event) => update(effect.id, { name: event.target.value })} /></label><label>Rounds (blank = indefinite)<input type="number" min={1} max={10000} value={effect.rounds ?? ""} onChange={(event) => { const value = event.target.value; if (value === "") update(effect.id, { rounds: null }); else if (Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 10000) update(effect.id, { rounds: Number(value) }); }} /></label></div>
        <div className="play-controls">{([['ac', 'AC'], ['attack', 'Attack'], ['damage', 'Damage'], ['save', 'Saves'], ['check', 'Ability checks'], ['speed', 'Speed (ft)'], ['initiative', 'Initiative'], ['hpPerLevel', 'HP per level']] as const).map(([key, name]) => <label key={key}>{name}<input type="number" min={-100} max={100} value={effect[key]} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && Math.abs(value) <= (key === "hpPerLevel" ? 10 : 100)) update(effect.id, { [key]: value }); }} /></label>)}</div>
        <div className="play-controls">{([['attackDie', 'Attack bonus die'], ['saveDie', 'Save bonus die']] as const).map(([key, name]) => <label key={key}>{name}<select value={effect[key]} onChange={(event) => update(effect.id, { [key]: Number(event.target.value) })}>{[0, 4, 6, 8, 10, 12, -4, -6, -8, -10, -12].map((value) => <option key={value} value={value}>{value === 0 ? "None" : `${value > 0 ? "+" : "−"}d${Math.abs(value)}`}</option>)}</select></label>)}</div>
        <label className="toggle-row"><input type="checkbox" checked={effect.concentrationAdvantage} onChange={(event) => update(effect.id, { concentrationAdvantage: event.target.checked })} />Advantage on concentration saves</label><label className="toggle-row"><input type="checkbox" checked={effect.initiativeProficiency} onChange={(event) => update(effect.id, { initiativeProficiency: event.target.checked })} />Add proficiency to initiative (once)</label>
      </details></article>)}
      <button type="button" className="resource-rest-button" disabled={!effects.some((effect) => effect.rounds !== null)} onClick={() => save(advanceEffects(character))}>Advance effect timers · 1 round</button>
    </fieldset><p className="setup-note">Manual timers advance with this button. Host-targeted effects also expire at the caster’s turn starts in LAN combat, and their concentration links clear automatically. For manually added Shield/Bless/Bane, remove the effect at its normal ending trigger. Additional feat benefits and prerequisites remain with the DM.</p>
  </section>;
}
