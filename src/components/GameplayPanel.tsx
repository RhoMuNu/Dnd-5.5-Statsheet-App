import { useTableActivity } from "../data/tableActivity";
import { useDiceRoll } from "./DiceProvider";
import { useState } from "react";
import { ABILITIES, SKILLS, type Character } from "../data/characters";
import { calculateCharacterStats } from "../data/calculations";
import { activeEffects, effectDice, effectTotal } from "../data/effects";
import { useHealingFeature } from "../data/featureActions";
import { CONDITIONS, CONDITION_NOTES, activeConditions, automaticSaveFailure, isIncapacitated, type RollMode } from "../data/conditions";
import { adjustedDamage, rollD20, setCondition, setExhaustion, applyDamage, combatState, deathSave, healCharacter, spendHitDie } from "../data/gameplay";

export function GameplayPanel({ character, onChange, readOnly = false }: { character: Character; onChange?: (updates: Partial<Character>) => void; readOnly?: boolean }) {
  const diceSource = useDiceRoll(character.updatedAt);
  const publish = useTableActivity(character.id);
  function report(summary: string) { setMessage(summary); publish(summary); }
  const stats = calculateCharacterStats(character);
  const combat = combatState(character);
  const [amount, setAmount] = useState("1");
  const [layAmount, setLayAmount] = useState("1");
  const [critical, setCritical] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<RollMode>("normal");
  const [defense, setDefense] = useState<"normal" | "resistant" | "vulnerable" | "immune">("normal");
  const [check, setCheck] = useState("Initiative");
  const validAmount = Number.isInteger(Number(amount)) && Number(amount) > 0 && Number(amount) <= 9999;
  const down = character.currentHitPoints === 0;

  async function healWithFeature(feature: "second-wind" | "lay-on-hands", amount = 1) {
    try { const rolled = await diceSource.run(feature, (die) => useHealingFeature(character, feature, amount, die)); if (!rolled) return; const result = rolled.result; onChange?.(result.updates); report(`${rolled.physical ? "Physical dice · " : ""}${feature === "second-wind" ? "Second Wind" : "Lay on Hands"}: ${result.healing} HP before maximum; use and Bonus Action spent.`); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Feature unavailable."); }
  }
  async function rollCheck() {
    const ability = check.startsWith("Save: ") ? check.slice(6) : "";
    if (automaticSaveFailure(character, ability)) { report(check + ": automatic failure due to condition"); return; }
    try {
    const rolled = await diceSource.run(check, (die) => {
    const result = rollD20(character, check === "Initiative" ? "initiative" : ability ? "save" : "check", mode, ability || check, false, false, die);
    const dice = result.rolls;
    const chosen = result.natural;
    const bonus = check === "Initiative" ? stats.initiative : check.startsWith("Save: ")
      ? stats.savingThrows[check.slice(6) as keyof typeof stats.savingThrows]
      : stats.skillBonuses[check as keyof typeof stats.skillBonuses];
    const extra = ability ? effectDice(character, "save", die) : { total: 0, rolls: [] };
    return `${check}: ${dice.join(", ")}${dice.length > 1 ? ` → ${chosen}` : ""} ${bonus >= 0 ? "+" : "−"} ${Math.abs(bonus)}${extra.rolls.length ? ` + effects [${extra.rolls.join(", ")}]` : ""} = ${chosen + bonus + extra.total}`;
    });
    if (rolled) report((rolled.physical ? "Physical dice · " : "") + rolled.result);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not resolve roll."); }
  }

  async function rollDeath() {
    try {
      const rolled = await diceSource.run("Death saving throw", (die) => {
        const roll = die(20, `${character.name}: death saving throw`); const extra = effectDice(character, "save", die);
        const total = roll - 2 * combat.exhaustion + effectTotal(character, "save") + extra.total;
        return { updates: deathSave(character, roll, extra.total), summary: `Death save: natural ${roll}, total ${total}${roll === 20 ? " · regain 1 HP" : roll === 1 ? " · two failures" : total >= 10 ? " · success" : " · failure"}` };
      });
      if (rolled) { onChange?.(rolled.result.updates); report((rolled.physical ? "Physical dice · " : "") + rolled.result.summary); }
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not resolve death save."); }
  }
  async function rollConcentration() {
    try {
      const rolled = await diceSource.run("Concentration save", (die) => {
        const roll = rollD20(character, "save", mode, "Constitution", activeEffects(character).some((effect) => effect.concentrationAdvantage), false, die).natural;
        const extra = effectDice(character, "save", die), total = roll + stats.savingThrows.Constitution + extra.total, success = total >= combat.concentrationDC!;
        return { updates: { combat: { ...combat, concentration: success ? combat.concentration : "", concentrationDC: null } }, summary: `Concentration: ${roll} + ${stats.savingThrows.Constitution}${extra.rolls.length ? ` + effects [${extra.rolls.join(", ")}]` : ""} = ${total} · ${success ? "maintained" : "lost"}` };
      });
      if (rolled) { onChange?.(rolled.result.updates); report((rolled.physical ? "Physical dice · " : "") + rolled.result.summary); }
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not resolve concentration."); }
  }
  async function rollHitDie(className: string, sides: number) {
    try {
      const rolled = await diceSource.run(`${className} Hit Die`, (die) => {
        const roll = die(sides, `${character.name}: ${className} Hit Die healing`);
        return { updates: spendHitDie(character, className, roll), summary: `${className} Hit Die: ${roll} + ${stats.abilityModifiers.Constitution} · ${Math.max(1, roll + stats.abilityModifiers.Constitution)} HP before maximum` };
      });
      if (rolled) { onChange?.(rolled.result.updates); report((rolled.physical ? "Physical dice · " : "") + rolled.result.summary); }
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not spend Hit Die."); }
  }

  return <section className="derived-panel gameplay-panel" aria-label="Play controls">
    <p className="eyebrow">PLAY AT THE TABLE</p>
    <fieldset disabled={readOnly}>
      <div className="play-controls"><label>Damage / healing<input type="number" min={1} max={9999} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <button type="button" disabled={!validAmount || combat.dead || stats.maxHitPoints === null} onClick={() => { onChange?.(applyDamage(character, adjustedDamage(character, Number(amount), defense), critical)); report(`Applied ${adjustedDamage(character, Number(amount), defense)} damage after defenses; temporary HP absorbs damage first.`); }}>Take damage</button>
        <button type="button" disabled={!validAmount || combat.dead || stats.maxHitPoints === null} onClick={() => onChange?.(healCharacter(character, Number(amount)))}>Heal</button></div>
      <div className="play-controls"><label>Damage defense<select value={defense} onChange={(event) => setDefense(event.target.value as typeof defense)}><option value="normal">Normal</option><option value="resistant">Resistant · half</option><option value="vulnerable">Vulnerable · double</option><option value="immune">Immune · zero</option></select></label></div>
      <label className="toggle-row"><input type="checkbox" checked={critical} onChange={(event) => setCritical(event.target.checked)} />Damage is a critical hit (death save failures)</label>
      {down && <div className="death-tracker"><strong>{combat.dead ? "Dead · DM intervention required" : combat.stable ? "Stable · unconscious at 0 HP" : `Death saves · ${combat.deathSuccesses} successes / ${combat.deathFailures} failures`}</strong>
        <div className="play-controls"><button type="button" disabled={combat.dead || combat.stable} onClick={() => void rollDeath()}>Roll death save</button>
          <button type="button" disabled={combat.dead || combat.stable} onClick={() => onChange?.({ combat: { ...combat, stable: true, deathSuccesses: 0, deathFailures: 0 } })}>Stabilize (after first aid)</button></div></div>}
      {combat.dead && <button type="button" className="text-button" onClick={() => { if (window.confirm("Has the DM approved reviving this character at 1 HP?")) onChange?.({ currentHitPoints: 1, combat: { ...combat, dead: false, stable: false, deathSuccesses: 0, deathFailures: 0 } }); }}>DM override · revive at 1 HP</button>}
      {!isIncapacitated(character) && combat.concentration && <div className="death-tracker"><strong>Concentrating: {combat.concentration}</strong>
        {combat.concentrationDC !== null && <><p>Constitution save DC {combat.concentrationDC}. Resolve each damage event before taking more damage.</p><button type="button" onClick={() => void rollConcentration()}>Roll concentration save</button><button type="button" onClick={() => onChange?.({ combat: { ...combat, concentrationDC: null } })}>Mark save passed</button></>}
        <button type="button" className="text-button" onClick={() => onChange?.({ combat: { ...combat, concentration: "", concentrationDC: null } })}>End concentration</button></div>}
      {stats.classResources.some((entry) => entry.key === "fighter.second-wind") && <button type="button" disabled={isIncapacitated(character) || (stats.classResources.find((entry) => entry.key === "fighter.second-wind")?.used ?? 0) >= (stats.classResources.find((entry) => entry.key === "fighter.second-wind")?.maxUses ?? 0)} onClick={() => { healWithFeature("second-wind"); }}>Second Wind · roll &amp; heal self</button>}
      {stats.classResources.some((entry) => entry.key === "paladin.lay-on-hands") && <div className="play-controls"><label>Lay on Hands · HP to spend<input type="number" min={1} max={100} value={layAmount} onChange={(event) => setLayAmount(event.target.value)} /></label><button type="button" disabled={isIncapacitated(character) || !Number.isInteger(Number(layAmount)) || Number(layAmount) <= 0 || Number(layAmount) > (stats.classResources.find((entry) => entry.key === "paladin.lay-on-hands")?.maxUses ?? 0) - (stats.classResources.find((entry) => entry.key === "paladin.lay-on-hands")?.used ?? 0)} onClick={() => { healWithFeature("lay-on-hands", Number(layAmount)); }}>Heal self &amp; spend pool</button></div>}
      <details><summary>Short Rest · spend Hit Dice</summary><p className="setup-note">After a completed 1-hour Short Rest, spend dice one at a time. Each restores the roll + Constitution (minimum 1 HP). Long Rest restores all spent dice.</p>
        {stats.classBreakdown.map((entry) => { const used = combat.hitDiceUsed[entry.name] ?? 0; return <div className="derived-line" key={entry.name}><span>{entry.name} d{entry.hitDie} · {Math.max(0, entry.level - used)} / {entry.level} left</span><button type="button" disabled={used >= entry.level || down || combat.dead || (character.currentHitPoints ?? stats.maxHitPoints) === stats.maxHitPoints} onClick={() => void rollHitDie(entry.name, entry.hitDie)}>Spend d{entry.hitDie}</button></div>; })}</details>
      <details><summary>Conditions &amp; exhaustion {activeConditions(character).length > 0 ? `(${activeConditions(character).join(", ")})` : ""}</summary>
        <div className="play-controls"><label>Exhaustion level<input type="number" min={0} max={6} value={combat.exhaustion} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0 && value <= 6) onChange?.(setExhaustion(character, value)); }} /></label></div>
        <p className="setup-note">Each level: −2 to d20 tests and −5 ft speed; level 6 is death. Long Rest removes one level when recovery is allowed.</p>
        {CONDITIONS.map((condition) => <label className="condition-toggle" key={condition}><input type="checkbox" checked={activeConditions(character).includes(condition)} disabled={!(combat.conditions ?? []).includes(condition) && activeConditions(character).includes(condition)} onChange={(event) => onChange?.(setCondition(character, condition, event.target.checked))} /><span><strong>{condition}</strong><small>{CONDITION_NOTES[condition]}</small></span></label>)}
        <p className="setup-note">Inherited conditions clear with their source. Context-dependent effects such as fear, sight, and grapple targets need the situational roll controls.</p>
      </details>
      <div className="play-controls"><label>Roll a check<select value={check} onChange={(event) => setCheck(event.target.value)}><option>Initiative</option>{ABILITIES.map((ability) => <option key={ability}>Save: {ability}</option>)}{SKILLS.map(({ name }) => <option key={name}>{name}</option>)}</select></label><label>Roll mode<select value={mode} onChange={(event) => setMode(event.target.value as RollMode)}><option value="normal">Normal</option><option value="advantage">Advantage</option><option value="disadvantage">Disadvantage</option></select></label><button type="button" onClick={rollCheck}>Roll d20</button></div>
      <p className="setup-note">Sheet bonuses, exhaustion, and unconditional condition effects apply automatically. Advantage and disadvantage cancel. Use roll mode for situational effects.</p>
    </fieldset>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
