import { useState } from "react";
import type { Character } from "../data/characters";
import { combatState } from "../data/gameplay";
import { freshTurn, spendTurn, turnState, useActionSurge } from "../data/economy";

export function TurnPanel({ character, onChange, readOnly = false }: { character: Character; onChange?: (updates: Partial<Character>) => void; readOnly?: boolean }) {
  const turn = turnState(character), managed = turn.key.startsWith("lan-");
  const [error, setError] = useState("");
  function run(action: () => Partial<Character>) { try { onChange?.(action()); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unavailable."); } }
  return <section className="derived-panel gameplay-panel" aria-label="Turn resources"><p className="eyebrow">ACTION ECONOMY</p><fieldset disabled={readOnly}>
    {!managed && <label className="toggle-row"><input type="checkbox" checked={turn.enabled} onChange={(event) => onChange?.({ combat: { ...combatState(character), turn: { ...freshTurn(), enabled: event.target.checked } } })} />Enforce actions for local combat</label>}
    {turn.enabled && <><p>{turn.active ? "Your turn" : "Another combatant’s turn"} · Action {turn.actionUsed ? "spent" : "ready"} · Bonus Action {turn.bonusUsed ? "spent" : "ready"} · Reaction {turn.reactionUsed ? "spent" : "ready"}</p><p>{turn.attacksRemaining} attacks remaining in your Attack action{turn.surgeAction ? " · Action Surge action ready (no Magic action)" : ""}</p><div className="play-controls"><button type="button" onClick={() => run(() => spendTurn(character, "action"))}>Use action · Dash / Dodge / other</button><button type="button" onClick={() => run(() => spendTurn(character, "bonus"))}>Use Bonus Action</button><button type="button" onClick={() => run(() => spendTurn(character, "reaction"))}>Use Reaction</button>{(character.classLevels.Fighter ?? 0) >= 2 && <button type="button" onClick={() => run(() => useActionSurge(character))}>Action Surge</button>}{!managed && <button type="button" onClick={() => onChange?.({ combat: { ...combatState(character), turn: freshTurn(`local-${Date.now()}`) } })}>Start my next turn</button>}</div><p className="setup-note">Attacks, spell casts, Second Wind, and Lay on Hands spend their action costs automatically. Roll damage after the attack; damage does not spend another action. In LAN initiative, only the DM advances turns. Confirm triggers, movement, and feature exceptions with the DM.</p></>}
    {!turn.enabled && <p className="setup-note">Free play outside combat. Starting LAN initiative enables action enforcement for characters in the encounter.</p>}
  </fieldset>{error && <p role="status" className="lan-error">{error}</p>}</section>;
}
