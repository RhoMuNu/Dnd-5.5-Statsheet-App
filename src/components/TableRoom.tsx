import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { makeCharacterId } from "../data/characters";
import { lanRequest, type LanSession, type LanSnapshot } from "../data/lan";
import { TableActivityContext } from "../data/tableActivity";

type Request = { requestId: string; kind: "dice"; expression: string } | { requestId: string; kind: "sheet"; characterId: string; summary: string };

export function TableRoom({ session, snapshot, connected, children }: { session: LanSession; snapshot: LanSnapshot | null; connected: boolean; children: ReactNode }) {
  const key = `taleforge.table-outbox.v1.${session.code}.${session.playerId ?? "dm"}`;
  const [queue, setQueue] = useState<Request[]>(() => {
    try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(value) ? value.slice(0, 100) : []; } catch { return []; }
  });
  const [sharing, setSharing] = useState(false);
  const [expression, setExpression] = useState("1d20");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(queue)); }
    catch { setError("Browser storage is full. Keep this page open until pending rolls have sent."); }
  }, [key, queue]);

  useEffect(() => {
    if (!connected || !queue.length || sending.current) return;
    sending.current = true;
    setBusy(true);
    let delivered = false;
    const request = queue[0];
    void lanRequest(`/api/campaigns/${session.code}/activity`, { method: "POST", body: JSON.stringify(request) }, session.token)
      .then(() => { setError(""); delivered = true; })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not send table roll."))
      .finally(() => { sending.current = false; setBusy(false); if (delivered) setQueue((entries) => entries.filter((entry) => entry.requestId !== request.requestId)); });
  }, [connected, queue, retry, session.code, session.token]);

  function enqueue(request: Request) {
    if (queue.length >= 100) { setError("There are 100 pending results. Retry sending or discard them before rolling again."); return; }
    setQueue((entries) => [...entries, request]);
  }
  function publish(characterId: string, summary: string) {
    if (!sharing || !snapshot?.characters.some((entry) => entry.character.id === characterId && entry.shared)) return;
    enqueue({ requestId: makeCharacterId(), kind: "sheet", characterId, summary: summary.slice(0, 1500) });
  }
  function roll(event: FormEvent) {
    event.preventDefault();
    const match = expression.replace(/\s/g, "").match(/^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i);
    if (!match || Number(match[1]) < 1 || Number(match[1]) > 50) { setError("Enter dice such as 1d20+5, 2d8+3, or 8d6."); return; }
    enqueue({ requestId: makeCharacterId(), kind: "dice", expression });
  }
  return <TableActivityContext.Provider value={publish}>
    {snapshot && <section className="collection-panel table-room" aria-label="Shared table rolls">
      <div className="collection-panel-heading"><div><p className="eyebrow">THE WHOLE TABLE</p><h3>Shared rolls</h3></div><span>{snapshot.activity?.length ?? 0} / 100 recent results</span></div>
      <form className="play-controls" onSubmit={roll}><label>Dice expression<input aria-label="Dice expression" maxLength={30} value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="1d20+5" /></label><button type="submit" disabled={!connected || queue.length >= 100}>Roll for everyone</button></form>
      {session.role === "player" && <label className="toggle-row"><input type="checkbox" checked={sharing} onChange={(event) => setSharing(event.target.checked)} />Publish my shared character’s rolls and play results to everyone</label>}
      <p className="setup-note">Dice expressions roll on the host. Sheet results use your character’s math and are reported by your browser. Published names and results remain in this room’s history after a sheet is unshared.</p>
      {queue.length > 0 && <p role="status">{queue.length} result{queue.length === 1 ? "" : "s"} waiting to send. <button type="button" onClick={() => setRetry((value) => value + 1)} disabled={!connected || busy}>Retry sending</button> <button type="button" onClick={() => { setQueue([]); setError(""); }}>Discard pending</button></p>}
      {error && <p className="lan-error" role="alert">{error}</p>}
      <ol className="table-history" aria-label="Table roll history">{[...(snapshot.activity ?? [])].reverse().map((entry) => <li key={entry.id}><div><strong>{entry.characterName ?? entry.actor}</strong><small>{entry.kind === "dice" ? "Host dice" : `Sheet result · ${entry.actor}`} · {new Date(entry.createdAt).toLocaleTimeString()}</small></div><p>{entry.summary}</p></li>)}</ol>
      {!snapshot.activity?.length && <p className="lan-empty">Roll some dice to start the table history.</p>}
    </section>}
    {children}
  </TableActivityContext.Provider>;
}
