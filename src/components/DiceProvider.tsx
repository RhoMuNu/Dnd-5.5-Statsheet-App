import { createContext, useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { rollDie } from "../data/gameplay";
import { AUTOMATION_KEY, PLAY_LEVELS, readPlayPreferences, type AutomationLevel } from "../data/playPreferences";
import { physicalDice, PhysicalDiceRequired, type DiceSource, type DieFace, type DieRequest, type DieRoller } from "../data/physicalDice";

type Outcome<T> = { result: T; physical: boolean };
type DiceContextValue = {
  mode: DiceSource;
  classic: boolean;
  paper: boolean;
  automation: AutomationLevel;
  setAutomation: (level: AutomationLevel) => void;
  setMode: (mode: DiceSource) => void;
  run: <T>(title: string, operation: (die: DieRoller) => T, source?: DiceSource) => Promise<Outcome<T> | null>;
  remote: <T>(title: string, operation: (faces: DieFace[] | undefined) => Promise<T>, source?: DiceSource, initialFaces?: DieFace[]) => Promise<Outcome<T> | null>;
};
type Pending = { title: string; operation: (faces: DieFace[] | undefined) => Promise<unknown>; faces: DieFace[]; resolve: (result: Outcome<unknown> | null) => void };
const Context = createContext<DiceContextValue | null>(null);
const KEY = "taleforge.dice.source.v1";

export function DiceProvider({ children }: { children: ReactNode }) {
  const [preferences] = useState(() => { try { return readPlayPreferences(localStorage); } catch { return { automation: "assisted" as const, dice: "digital" as const }; } });
  const [mode, setMode] = useState<DiceSource>(preferences.dice);
  const [automation, setAutomation] = useState<AutomationLevel>(preferences.automation);
  const classic = automation !== "assisted", paper = automation === "paper";
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
  useEffect(() => { try { localStorage.setItem(AUTOMATION_KEY, automation); } catch { /* Keep the preference for this session. */ } }, [automation]);
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
  return <Context.Provider value={{ mode, classic, paper, automation, setMode, setAutomation, run, remote }}>{children}
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
  const [open, setOpen] = useState(false);
  const groupId = useId();
  if (!dice) return null;
  return <div className="play-preferences" onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); event.stopPropagation(); } }}><button type="button" className="backup-button play-settings-button" aria-expanded={open} onClick={() => setOpen(!open)}>Play settings · {PLAY_LEVELS.find((level) => level.id === dice.automation)?.name}{!dice.classic ? ` · ${dice.mode === "digital" ? "Digital dice" : "Physical dice"}` : ""}</button>
    {open && <section className="play-settings-panel" aria-label="Play settings"><h3>How much should the app handle?</h3><p>Bonuses stay calculated in every level. Moving between levels keeps your character and current resources.</p><fieldset><legend>Automation level</legend>{PLAY_LEVELS.map((level) => <label className={`play-level-option ${dice.automation === level.id ? "selected" : ""}`} key={level.id}><input type="radio" name={groupId} value={level.id} checked={dice.automation === level.id} onChange={() => dice.setAutomation(level.id)} /><span><strong>{level.name}</strong><small>{level.description}</small></span></label>)}</fieldset><label className="play-dice-choice">Dice source<select aria-label="Dice source" value={dice.mode} disabled={dice.classic} onChange={(event) => dice.setMode(event.target.value as DiceSource)}><option value="physical">Physical dice · enter faces, app adds bonuses</option><option value="digital">Digital dice · app rolls and adds bonuses</option></select></label><p>{dice.classic ? "Roll at the table without entering dice. Your dice preference is remembered for Assisted play." : "Physical and digital dice have the same supported calculations. You can also switch dice for an individual roll."}</p><p>Assisted play automates supported rules, not every ability. Check each ability’s automation label. This setting controls this device; incoming campaign updates still sync.</p><button type="button" className="primary-button" onClick={() => setOpen(false)}>Done</button></section>}
  </div>;
}
