import type { Character } from "../data/characters";
import { RULE_TERM_REFERENCES } from "../data/abilityReferences";
import { gainsInspirationOnLongRest } from "../data/calculations";

export function InspirationControl({ character, onChange, readOnly }: { character: Character; onChange?: (updates: Partial<Character>) => void; readOnly: boolean }) {
  return <section className="inspiration-control"><label className="toggle-row"><input type="checkbox" disabled={readOnly} checked={character.heroicInspiration === true} onChange={(event) => onChange?.({ heroicInspiration: event.target.checked })} />Heroic Inspiration · {character.heroicInspiration ? "available" : "not held"}</label><details><summary>How to use it · manual reroll</summary><p>{RULE_TERM_REFERENCES["Heroic Inspiration"]} Resolve the reroll at the table, or make a replacement roll with the appropriate helper, then uncheck this tracker. It is not spent automatically.{gainsInspirationOnLongRest(character) ? " Resourceful: finishing a Long Rest with the sheet’s rest control marks it available again." : ""}</p></details></section>;
}
