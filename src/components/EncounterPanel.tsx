import { useDiceRoll } from "./DiceProvider";
import { useState, type FormEvent } from "react";
import { lanRequest, type Encounter, type LanSession, type LanSnapshot } from "../data/lan";
import { calculateCharacterStats } from "../data/calculations";
import { rollD20 } from "../data/gameplay";

export function EncounterPanel({ session, snapshot, connected, onRefresh }: { session: LanSession; snapshot: LanSnapshot; connected: boolean; onRefresh: () => Promise<void> }) {
  const encounter = snapshot.encounter ?? { revision: 0, round: 0, activeId: null, entries: [] };
  const dm = session.role === "dm";
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const diceSource = useDiceRoll(`${encounter.revision}:${source}:${snapshot.characters.find((entry) => entry.character.id === source)?.character.updatedAt}`);
  const [initiative, setInitiative] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  async function send(action: Record<string, unknown>) {
    if (busy || !connected) return;
    setBusy(true); setError("");
    try {
      await lanRequest<{ encounter: Encounter }>(`/api/campaigns/${session.code}/encounter`, { method: "POST", body: JSON.stringify({ revision: encounter.revision, action }) }, session.token);
      await onRefresh();
      if (action.type === "add") setName("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update encounter."); await onRefresh(); }
    finally { setBusy(false); }
  }
  function add(event: FormEvent) { event.preventDefault(); void send({ type: "add", name: name.trim(), characterId: source || undefined, initiative: Number(initiative) }); }
  async function rollInitiative() {
    const character = snapshot.characters.find((entry) => entry.character.id === source)?.character;
    if (!character) return;
    try {
      const rolled = await diceSource.run(character.name + " initiative", (die) => rollD20(character, "initiative", "normal", "", false, false, die));
      if (!rolled) return; const roll = rolled.result;
      const value = roll.natural + calculateCharacterStats(character).initiative;
      setInitiative(String(value)); setResult(`${rolled.physical ? "Physical dice · " : ""}${character.name}: [${roll.rolls.join(", ")}] → ${value} initiative`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not resolve initiative."); }
  }
  return <section className="collection-panel encounter-panel" aria-label="Shared initiative tracker"><div className="collection-panel-heading"><div><p className="eyebrow">SHARED ENCOUNTER</p><h3>{encounter.round > 0 ? `Round ${encounter.round}` : "Initiative & turn order"}</h3></div><span>{encounter.activeId ? `${encounter.entries.find((entry) => entry.id === encounter.activeId)?.name}’s turn` : "Combat not started"}</span></div>
    <p className="setup-note">This roster is visible to everyone in the campaign. The DM controls turns. Sheet HP and resources remain player-controlled.</p>
    <ol className="initiative-list">{encounter.entries.map((entry) => <li key={entry.id} aria-current={entry.id === encounter.activeId ? "step" : undefined}><strong>{entry.initiative}</strong><span>{entry.name}{entry.id === encounter.activeId ? " · current turn" : ""}</span>{dm && <div className="initiative-actions"><label>Initiative<input key={`${entry.id}-${entry.initiative}`} type="number" min={-100} max={100} defaultValue={entry.initiative} disabled={busy || !connected} onBlur={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= -100 && value <= 100 && value !== entry.initiative) void send({ type: "update", id: entry.id, initiative: value, tieOrder: entry.tieOrder }); }} /></label><label>Tie priority<input key={`${entry.id}-${entry.tieOrder}`} type="number" min={-100} max={100} defaultValue={entry.tieOrder} disabled={busy || !connected} onBlur={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= -100 && value <= 100 && value !== entry.tieOrder) void send({ type: "update", id: entry.id, initiative: entry.initiative, tieOrder: value }); }} /></label><button type="button" className="text-button" disabled={busy || !connected} onClick={() => void send({ type: "remove", id: entry.id })}>Remove {entry.name}</button></div>}</li>)}</ol>
    {!encounter.entries.length && <p>No combatants yet.</p>}
    {dm && <><form onSubmit={add}><fieldset disabled={busy || !connected}><div className="play-controls"><label>Combatant<select value={source} onChange={(event) => setSource(event.target.value)}><option value="">NPC / manual entry</option>{snapshot.characters.map(({ character }) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>{!source && <label>NPC name<input maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} /></label>}<label>Initiative<input type="number" min={-100} max={100} required value={initiative} onChange={(event) => setInitiative(event.target.value)} /></label>{source && <button type="button" className="backup-button" onClick={rollInitiative}>Roll initiative</button>}<button type="submit" className="backup-button">Add combatant</button></div></fieldset></form>
      <div className="play-controls"><button type="button" className="backup-button" disabled={busy || !connected || !encounter.entries.length || encounter.round > 0} onClick={() => void send({ type: "start" })}>Start combat</button><button type="button" className="backup-button" disabled={busy || !connected || !encounter.activeId} onClick={() => void send({ type: "next" })}>Next turn</button><button type="button" className="backup-button" disabled={busy || !connected || !encounter.activeId} onClick={() => void send({ type: "stop" })}>End combat</button><button type="button" className="text-button" disabled={busy || !connected || !encounter.entries.length} onClick={() => { if (window.confirm("Clear this encounter’s turn order?")) void send({ type: "clear" }); }}>Clear roster</button></div><p className="setup-note">Higher tie priority acts first on tied initiative. Adjust ties before starting combat.</p></>}
    <p role="status">{result}</p>{error && <p role="alert" className="lan-error">{error}</p>}
  </section>;
}
