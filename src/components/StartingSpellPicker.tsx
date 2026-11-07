import { useState } from "react";
import type { Character } from "../data/characters";
import { SPELL_CATALOG, classLevel, subclassOf } from "../data/rulesCatalog";
import { startingSpellLimits } from "../data/startingSpells";
import { subclassSpellGrants } from "../data/subclassSpells";

export function StartingSpellPicker({ character, selections, onChange }: { character: Character; selections: Record<string, string[]>; onChange: (value: Record<string, string[]>) => void }) {
  const grantedNames = Object.entries(character.rulesChoices ?? {}).filter(([key]) => /:order-cantrip$|:tome-/.test(key)).flatMap(([, values]) => values);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  return <div className="starting-spells"><div className="play-controls"><label>Search starting spells<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Spell name or school" /></label><label>Starting spell level<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All available</option><option value="0">Cantrips</option>{Array.from({ length: 9 }, (_, index) => <option key={index} value={index + 1}>Level {index + 1}</option>)}</select></label></div>{Object.entries(selections).map(([name, keys]) => {
    const limits = startingSpellLimits(character, name);
    const selected = SPELL_CATALOG.filter((spell) => keys.includes(spell.key));
    const automatic = subclassSpellGrants(subclassOf(character, name), classLevel(character, name), name, "preview");
    return <section className="creator-section" key={name}><h3>{name} spells</h3><p role="status">Cantrips: {selected.filter((spell) => spell.level === 0).length} / {limits.cantrips} · Leveled spells: {selected.filter((spell) => spell.level > 0).length} / {limits.spells}</p>{name === "Wizard" && <p>Your spellbook contains {limits.spells} spells. The first {limits.prepared} selected leveled spells start prepared; you can change preparation in the Spellbook.</p>}{automatic.length > 0 && <p>Always prepared: {automatic.map((spell) => spell.name).join(", ")}. These do not count against your selections.</p>}<div className="level-spell-list">{SPELL_CATALOG.filter((spell) => spell.classes.includes(name) && !grantedNames.includes(spell.name) && spell.level <= limits.maxLevel && (spell.level > 0 || limits.cantrips > 0) && !automatic.some((granted) => granted.catalogKey === spell.key) && (filter === "all" || spell.level === Number(filter)) && `${spell.name} ${spell.school}`.toLowerCase().includes(search.toLowerCase())).map((spell) => {
      const checked = keys.includes(spell.key);
      const full = selected.filter((entry) => (entry.level === 0) === (spell.level === 0)).length >= (spell.level === 0 ? limits.cantrips : limits.spells);
      return <article className={`level-spell-card ${checked ? "selected" : ""}`} key={spell.key}><label><input type="checkbox" checked={checked} disabled={!checked && full} onChange={() => onChange({ ...selections, [name]: checked ? keys.filter((key) => key !== spell.key) : [...keys, spell.key] })} /><strong>{spell.name}</strong><small>{spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · {spell.school} · {spell.castingTime}</small></label><details><summary>Spell details</summary><p>{spell.range} · {spell.components}{spell.concentration ? " · Concentration" : ""}</p><p className="rule-description">{spell.description}</p></details></article>;
    })}</div></section>;
  })}</div>;
}
