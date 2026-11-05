import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { makeCharacterId, type Character, type CharacterSpell } from "../data/characters";
import { lanRequest, LanRequestError, type LanSession, type LanSnapshot } from "../data/lan";
import { TARGETED_SPELLS, type TargetCast, type TargetChoice } from "../data/targetedSpells";
import type { RollMode } from "../data/conditions";

type PendingCast = TargetCast & { requestId: string; baseUpdatedAt: string };
type TargetContext = { targets: { id: string; name: string }[]; connected: boolean; cast: (request: TargetCast) => Promise<string> };
const Context = createContext<TargetContext | null>(null);

export function LanSpellProvider({ session, snapshot, connected, pendingIds, onRefresh, children }: { session: LanSession; snapshot: LanSnapshot | null; connected: boolean; pendingIds: string[]; onRefresh: () => Promise<void>; children: ReactNode }) {
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
    try {
      const result = await lanRequest<{ summary: string }>(`/api/campaigns/${session.code}/cast`, { method: "POST", body: JSON.stringify(request), signal: AbortSignal.timeout(15000) }, session.token);
      remember(null); setMessage(result.summary); await onRefresh(); return result.summary;
    } catch (reason) {
      if (reason instanceof LanRequestError && reason.status >= 400 && reason.status < 500) remember(null);
      const text = reason instanceof Error ? reason.message : "Could not resolve this spell."; setMessage(text); throw reason;
    } finally { sending.current = false; setBusy(false); }
  }
  async function cast(request: TargetCast) {
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
  const context = useContext(Context);
  const [targets, setTargets] = useState<TargetChoice[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!context || !TARGETED_SPELLS.includes(spell.automation ?? "")) return null;
  const options = [{ id: character.id, name: `${character.name} (self)` }, ...context.targets.filter((target) => target.id !== character.id)];
  function update(id: string, patch: Partial<TargetChoice>) { setTargets(targets.map((target) => target.id === id ? { ...target, ...patch } : target)); }
  async function cast() {
    if (!context || busy) return;
    setBusy(true); setMessage("");
    try { setMessage(await context.cast({ casterId: character.id, spellId: spell.id, slotKey, className, mode, targets })); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not cast spell."); }
    finally { setBusy(false); }
  }
  return <details className="lan-target-picker"><summary>Cast on LAN targets · host resolves saves &amp; effects</summary><p>Other targets must be shared sheets in the public initiative roster. Saves roll on the host; choose situational save modes and damage defenses below.</p>
    {options.map((option) => { const selected = targets.find((target) => target.id === option.id); return <div key={option.id} className="lan-target-row"><label className="toggle-row"><input type="checkbox" checked={!!selected} onChange={(event) => { setTargets(event.target.checked ? [...targets, { id: option.id }] : targets.filter((target) => target.id !== option.id)); setConfirmed(false); }} />{option.name}</label>{selected && <div className="play-controls"><label>Save mode<select value={selected.mode ?? "normal"} onChange={(event) => update(option.id, { mode: event.target.value as RollMode })}><option value="normal">Normal</option><option value="advantage">Advantage</option><option value="disadvantage">Disadvantage</option></select></label><label>Damage defense<select value={selected.defense ?? "normal"} onChange={(event) => update(option.id, { defense: event.target.value as TargetChoice["defense"] })}><option value="normal">Normal</option><option value="resistant">Resistance</option><option value="vulnerable">Vulnerability</option><option value="immune">Immunity</option></select></label></div>}</div>; })}
    <label className="toggle-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Range, visibility, components, and target eligibility checked</label><button type="button" className="backup-button" disabled={!confirmed || !targets.length || !context.connected || busy || !spell.prepared} onClick={() => void cast()}>Cast once on selected targets</button>{message && <p role="status">{message}</p>}
  </details>;
}
