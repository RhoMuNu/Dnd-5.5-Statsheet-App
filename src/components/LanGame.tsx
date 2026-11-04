import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AbilitiesPage } from "./AbilitiesPage";
import { CharacterBuilder } from "./CharacterBuilder";
import { createLanCharacter, LanRequestError, lanRequest } from "../data/lan";
import type { LanSession, LanSnapshot, PendingLanSave } from "../data/lan";
import { makeCharacterId } from "../data/characters";
import type { Character, CharacterDraft } from "../data/characters";

const SESSION_KEY = "taleforge.lan.session.v1";
const PENDING_PREFIX = "taleforge.lan.pending.v1";

function loadSession(): LanSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    return value && typeof value.code === "string" && typeof value.token === "string" && (value.role === "dm" || value.role === "player") ? value : null;
  } catch { return null; }
}

function loadPending(key: string | null): Record<string, PendingLanSave> {
  if (!key) return {};
  try { return JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { return {}; }
}

export function LanGame({ localCharacters }: { localCharacters: Character[] }) {
  const [session, setSession] = useState<LanSession | null>(loadSession);
  const [snapshot, setSnapshot] = useState<LanSnapshot | null>(null);
  const [connection, setConnection] = useState<"checking" | "connecting" | "connected" | "offline">("checking");
  const [saveStatus, setSaveStatus] = useState("No campaign selected");
  const [hostAvailable, setHostAvailable] = useState(false);
  const [lanAddresses, setLanAddresses] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [pending, setPending] = useState<Record<string, PendingLanSave>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [localSheetId, setLocalSheetId] = useState("");
  const pendingRef = useRef<Record<string, PendingLanSave>>({});
  const flushing = useRef(false);
  const flushTimer = useRef<number | null>(null);
  const sessionStorageKey = session ? `${PENDING_PREFIX}.${session.code}.${session.playerId ?? "dm"}` : null;

  function storePending(next: Record<string, PendingLanSave>) {
    pendingRef.current = next;
    setPending(next);
    if (sessionStorageKey) {
      try { localStorage.setItem(sessionStorageKey, JSON.stringify(next)); } catch { setSaveStatus("Local recovery storage is full"); }
    }
    if (Object.values(next).some((entry) => entry.conflict)) setSaveStatus("Changes need review");
    else if (Object.keys(next).length) setSaveStatus(connection === "connected" ? "Syncing changes to DM host" : "Unsaved changes kept on this device");
    else if (connection === "connected") setSaveStatus("Saved to DM host");
  }

  const flushPending = async () => {
    if (!session || session.role !== "player" || flushing.current || connection !== "connected") return;
    flushing.current = true;
    try {
      for (const [id, queued] of Object.entries(pendingRef.current)) {
        if (queued.conflict) continue;
        try {
          const saved = await lanRequest<{ updatedAt: string }>(`/api/campaigns/${session.code}/characters`, {
            method: "POST",
            body: JSON.stringify({ character: queued.character, shared: queued.shared, baseUpdatedAt: queued.baseUpdatedAt }),
          }, session.token);
          const latest = pendingRef.current[id];
          if (latest?.character.updatedAt === queued.character.updatedAt && latest.shared === queued.shared) {
            const next = { ...pendingRef.current };
            delete next[id];
            storePending(next);
          } else if (latest) {
            storePending({ ...pendingRef.current, [id]: { ...latest, baseUpdatedAt: saved.updatedAt } });
          }
        } catch (requestError) {
          if (requestError instanceof LanRequestError && requestError.status === 409 && requestError.current) {
            storePending({ ...pendingRef.current, [id]: { ...queued, conflict: requestError.current } });
          } else {
            if (requestError instanceof LanRequestError && requestError.status > 0) {
              setSaveStatus(`${requestError.message} · changes remain on this device`);
            } else {
              setConnection("offline");
              setSaveStatus("Host unavailable · changes kept on this device");
            }
          }
          break;
        }
      }
    } finally {
      flushing.current = false;
    }
  };

  const flushRef = useRef(flushPending);
  flushRef.current = flushPending;

  useEffect(() => {
    let active = true;
    void lanRequest<{ ok: boolean; addresses?: string[] }>("/api/health").then((value) => { if (active) { setHostAvailable(true); setLanAddresses(value.addresses ?? []); } }).catch(() => { if (active) setHostAvailable(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const restored = loadPending(sessionStorageKey);
    pendingRef.current = restored;
    setPending(restored);
  }, [sessionStorageKey]);

  useEffect(() => {
    if (!session) {
      setSnapshot(null);
      setConnection(hostAvailable ? "checking" : "offline");
      return;
    }
    let active = true;
    setConnection("connecting");
    setError("");
    void lanRequest<LanSnapshot>(`/api/campaigns/${session.code}`, {}, session.token)
      .then((value) => { if (active) { setSnapshot(value); setConnection("connected"); } })
      .catch((requestError) => { if (active) { setConnection("offline"); setError(requestError.message); } });

    const events = new EventSource(`/api/campaigns/${session.code}/events?token=${encodeURIComponent(session.token)}`);
    events.addEventListener("snapshot", (event) => {
      if (!active) return;
      setSnapshot(JSON.parse((event as MessageEvent<string>).data) as LanSnapshot);
      setConnection("connected");
      setError("");
    });
    events.onopen = () => {
      if (!active) return;
      setConnection("connected");
      window.setTimeout(() => void flushRef.current(), 50);
    };
    events.onerror = () => {
      if (active) {
        setConnection("offline");
        setSaveStatus(pendingRef.current && Object.keys(pendingRef.current).length ? "Unsaved changes kept on this device" : "Reconnecting to DM host");
      }
    };
    return () => { active = false; events.close(); };
  }, [session?.code, session?.token, hostAvailable]);

  useEffect(() => {
    if (connection !== "connected" || session?.role !== "player" || !Object.keys(pending).length) return;
    if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(() => { void flushRef.current(); }, 300);
    return () => { if (flushTimer.current !== null) window.clearTimeout(flushTimer.current); };
  }, [pending, connection, session?.role]);

  const ownCharacters = useMemo(() => {
    if (!snapshot || snapshot.role !== "player") return [];
    const byId = new Map(snapshot.characters.map((entry) => [entry.character.id, entry]));
    for (const [id, queued] of Object.entries(pending)) {
      const remote = byId.get(id);
      byId.set(id, { character: queued.character, shared: queued.shared, ...(remote?.ownerId ? { ownerId: remote.ownerId } : {}) });
    }
    return [...byId.values()];
  }, [snapshot, pending]);
  const selectedCharacter = ownCharacters.find((entry) => entry.character.id === selectedId)?.character ?? ownCharacters[0]?.character ?? null;

  function activateSession(next: LanSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
    setSnapshot(null);
    setSelectedId(null);
    setShowBuilder(false);
    setError("");
  }

  async function hostCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      const result = await lanRequest<{ code: string; token: string }>("/api/campaigns", { method: "POST", body: JSON.stringify({ name: campaignName, dmName: playerName || "Dungeon Master" }) });
      activateSession({ ...result, role: "dm", playerId: null, name: playerName || "Dungeon Master" });
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not start the campaign host."); }
  }

  async function joinCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      const code = roomCode.trim().toUpperCase();
      const result = await lanRequest<{ code: string; token: string; playerId: string }>(`/api/campaigns/${code}/join`, { method: "POST", body: JSON.stringify({ name: playerName }) });
      activateSession({ ...result, role: "player", name: playerName.trim() });
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not join that campaign."); }
  }

  function queueSave(character: Character, shared: boolean, baseUpdatedAt: string | null) {
    const existing = pendingRef.current[character.id];
    const queued: PendingLanSave = { character, shared, baseUpdatedAt: existing?.baseUpdatedAt ?? baseUpdatedAt };
    const next = { ...pendingRef.current, [character.id]: queued };
    storePending(next);
    setSelectedId(character.id);
  }

  function savePlayerCharacter(draft: CharacterDraft) {
    if (!session || session.role !== "player") return;
    const existingEntry = editingId ? ownCharacters.find((entry) => entry.character.id === editingId) : null;
    const oldQueue = existingEntry ? pendingRef.current[existingEntry.character.id] : null;
    const now = new Date().toISOString();
    const character = createLanCharacter(draft, existingEntry?.character.id ?? makeCharacterId(), now);
    if (existingEntry) {
      character.createdAt = existingEntry.character.createdAt;
      queueSave(character, oldQueue?.shared ?? Boolean(existingEntry.shared), oldQueue?.baseUpdatedAt ?? existingEntry.character.updatedAt);
    } else {
      queueSave(character, false, null);
    }
    setShowBuilder(false); setEditingId(null);
  }

  function updatePlayerCharacter(id: string, updates: Partial<Character>) {
    const entry = ownCharacters.find((item) => item.character.id === id);
    if (!entry) return;
    const previous = pendingRef.current[id];
    const next = { ...entry.character, ...updates, updatedAt: new Date().toISOString() };
    queueSave(next, previous?.shared ?? Boolean(entry.shared), previous?.baseUpdatedAt ?? entry.character.updatedAt);
  }

  function toggleShare(id: string, shared: boolean) {
    const entry = ownCharacters.find((item) => item.character.id === id);
    if (entry) queueSave(entry.character, shared, pendingRef.current[id]?.baseUpdatedAt ?? entry.character.updatedAt);
  }

  function addLocalSheet() {
    const local = localCharacters.find((character) => character.id === localSheetId);
    if (!local || ownCharacters.some((entry) => entry.character.id === local.id)) return;
    queueSave(local, false, null);
    setShowBuilder(false);
    setLocalSheetId("");
  }

  function resolveConflict(id: string, keepLocal: boolean) {
    const queued = pendingRef.current[id];
    if (!queued) return;
    const next = { ...pendingRef.current };
    if (!keepLocal) delete next[id];
    else if (queued.conflict) next[id] = { character: queued.character, shared: queued.shared, baseUpdatedAt: queued.conflict.updatedAt };
    storePending(next);
    if (!keepLocal) void refreshSnapshot();
    else window.setTimeout(() => void flushRef.current(), 0);
  }

  async function refreshSnapshot() {
    if (!session) return;
    try { setSnapshot(await lanRequest<LanSnapshot>(`/api/campaigns/${session.code}`, {}, session.token)); }
    catch { setConnection("offline"); }
  }

  async function retrySync() {
    if (!session) return;
    setConnection("connecting");
    try {
      setSnapshot(await lanRequest<LanSnapshot>(`/api/campaigns/${session.code}`, {}, session.token));
      setConnection("connected");
      window.setTimeout(() => void flushRef.current(), 0);
    } catch (requestError) {
      setConnection("offline");
      setSaveStatus(requestError instanceof Error ? requestError.message : "Host is still unavailable.");
    }
  }

  function forgetSession() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null); setSnapshot(null); setPending({}); pendingRef.current = {};
    setConnection(hostAvailable ? "checking" : "offline"); setSaveStatus("No campaign selected");
  }

  if (!session) return <section className="lan-screen">
    <div className="lan-intro-card"><div className="section-symbol" aria-hidden="true">⌁</div><div><p className="eyebrow">PLAY TOGETHER · LOCAL NETWORK</p><h2>Bring the party to one table.</h2><p>One player starts the host on their PC. Everyone else joins with the room code while connected to the same Wi-Fi.</p></div><span className={`lan-connection ${hostAvailable ? "online" : "offline"}`}>{hostAvailable ? "HOST SERVICE READY" : "HOST SERVICE OFFLINE"}</span></div>
    {!hostAvailable && <div className="lan-help-note"><strong>Start the LAN host first</strong><span>On Windows, double-click <code>Start TaleForge Host.bat</code> in the project folder. Keep its window open, then refresh this page.</span></div>}
    {loadSession() && <button className="lan-resume-button" onClick={() => { const saved = loadSession(); if (saved) activateSession(saved); }}>Resume last room · {loadSession()?.code}</button>}
    <div className="lan-setup-grid">
      <form className="lan-form-card" onSubmit={hostCampaign}><p className="eyebrow">DUNGEON MASTER</p><h3>Host a campaign</h3><label><span>Campaign name</span><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="The Sunken Crown" maxLength={80} required /></label><label><span>Your display name</span><input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Dungeon Master" maxLength={40} /></label><button className="primary-button" disabled={!hostAvailable}>Create room <span>→</span></button></form>
      <form className="lan-form-card" onSubmit={joinCampaign}><p className="eyebrow">PLAYER</p><h3>Join a campaign</h3><label><span>Room code</span><input className="room-code-input" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="6 LETTERS / NUMBERS" maxLength={6} required /></label><label><span>Your display name</span><input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Your name" maxLength={40} required /></label><button className="primary-button" disabled={!hostAvailable}>Join room <span>→</span></button></form>
    </div>
    {error && <p className="lan-error" role="alert">{error}</p>}
    <p className="lan-footnote">For this first LAN version, use a trusted private network. Character changes are stored on the DM host; player edits are kept locally and retried if the host connection drops.</p>
  </section>;

  const connectedCount = snapshot?.players.filter((player) => player.connected).length ?? 0;
  const dmCharacters = snapshot?.role === "dm" ? snapshot.characters : [];
  const selectedShared = dmCharacters.find((entry) => entry.character.id === selectedId) ?? dmCharacters[0] ?? null;

  return <section className="lan-screen">
    <div className="lan-room-bar"><div><p className="eyebrow">{session.role === "dm" ? "DUNGEON MASTER HOST" : "PLAYER CONNECTION"}</p><h2>{snapshot?.campaign.name ?? "Connecting to campaign…"}</h2><span>ROOM CODE <strong>{session.code}</strong> · {connectedCount} player{connectedCount === 1 ? "" : "s"} online</span></div><div className="lan-status-stack"><span className={`lan-connection ${connection === "connected" ? "online" : "offline"}`}>{connection === "connected" ? "CONNECTED" : connection === "connecting" ? "CONNECTING" : "RECONNECTING"}</span><span className="lan-save-status">{session.role === "player" ? saveStatus : connection === "connected" ? "Live party view" : "Waiting for host connection"}</span></div></div>
    {error && <p className="lan-error" role="status">{error}</p>}

    {session.role === "dm" ? <div className="lan-dashboard-grid">
      <aside className="lan-party-panel"><div className="lan-panel-heading"><div><p className="eyebrow">THE PARTY</p><h3>Players</h3></div><span>{snapshot?.players.length ?? 0}</span></div>
        {snapshot?.players.length ? snapshot.players.map((player) => <div className="lan-player-row" key={player.id}><i className={player.connected ? "connected" : ""} /><span>{player.name}</span><small>{player.connected ? "ONLINE" : "OFFLINE"}</small></div>) : <p className="lan-empty">Share the room code to invite players.</p>}
        <div className="lan-shared-list"><p className="eyebrow">SHARED SHEETS</p>{dmCharacters.length ? dmCharacters.map((entry) => <button className={`lan-character-pick ${selectedShared?.character.id === entry.character.id ? "active" : ""}`} key={entry.character.id} onClick={() => setSelectedId(entry.character.id)}><span className="roster-avatar">{entry.character.name.slice(0, 1).toUpperCase()}</span><span><strong>{entry.character.name}</strong><small>{entry.ownerName} · {entry.character.characterClass || "Class TBD"} · Lv {entry.character.level}</small></span></button>) : <p className="lan-empty">Players choose which characters to share. Their private sheets stay hidden.</p>}</div>
      </aside>
      <div className="lan-sheet-view">{selectedShared ? <><div className="lan-view-only"><span>✦ Shared by {selectedShared.ownerName}</span><strong>VIEW ONLY</strong></div><AbilitiesPage character={selectedShared.character} readOnly /></> : <div className="lan-empty-sheet"><span>✧</span><h3>Party sheets appear here</h3><p>When players share a character, its live sheet will be available in this dashboard.</p></div>}</div>
    </div> : <div className="lan-dashboard-grid">
      <aside className="lan-party-panel"><div className="lan-panel-heading"><div><p className="eyebrow">YOUR HEROES</p><h3>My characters</h3></div><button className="backup-button" onClick={() => { setEditingId(null); setShowBuilder(true); }}>＋ New</button></div>
        {snapshot?.players.map((player) => <div className="lan-player-row" key={player.id}><i className={player.connected ? "connected" : ""} /><span>{player.id === session.playerId ? `${player.name} (you)` : player.name}</span><small>{player.connected ? "ONLINE" : "OFFLINE"}</small></div>)}
        {localCharacters.some((local) => !ownCharacters.some((entry) => entry.character.id === local.id)) && <div className="lan-local-import"><label><span>Copy a saved sheet into this room</span><select value={localSheetId} onChange={(event) => setLocalSheetId(event.target.value)}><option value="">Choose a local character…</option>{localCharacters.filter((local) => !ownCharacters.some((entry) => entry.character.id === local.id)).map((local) => <option key={local.id} value={local.id}>{local.name}</option>)}</select></label><button className="backup-button" disabled={!localSheetId} onClick={addLocalSheet}>Copy privately to room</button></div>}
        <div className="lan-shared-list">{ownCharacters.length ? ownCharacters.map((entry) => <div className="lan-owned-card" key={entry.character.id}><button className={`lan-character-pick ${selectedCharacter?.id === entry.character.id && !showBuilder ? "active" : ""}`} onClick={() => { setSelectedId(entry.character.id); setShowBuilder(false); }}><span className="roster-avatar">{entry.character.name.slice(0, 1).toUpperCase()}</span><span><strong>{entry.character.name}</strong><small>{entry.character.characterClass || "Class TBD"} · Lv {entry.character.level}</small></span></button><label className="lan-share-toggle"><input type="checkbox" checked={Boolean(entry.shared)} onChange={(event) => toggleShare(entry.character.id, event.target.checked)} /><span>Share with DM</span></label><button className="text-button" onClick={() => { setEditingId(entry.character.id); setShowBuilder(true); }}>Edit basics ↗</button>{pending[entry.character.id]?.conflict && <div className="lan-conflict"><strong>The host has a newer version.</strong><span>Your offline copy is still saved here. Choose which version to keep.</span><div><button onClick={() => resolveConflict(entry.character.id, false)}>Use host version</button><button onClick={() => resolveConflict(entry.character.id, true)}>Keep my version</button></div></div>}</div>) : !showBuilder && <p className="lan-empty">Create your character here. Only you can edit it.</p>}</div>
        <button className="lan-leave-button" onClick={forgetSession}>Leave this room</button>
      </aside>
      <div className="lan-sheet-view">{showBuilder ? <CharacterBuilder key={editingId ?? "lan-new"} character={ownCharacters.find((entry) => entry.character.id === editingId)?.character} onSave={savePlayerCharacter} onCancel={() => { setShowBuilder(false); setEditingId(null); }} /> : selectedCharacter ? <><div className="lan-view-only player-sheet-heading"><span>{selectedCharacter.name} · Your sheet</span>{pending[selectedCharacter.id] && <button className="lan-retry-button" onClick={() => void retrySync()}>Retry sync</button>}<strong>{saveStatus}</strong></div><AbilitiesPage character={selectedCharacter} onChange={(updates) => updatePlayerCharacter(selectedCharacter.id, updates)} /></> : <div className="lan-empty-sheet"><span>✧</span><h3>Your character sheet</h3><p>Create a hero to start. You control your sheet; sharing it with the DM is always your choice.</p><button className="primary-button" onClick={() => { setEditingId(null); setShowBuilder(true); }}>Create your character <span>→</span></button></div>}</div>
    </div>}
    {session.role === "dm" && <div className="lan-host-address"><strong>Invite your players</strong><span>Open this address on devices using the same Wi-Fi, then enter room code <b>{session.code}</b>.</span>{lanAddresses.length ? lanAddresses.map((address) => <code key={address}>http://{address}:{window.location.port || "80"}</code>) : <code>http://{window.location.hostname}:{window.location.port || "80"}</code>}</div>}
    {session.role === "dm" && <button className="lan-leave-button dm-end-note" onClick={forgetSession}>Return to campaign menu on this device</button>}
  </section>;
}
