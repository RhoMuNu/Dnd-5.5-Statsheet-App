import { useState } from "react";
import { ABILITIES, SKILLS, type Character } from "../data/characters";
import { calculateCharacterStats } from "../data/calculations";
import { applyDamage, combatState, deathSave, healCharacter, rollDie, spendHitDie } from "../data/gameplay";

export function GameplayPanel({ character, onChange, readOnly = false }: { character: Character; onChange?: (updates: Partial<Character>) => void; readOnly?: boolean }) {
  const stats = calculateCharacterStats(character);
  const combat = combatState(character);
  const [amount, setAmount] = useState("1");
  const [critical, setCritical] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("normal");
  const [check, setCheck] = useState("Initiative");
  const validAmount = Number.isInteger(Number(amount)) && Number(amount) > 0 && Number(amount) <= 9999;
  const down = character.currentHitPoints === 0;

  function rollCheck() {
    const dice = [rollDie(20)];
    if (mode !== "normal") dice.push(rollDie(20));
    const chosen = mode === "advantage" ? Math.max(...dice) : mode === "disadvantage" ? Math.min(...dice) : dice[0];
    const bonus = check === "Initiative" ? stats.initiative : check.startsWith("Save: ")
      ? stats.savingThrows[check.slice(6) as keyof typeof stats.savingThrows]
      : stats.skillBonuses[check as keyof typeof stats.skillBonuses];
    setMessage(`${check}: ${dice.join(", ")}${dice.length > 1 ? ` → ${chosen}` : ""} ${bonus >= 0 ? "+" : "−"} ${Math.abs(bonus)} = ${chosen + bonus}`);
  }

  return <section className="derived-panel gameplay-panel" aria-label="Play controls">
    <p className="eyebrow">PLAY AT THE TABLE</p>
    <fieldset disabled={readOnly}>
      <div className="play-controls"><label>Damage / healing<input type="number" min={1} max={9999} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <button type="button" disabled={!validAmount || combat.dead || stats.maxHitPoints === null} onClick={() => { onChange?.(applyDamage(character, Number(amount), critical)); setMessage(`Applied ${amount} damage; temporary HP absorbs damage first.`); }}>Take damage</button>
        <button type="button" disabled={!validAmount || combat.dead || stats.maxHitPoints === null} onClick={() => onChange?.(healCharacter(character, Number(amount)))}>Heal</button></div>
      <label className="toggle-row"><input type="checkbox" checked={critical} onChange={(event) => setCritical(event.target.checked)} />Damage is a critical hit (death save failures)</label>
      {down && <div className="death-tracker"><strong>{combat.dead ? "Dead · DM intervention required" : combat.stable ? "Stable · unconscious at 0 HP" : `Death saves · ${combat.deathSuccesses} successes / ${combat.deathFailures} failures`}</strong>
        <div className="play-controls"><button type="button" disabled={combat.dead || combat.stable} onClick={() => { const roll = rollDie(20); onChange?.(deathSave(character, roll)); setMessage(`Death save: ${roll}${roll === 20 ? " · regain 1 HP" : roll === 1 ? " · two failures" : roll >= 10 ? " · success" : " · failure"}`); }}>Roll death save</button>
          <button type="button" disabled={combat.dead || combat.stable} onClick={() => onChange?.({ combat: { ...combat, stable: true, deathSuccesses: 0, deathFailures: 0 } })}>Stabilize (after first aid)</button></div></div>}
      {combat.dead && <button type="button" className="text-button" onClick={() => { if (window.confirm("Has the DM approved reviving this character at 1 HP?")) onChange?.({ currentHitPoints: 1, combat: { ...combat, dead: false, stable: false, deathSuccesses: 0, deathFailures: 0 } }); }}>DM override · revive at 1 HP</button>}
      {combat.concentration && <div className="death-tracker"><strong>Concentrating: {combat.concentration}</strong>
        {combat.concentrationDC !== null && <><p>Constitution save DC {combat.concentrationDC}. Resolve each damage event before taking more damage.</p><button type="button" onClick={() => { const roll = rollDie(20); const total = roll + stats.savingThrows.Constitution; const success = total >= combat.concentrationDC!; onChange?.({ combat: { ...combat, concentration: success ? combat.concentration : "", concentrationDC: null } }); setMessage(`Concentration: ${roll} + ${stats.savingThrows.Constitution} = ${total} · ${success ? "maintained" : "lost"}`); }}>Roll concentration save</button><button type="button" onClick={() => onChange?.({ combat: { ...combat, concentrationDC: null } })}>Mark save passed</button></>}
        <button type="button" className="text-button" onClick={() => onChange?.({ combat: { ...combat, concentration: "", concentrationDC: null } })}>End concentration</button></div>}
      <details><summary>Short Rest · spend Hit Dice</summary><p className="setup-note">After a completed 1-hour Short Rest, spend dice one at a time. Each restores the roll + Constitution (minimum 1 HP). Long Rest restores all spent dice.</p>
        {stats.classBreakdown.map((entry) => { const used = combat.hitDiceUsed[entry.name] ?? 0; return <div className="derived-line" key={entry.name}><span>{entry.name} d{entry.hitDie} · {Math.max(0, entry.level - used)} / {entry.level} left</span><button type="button" disabled={used >= entry.level || down || combat.dead || (character.currentHitPoints ?? stats.maxHitPoints) === stats.maxHitPoints} onClick={() => { const roll = rollDie(entry.hitDie); onChange?.(spendHitDie(character, entry.name, roll)); setMessage(`${entry.name} Hit Die: ${roll} + ${stats.abilityModifiers.Constitution} · ${Math.max(1, roll + stats.abilityModifiers.Constitution)} HP before maximum`); }}>Spend d{entry.hitDie}</button></div>; })}</details>
      <div className="play-controls"><label>Roll a check<select value={check} onChange={(event) => setCheck(event.target.value)}><option>Initiative</option>{ABILITIES.map((ability) => <option key={ability}>Save: {ability}</option>)}{SKILLS.map(({ name }) => <option key={name}>{name}</option>)}</select></label><label>Roll mode<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="normal">Normal</option><option value="advantage">Advantage</option><option value="disadvantage">Disadvantage</option></select></label><button type="button" onClick={rollCheck}>Roll d20</button></div>
      <p className="setup-note">Check totals include your sheet bonuses. Apply situational effects and feature exceptions with your DM.</p>
    </fieldset>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
