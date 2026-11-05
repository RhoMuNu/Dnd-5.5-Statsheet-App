import { characterAttacks, removeCharacterAttack } from "../data/inventoryWeapons";
import { spendTurn } from "../data/economy";
import { useDiceRoll } from "./DiceProvider";
import { useTableActivity } from "../data/tableActivity";
import { useState } from "react";
import { ABILITIES, makeCharacterId, type Character, type CharacterAttack } from "../data/characters";
import { attackNumbers, makeWeaponAttack, rollWeaponAttack, rollWeaponDamage, WEAPON_PRESETS } from "../data/attacks";
import { isIncapacitated, type RollMode } from "../data/conditions";
import { calculateCharacterStats } from "../data/calculations";

export function AttacksPanel({ character, onChange, readOnly = false }: { character: Character; onChange?: (updates: Partial<Character>) => void; readOnly?: boolean }) {
  const dice = useDiceRoll(character.updatedAt);
  const attacks = characterAttacks(character);
  const publish = useTableActivity(character.id);
  function report(summary: string) { setMessage(summary); publish(summary); }
  const stats = calculateCharacterStats(character);
  const [preset, setPreset] = useState("Dagger");
  const [mode, setMode] = useState<RollMode>("normal");
  const [ac, setAc] = useState("");
  const [reactionAttack, setReactionAttack] = useState(false);
  const [critical, setCritical] = useState(false);
  const [sneak, setSneak] = useState(false);
  const [rage, setRage] = useState(false);
  const [advantage, setAdvantage] = useState(false);
  const [disadvantage, setDisadvantage] = useState(false);
  const [message, setMessage] = useState("");
  const update = (id: string, patch: Partial<CharacterAttack>) => onChange?.({ attacks: attacks.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) });
  const modifier = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
  const canAct = !readOnly && !isIncapacitated(character);
  const targetAC = ac.trim() && Number.isInteger(Number(ac)) && Number(ac) >= 0 ? Number(ac) : null;
  function markAttack(entry: CharacterAttack) {
    try { onChange?.(spendTurn(character, entry.offHand ? "bonus" : "attack")); report(`${entry.name}: attack used. Resolve hit and damage at the table.`); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Cannot attack now."); }
  }
  async function attack(entry: CharacterAttack) {
    try {
    const rolled = await dice.run(`${entry.name} attack`, (die) => rollWeaponAttack(character, entry, mode, targetAC, advantage, disadvantage, die, reactionAttack ? "reaction" : undefined));
    if (!rolled) return; const result = rolled.result;
    onChange?.(result.updates);
    setCritical(result.critical);
    report(`${rolled.physical ? "Physical dice · " : ""}${entry.name}: d20 [${result.rolls.join(", ")}] ${modifier(result.bonus)}${result.effectRolls.length ? ` + effects [${result.effectRolls.join(", ")}]` : ""} = ${result.total} (${result.mode}) · ${result.critical ? "critical hit" : result.hit === false ? "miss" : result.hit ? "hit" : "compare to target AC"}`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Cannot attack now."); }
  }
  async function damage(entry: CharacterAttack) {
    try {
    const rolled = await dice.run(`${entry.name} damage`, (die) => rollWeaponDamage(character, entry, critical, sneak, rage, die));
    if (!rolled) return; const result = rolled.result;
    onChange?.(result.updates);
    report(`${entry.name}: [${result.rolls.join(", ") || "no dice"}]${result.sneak.length ? ` + Sneak Attack [${result.sneak.join(", ")}]` : ""} ${modifier(result.bonus)} = ${result.total} ${entry.damageType} damage${critical ? " (critical dice doubled)" : ""}. Apply to the target after a hit.`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Cannot apply damage now."); }
  }
  return <section className="derived-panel gameplay-panel" aria-label="Attacks and damage"><p className="eyebrow">ATTACKS &amp; DAMAGE</p>
    <fieldset disabled={readOnly}><div className="play-controls"><label>Weapon preset<select value={preset} onChange={(event) => setPreset(event.target.value)}>{WEAPON_PRESETS.map((entry) => <option key={entry.name}>{entry.name}</option>)}</select></label><button type="button" disabled={attacks.length >= 100} onClick={() => onChange?.({ attacks: [...attacks, makeWeaponAttack(character, preset, makeCharacterId())] })}>Add attack</button></div>
      <p className="setup-note">Check weapon proficiency and ability after adding. Edit a preset for custom weapons or spells. Equipped standard weapons appear here automatically. Unequipping removes their linked attacks. Ammunition is tracked separately.</p>
      {!dice.classic && <><div className="play-controls"><label>Target AC (optional)<input type="number" min={0} max={50} value={ac} onChange={(event) => setAc(event.target.value)} /></label><label>Roll mode<select value={mode} onChange={(event) => setMode(event.target.value as RollMode)}><option value="normal">Normal</option><option value="advantage">Advantage</option><option value="disadvantage">Disadvantage</option></select></label></div>
      <label className="toggle-row"><input type="checkbox" checked={advantage} onChange={(event) => setAdvantage(event.target.checked)} />Situational advantage (e.g. unseen by target)</label>
      <label className="toggle-row"><input type="checkbox" checked={disadvantage} onChange={(event) => setDisadvantage(event.target.checked)} />Situational disadvantage (e.g. long range, fear source visible)</label>
      <label className="toggle-row"><input type="checkbox" checked={reactionAttack} onChange={(event) => setReactionAttack(event.target.checked)} />Reaction attack · confirm opportunity attack / feature trigger</label>
      <label className="toggle-row"><input type="checkbox" checked={critical} onChange={(event) => setCritical(event.target.checked)} />Critical damage · double dice, add modifiers once</label>
      {stats.classBreakdown.some((entry) => entry.name === "Rogue") && <label className="toggle-row"><input type="checkbox" checked={sneak} onChange={(event) => setSneak(event.target.checked)} />Apply Sneak Attack · confirm finesse/ranged weapon, qualifying hit, and once per turn</label>}
      {stats.classBreakdown.some((entry) => entry.name === "Barbarian") && <label className="toggle-row"><input type="checkbox" checked={rage} onChange={(event) => setRage(event.target.checked)} />Rage damage applies · active Rage and Strength attack</label>}
      </>}
      {attacks.map((entry) => { const numbers = attackNumbers(character, entry); return <article className="attack-card" key={entry.id}><strong>{entry.name} · {modifier(numbers.toHit)} to hit · {entry.diceCount}d{entry.dieSize}{modifier(numbers.damageBonus)} {entry.damageType}</strong>{dice.classic ? <div className="play-controls"><button type="button" disabled={!canAct} onClick={() => markAttack(entry)}>Mark attack used</button></div> : <div className="play-controls"><button type="button" disabled={!canAct} onClick={() => attack(entry)}>Roll {entry.name} attack</button><button type="button" disabled={!canAct} onClick={() => damage(entry)}>Roll {entry.name} damage</button></div>}
        <details><summary>Edit attack</summary><div className="play-controls"><label>Name<input maxLength={80} value={entry.name} onChange={(event) => update(entry.id, { name: event.target.value })} /></label><label>Ability<select value={entry.ability} onChange={(event) => update(entry.id, { ability: event.target.value as CharacterAttack["ability"] })}>{ABILITIES.map((ability) => <option key={ability}>{ability}</option>)}</select></label></div>
          <label className="toggle-row"><input type="checkbox" checked={entry.offHand ?? false} onChange={(event) => update(entry.id, { offHand: event.target.checked })} />Bonus Action attack · confirm Light / feature eligibility</label><label className="toggle-row"><input type="checkbox" checked={entry.ranged ?? false} onChange={(event) => update(entry.id, { ranged: event.target.checked })} />Ranged weapon (Archery style)</label><label className="toggle-row"><input type="checkbox" checked={entry.twoHanded ?? false} onChange={(event) => update(entry.id, { twoHanded: event.target.checked })} />Two-handed / versatile attack (Great Weapon Fighting)</label><label className="toggle-row"><input type="checkbox" checked={entry.proficient} onChange={(event) => update(entry.id, { proficient: event.target.checked })} />Proficient with this attack</label><label className="toggle-row"><input type="checkbox" checked={entry.addAbilityToDamage} onChange={(event) => update(entry.id, { addAbilityToDamage: event.target.checked })} />Add ability modifier to damage</label>
          <div className="play-controls"><label>Dice count<input type="number" min={0} max={30} value={entry.diceCount} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0 && value <= 30) update(entry.id, { diceCount: value }); }} /></label><label>Die<select value={entry.dieSize} onChange={(event) => update(entry.id, { dieSize: Number(event.target.value) })}>{[4, 6, 8, 10, 12, 20].map((die) => <option key={die} value={die}>d{die}</option>)}</select></label></div>
          <div className="play-controls">{([['attackBonus', 'Other attack bonus'], ['damageBonus', 'Other damage bonus']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min={-100} max={100} value={entry[key]} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && Math.abs(value) <= 100) update(entry.id, { [key]: value }); }} /></label>)}</div>
          <div className="play-controls"><label>Damage type<input maxLength={40} value={entry.damageType} onChange={(event) => update(entry.id, { damageType: event.target.value })} /></label><label>Rules reminders<input maxLength={400} value={entry.notes} onChange={(event) => update(entry.id, { notes: event.target.value })} /></label></div><button type="button" onClick={() => onChange?.(removeCharacterAttack(character, entry.id))}>{entry.inventoryItemId ? "Unequip weapon" : "Remove attack"}</button></details>{entry.notes && <p className="setup-note">{entry.notes}</p>}</article>; })}
    </fieldset><p role="status" aria-live="polite">{message}</p>
  </section>;
}
