import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { rollDie } from "../data/gameplay";
import { physicalDice, PhysicalDiceRequired, type DiceSource, type DieFace, type DieRequest, type DieRoller } from "../data/physicalDice";

type Outcome<T> = { result: T; physical: boolean };
type DiceContextValue = {
  mode: DiceSource;
  classic: boolean;
  setMode: (mode: DiceSource) => void;
  setClassic: (classic: boolean) => void;
  run: <T>(title: string, operation: (die: DieRoller) => T, source?: DiceSource) => Promise<Outcome<T> | null>;
  remote: <T>(title: string, operation: (faces: DieFace[] | undefined) => Promise<T>, source?: DiceSource, initialFaces?: DieFace[]) => Promise<Outcome<T> | null>;
};
type Pending = { title: string; operation: (faces: DieFace[] | undefined) => Promise<unknown>; faces: DieFace[]; resolve: (result: Outcome<unknown> | null) => void };
const Context = createContext<DiceContextValue | null>(null);
const KEY = "taleforge.dice.source.v1";

export function DiceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DiceSource>(() => { try { return localStorage.getItem(KEY) === "physical" ? "physical" : "digital"; } catch { return "digital"; } });
  const [classic, setClassic] = useState(() => { try { return localStorage.getItem("taleforge.sheet.classic.v1") === "true"; } catch { return false; } });
  const pending = useRef<Pending | null>(null);
  const [request, setRequest] = useState<DieRequest | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<DieFace[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const modal = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  useEffect(() => { try { localStorage.setItem(KEY, mode); } catch { /* The preference works until closing this page. */ } }, [mode]);
  useEffect(() => { try { localStorage.setItem("taleforge.sheet.classic.v1", String(classic)); } catch { /* Keep the preference for this session. */ } }, [classic]);
  useEffect(() => { if (request) input.current?.focus(); }, [request, busy]);
  function close(result: Outcome<unknown> | null) {
    const current = pending.current; pending.current = null; setRequest(null); setError(""); setText(""); setHistory([]); current?.resolve(result);
  }
  async function attempt(faces: DieFace[] | undefined) {
    const current = pending.current;
    if (!current || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { const result = await current.operation(faces); close({ result, physical: faces !== undefined }); }
    catch (reason) {
      if (reason instanceof PhysicalDiceRequired) { setRequest(reason.request); setTitle(current.title); setHistory(current.faces); setText(""); }
      else { setError(reason instanceof Error ? reason.message : "Could not resolve these dice."); setTitle(current.title); setRequest((previous) => previous ?? { index: 0, sides: 0, label: "Roll could not complete" }); }
    } finally { inFlight.current = false; setBusy(false); }
  }
  async function remote<T>(name: string, operation: (faces: DieFace[] | undefined) => Promise<T>, source = mode, initialFaces: DieFace[] = []): Promise<Outcome<T> | null> {
    if (classic) return null;
    if (pending.current) throw new Error("Finish or cancel the current dice entry first.");
    if (source === "digital") return { result: await operation(undefined), physical: false };
    return new Promise((resolve) => {
      pending.current = { title: name, operation, faces: [...initialFaces], resolve: resolve as Pending["resolve"] };
      setTitle(name); setRequest({ index: 0, sides: 0, label: "Preparing the roll…" }); void attempt(initialFaces);
    });
  }
  function run<T>(name: string, operation: (die: DieRoller) => T, source = mode) {
    return remote(name, async (faces) => { if (faces === undefined) return operation(rollDie); const dice = physicalDice(faces); const result = operation(dice.roll); dice.finish(); return result; }, source);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const current = pending.current;
    if (!current || !request || request.sides < 2 || busy) return;
    const value = Number(text);
    if (!text.trim() || !Number.isInteger(value) || value < 1 || value > request.sides) { setError(`Enter a natural d${request.sides} face from 1 to ${request.sides}, without modifiers.`); return; }
    current.faces = [...current.faces, { sides: request.sides, label: request.label, value }];
    void attempt(current.faces);
  }
  return <Context.Provider value={{ mode, classic, setMode, setClassic, run, remote }}>{children}
    {request && <div className="physical-dice-overlay"><div className="physical-dice-dialog" ref={modal} role="dialog" aria-modal="true" aria-labelledby="physical-dice-title" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) close(null);
      if (event.key === "Tab") {
        const controls = Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}><p className="eyebrow">PHYSICAL DICE</p><h2 id="physical-dice-title">{title}</h2><p id="physical-dice-context">{request.label}</p>
      <form onSubmit={submit}><label>Natural d{request.sides || "…"} face<input ref={input} aria-describedby="physical-dice-context" type="number" min={1} max={request.sides || 100} step={1} value={text} disabled={busy || request.sides < 2} onChange={(event) => setText(event.target.value)} /></label><p>Enter the number showing on the die. The sheet adds modifiers, handles advantage/disadvantage, and requests any extra dice.</p>{history.length > 0 && <p className="physical-dice-history">Entered: {history.map((face) => `d${face.sides}: ${face.value}`).join(" · ")}</p>}{error && <p role="alert" className="lan-error">{error}</p>}<div className="physical-dice-actions"><button type="button" disabled={busy} onClick={() => close(null)}>Cancel roll</button><button type="submit" disabled={busy || request.sides < 2}>Use die face →</button></div></form>
      <button type="button" className="text-button" disabled={busy} onClick={() => void attempt(undefined)}>Use digital dice for this roll instead</button>
    </div></div>}
  </Context.Provider>;
}

export function useDiceRoll(revision?: string) {
  const value = useContext(Context);
  if (!value) throw new Error("Dice controls require DiceProvider.");
  const currentRevision = useRef(revision); currentRevision.current = revision;
  return { ...value, async run<T>(name: string, operation: (die: DieRoller) => T, source?: DiceSource) {
    const original = revision;
    const result = await value.run(name, operation, source);
    if (result && currentRevision.current !== original) throw new Error("The sheet changed during dice entry. Review it and start this roll again; no result was applied.");
    return result;
  } };
}

export function DiceModeControl() {
  const dice = useContext(Context);
  if (!dice) return null;
  return <label className="dice-source-control"><span>Play mode</span><select aria-label="Dice source" value={dice.classic ? "classic" : dice.mode} onChange={(event) => { const classic = event.target.value === "classic"; dice.setClassic(classic); if (!classic) dice.setMode(event.target.value as DiceSource); }}><option value="digital">Digital dice</option><option value="physical">Physical dice</option><option value="classic">Classic sheet</option></select></label>;
}
