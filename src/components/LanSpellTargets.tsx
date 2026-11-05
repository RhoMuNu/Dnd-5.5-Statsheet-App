import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { makeCharacterId, type Character, type CharacterSpell } from "../data/characters";
import { lanRequest, LanRequestError, type LanSession, type LanSnapshot } from "../data/lan";
import { TARGETED_SPELLS, type TargetCast, type TargetChoice } from "../data/targetedSpells";
import type { RollMode } from "../data/conditions";
import { useDiceRoll } from "./DiceProvider";
import { PhysicalDiceRequired, type DiceSource, type DieRequest } from "../data/physicalDice";

type PendingCast = TargetCast & { requestId: string; baseUpdatedAt: string };
type TargetContext = { targets: { id: string; name: string }[]; connected: boolean; cast: (request: TargetCast) => Promise<string> };
const Context = createContext<TargetContext | null>(null);

export function LanSpellProvider({ session, snapshot, connected, pendingIds, onRefresh, children }: { session: LanSession; snapshot: LanSnapshot | null; connected: boolean; pendingIds: string[]; onRefresh: () => Promise<void>; children: ReactNode }) {
  const diceSource = useDiceRoll();
  const key = `taleforge.pending-cast.v1.${session.code}.${session.playerId ?? "dm"}`;
  const pending = useRef<PendingCast | null>(null);
  const initialized = useRef(false);
  if (!initialized.current) { try { pending.current = JSON.parse(localStorage.getItem(key) ?? "null"); } catch { /* No recoverable request. */ } initialized.current = true; }
  const [recoverable, setRecoverable] = useState(!!pending.current);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  function remember(request: PendingCast | null) { pending.current = request; setRecoverable(!!request); if (request) localStorage.setItem(key, JSON.stringify(request)); else localStorage.removeItem(key); }
  async function send(request: PendingCast) {
    if (sending.current) throw new Error("A spell cast is already being resolved.");
    if (!connected) throw new Error("Reconnect to the host before casting.");
    sending.current = true; setBusy(true);
    let definitelyUncommitted = false;
    try {
      const rolled = await diceSource.remote("LAN spell cast · table dice", async (faces) => {
        const submission = { ...request, diceMode: faces === undefined ? "digital" as const : "physical" as const, diceFaces: faces };
        Object.assign(request, submission); remember(submission); definitelyUncommitted = false;
        let reply;
        try { reply = await lanRequest<{ summary?: string; diceRequest?: DieRequest; targetVersions?: Record<string, string> }>(`/api/campaigns/${session.code}/cast`, { method: "POST", body: JSON.stringify(submission), signal: AbortSignal.timeout(15000) }, session.token); }
        catch (reason) { if (reason instanceof LanRequestError && reason.status >= 400 && reason.status < 500) { definitelyUncommitted = true; remember(null); } throw reason; }
        if (reply.diceRequest) {
          definitelyUncommitted = true;
          request.targetVersions = reply.targetVersions; remember(request);
          throw new PhysicalDiceRequired(reply.diceRequest);
        }
        if (!reply.summary) throw new Error("The host did not confirm the spell cast.");
        return reply.summary;
      }, request.diceMode ?? diceSource.mode, request.diceFaces ?? []);
      if (!rolled) {
        if (definitelyUncommitted) { remember(null); setMessage("Physical cast canceled. No slot, action, or target HP was changed."); return "Cast canceled."; }
        setMessage("Cast status is uncertain. Retry the original request before starting another spell."); return "Check the unconfirmed cast above.";
      }
      remember(null); setMessage(rolled.result); await onRefresh(); return rolled.result;
    } catch (reason) {
      if (reason instanceof LanRequestError && reason.status >= 400 && reason.status < 500) remember(null);
      const text = reason instanceof Error ? reason.message : "Could not resolve this spell."; setMessage(text); throw reason;
    } finally { sending.current = false; setBusy(false); }
  }
  async function cast(request: TargetCast) {
    if (diceSource.classic) throw new Error("Switch out of Classic sheet mode to resolve a targeted spell.");
    if (pending.current) throw new Error("Resolve the unconfirmed cast above before starting another spell.");
    if (pendingIds.includes(request.casterId)) throw new Error("Wait for this character’s edits to finish syncing before casting.");
    const caster = snapshot?.characters.find((entry) => entry.character.id === request.casterId);
    if (!caster?.shared) throw new Error("Share your caster with the DM before using LAN targeting.");
    const payload = { ...request, requestId: makeCharacterId(), baseUpdatedAt: caster.character.updatedAt };
    remember(payload); return send(payload);
  }
  return <Context.Provider value={{ targets: snapshot?.targets ?? [], connected: connected && !busy, cast }}>
    {recoverable && <div className="collection-panel"><strong>Unconfirmed spell cast</strong><p>The host may already have resolved this cast. Retry checks its receipt and will not spend another slot.</p><button type="button" className="backup-button" disabled={!connected || busy} onClick={() => { if (pending.current) void send(pending.current).catch(() => {}); }}>Retry the same cast</button> <button type="button" className="text-button" disabled={busy} onClick={() => { remember(null); setMessage("Request discarded. Review the table history before casting again."); }}>Discard request</button></div>}
    {message && <p role="status" className="lan-spell-result">{message}</p>}
    {children}
  </Context.Provider>;
}

export function LanSpellTargets({ character, spell, slotKey, className, mode }: { character: Character; spell: CharacterSpell; slotKey?: string; className: string; mode: RollMode }) {
  const diceSource = useDiceRoll();
  const [diceOverride, setDiceOverride] = useState<DiceSource | "">("");
  const context = useContext(Context);
  const [targets, setTargets] = useState<TargetChoice[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (diceSource.classic) return null;
  if (!context || !TARGETED_SPELLS.includes(spell.automation ?? "")) return null;
  const options = [{ id: character.id, name: `${character.name} (self)` }, ...context.targets.filter((target) => target.id !== character.id)];
  function update(id: string, patch: Partial<TargetChoice>) { setTargets(targets.map((target) => target.id === id ? { ...target, ...patch } : target)); }
  async function cast() {
    if (!context || busy) return;
    setBusy(true); setMessage("");
    try { setMessage(await context.cast({ casterId: character.id, spellId: spell.id, slotKey, className, mode, targets, diceMode: diceOverride || diceSource.mode })); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not cast spell."); }
    finally { setBusy(false); }
  }
  return <details className="lan-target-picker"><summary>Cast on LAN targets · host resolves saves &amp; effects</summary><p>Other targets must be shared sheets in the public initiative roster. Digital mode rolls on the host; physical mode asks for the caster’s dice and each target’s saves, bonus dice, and concentration checks at the table.</p>
    <label>Dice for this cast<select aria-label={`Dice for ${spell.name} LAN cast`} value={diceOverride} onChange={(event) => setDiceOverride(event.target.value as DiceSource | "")}><option value="">Use preference · {diceSource.mode === "physical" ? "Physical" : "Digital"}</option><option value="physical">Physical dice · everyone enters natural faces</option><option value="digital">Digital dice · host rolls</option></select></label>
    {options.map((option) => { const selected = targets.find((target) => target.id === option.id); return <div key={option.id} className="lan-target-row"><label className="toggle-row"><input type="checkbox" checked={!!selected} onChange={(event) => { setTargets(event.target.checked ? [...targets, { id: option.id }] : targets.filter((target) => target.id !== option.id)); setConfirmed(false); }} />{option.name}</label>{selected && <div className="play-controls"><label>Save mode<select value={selected.mode ?? "normal"} onChange={(event) => update(option.id, { mode: event.target.value as RollMode })}><option value="normal">Normal</option><option value="advantage">Advantage</option><option value="disadvantage">Disadvantage</option></select></label><label>Damage defense<select value={selected.defense ?? "normal"} onChange={(event) => update(option.id, { defense: event.target.value as TargetChoice["defense"] })}><option value="normal">Normal</option><option value="resistant">Resistance</option><option value="vulnerable">Vulnerability</option><option value="immune">Immunity</option></select></label></div>}</div>; })}
    <label className="toggle-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Range, visibility, components, and target eligibility checked</label><button type="button" className="backup-button" disabled={!confirmed || !targets.length || !context.connected || busy || !spell.prepared} onClick={() => void cast()}>Cast once on selected targets</button>{message && <p role="status">{message}</p>}
  </details>;
}
