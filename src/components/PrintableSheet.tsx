import { createPortal } from "react-dom";
import { ABILITIES, SKILLS, type Character } from "../data/characters";
import { calculateCharacterStats, isSavingThrowProficient } from "../data/calculations";
import { attackNumbers } from "../data/attacks";
import { characterAttacks } from "../data/inventoryWeapons";
import { characterRuleFeatures, originDescriptions } from "../data/featureDescriptions";
import { currencyCopper } from "../data/inventoryManagement";

const signed = (value: number) => (value >= 0 ? `+${value}` : String(value));
const recoveryLabel: Record<Character["customResources"][number]["recovery"], string> = { "short-one": "Short Rest (one)", "short-all": "Short Rest", long: "Long Rest", manual: "Manual" };

/**
 * A plain, ink-friendly copy of the character used only when printing (or saving as PDF).
 * It is rendered next to the app root and hidden on screen; print styles show it instead of the app.
 */
export function PrintableSheet({ character }: { character: Character }) {
  return createPortal(<SheetContent character={character} />, document.body);
}

function SheetContent({ character }: { character: Character }) {
  const stats = calculateCharacterStats(character);
  const attacks = characterAttacks(character);
  const spells = [...character.spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const spellLevels = [...new Set(spells.map((spell) => spell.level))];
  const classFeatures = characterRuleFeatures(character);
  const origins = originDescriptions(character);
  const details = character.creationDetails;
  const currentHp = Math.min(stats.maxHitPoints ?? 0, character.currentHitPoints ?? stats.maxHitPoints ?? 0);
  const tools = [details?.toolProficiency, details?.classToolProficiency].filter(Boolean).join(", ");
  const resources = [
    ...stats.classResources.map((resource) => ({ label: resource.label, value: resource.maxUses !== undefined ? `${resource.maxUses - (resource.used ?? 0)} / ${resource.maxUses}${resource.value ? ` ${resource.value}` : ""}` : resource.value, recovery: resource.recovery ?? "" })),
    ...character.customResources.map((resource) => ({ label: resource.name, value: `${resource.maxUses - resource.used} / ${resource.maxUses}`, recovery: recoveryLabel[resource.recovery] })),
  ];
  const coins = character.inventory.currency;

  return <article className="print-sheet" aria-label={`Printable sheet for ${character.name}`}>
    <header className="print-header">
      <div><h1>{character.name}</h1><p>{[character.species, character.background].filter(Boolean).join(" · ")}{character.concept ? ` — ${character.concept}` : ""}</p></div>
      <div className="print-class"><strong>{stats.classBreakdown.map(({ name, level }) => { const subclass = character.classSubclasses?.[name]; return `${name} ${level}${subclass ? ` (${subclass})` : ""}`; }).join(" / ") || character.characterClass}</strong><span>Level {stats.totalLevel} · Proficiency {signed(stats.proficiencyBonus)}</span></div>
    </header>

    <section className="print-vitals">
      {[["Armor Class", stats.armorClass], ["Hit Points", `${currentHp} / ${stats.maxHitPoints ?? "—"}`], ["Temp HP", character.temporaryHitPoints || "—"], ["Speed", `${stats.speed} ft.`], ["Initiative", signed(stats.initiative)], ["Passive Perception", stats.passivePerception], ["Hit Dice", stats.classBreakdown.map(({ level, hitDie }) => `${level}d${hitDie}`).join(" + ") || "—"], ["Heroic Inspiration", character.heroicInspiration ? "Yes" : "—"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </section>

    <div className="print-columns">
      <section className="print-box">
        <h2>Abilities &amp; saving throws</h2>
        <table><thead><tr><th>Ability</th><th>Score</th><th>Mod</th><th>Save</th></tr></thead><tbody>{ABILITIES.map((ability) => <tr key={ability}><td>{ability}</td><td>{character.abilityScores[ability]}</td><td>{signed(stats.abilityModifiers[ability])}</td><td>{isSavingThrowProficient(character, ability) ? "● " : ""}{signed(stats.savingThrows[ability])}</td></tr>)}</tbody></table>
      </section>
      <section className="print-box">
        <h2>Skills</h2>
        <table><tbody>{SKILLS.map(({ name, ability }) => { const rank = character.skillProficiencies[name]; return <tr key={name}><td>{rank === 2 ? "◆" : rank === 1 ? "●" : "○"}</td><td>{name} <small>({ability.slice(0, 3)})</small></td><td>{signed(stats.skillBonuses[name])}</td></tr>; })}</tbody></table>
        <p className="print-legend">● proficient · ◆ expertise</p>
      </section>
    </div>

    <section className="print-box">
      <h2>Attacks</h2>
      {attacks.length ? <table><thead><tr><th>Attack</th><th>To hit</th><th>Damage</th><th>Notes</th></tr></thead><tbody>{attacks.map((attack) => { const numbers = attackNumbers(character, attack); return <tr key={attack.id}><td>{attack.name}</td><td>{signed(numbers.toHit)}</td><td>{attack.diceCount > 0 ? `${attack.diceCount}d${attack.dieSize}` : ""}{numbers.damageBonus || attack.diceCount === 0 ? `${attack.diceCount > 0 && numbers.damageBonus >= 0 ? "+" : ""}${numbers.damageBonus}` : ""} {attack.damageType}</td><td>{attack.notes}</td></tr>; })}</tbody></table> : <p>No attacks recorded.</p>}
    </section>

    {(stats.spellcastingProgressions.length > 0 || spells.length > 0) && <section className="print-box">
      <h2>Spellcasting</h2>
      <p>{stats.spellcastingProgressions.map((entry) => `${entry.className}: save DC ${entry.saveDC}, attack ${signed(entry.attackBonus)}`).join(" · ")}</p>
      {stats.spellSlots.length > 0 && <p>Slots: {stats.spellSlots.map(({ spellLevel, total, pool }) => `${pool.startsWith("Pact") ? "Pact " : ""}L${spellLevel} × ${total}`).join(" · ")}</p>}
      {spellLevels.map((level) => <div key={level} className="print-spell-level"><h3>{level === 0 ? "Cantrips" : `Level ${level}`}</h3><p>{spells.filter((spell) => spell.level === level).map((spell) => `${spell.name}${spell.concentration ? " (C)" : ""}${level > 0 ? spell.alwaysPrepared ? " ★" : spell.prepared ? " ●" : "" : ""}`).join(", ")}</p></div>)}
      {spells.some((spell) => spell.level > 0) && <p className="print-legend">● prepared · ★ always prepared · (C) concentration</p>}
    </section>}

    {resources.length > 0 && <section className="print-box">
      <h2>Limited-use features</h2>
      <table><tbody>{resources.map((resource, index) => <tr key={`${index}-${resource.label}`}><td>{resource.label}</td><td>{resource.value}</td><td>{resource.recovery}</td></tr>)}</tbody></table>
    </section>}

    <section className="print-box">
      <h2>Features &amp; traits</h2>
      <ul className="print-list">
        {classFeatures.map((feature) => <li key={feature.source + feature.level + feature.name}>{feature.name} <small>({feature.source} {feature.level})</small></li>)}
        {origins.map((feature) => <li key={feature.source + feature.name}>{feature.name} <small>({feature.source})</small></li>)}
        {character.features.map((feature) => <li key={feature.id}>{feature.name} <small>({feature.source ?? feature.category})</small></li>)}
      </ul>
    </section>

    <div className="print-columns">
      <section className="print-box">
        <h2>Equipment</h2>
        {character.inventory.items.length ? <ul className="print-list">{character.inventory.items.map((item) => <li key={item.id}>{item.quantity > 1 ? `${item.quantity} × ` : ""}{item.name}{item.equipped ? " (equipped)" : ""}{item.attuned ? " (attuned)" : ""}</li>)}</ul> : <p>No items recorded.</p>}
        <p>Coins: {coins.pp} PP · {coins.gp} GP · {coins.ep} EP · {coins.sp} SP · {coins.cp} CP ({(currencyCopper(coins) / 100).toFixed(2)} GP total)</p>
      </section>
      <section className="print-box">
        <h2>Proficiencies &amp; languages</h2>
        {details?.languages?.length ? <p>Languages: {details.languages.join(", ")}</p> : null}
        {tools && <p>Tools: {tools}</p>}
        <p>Size {stats.effectiveSize} · Carrying capacity {stats.carryingCapacity} lb.</p>
        {character.combat?.conditions?.length ? <p>Conditions: {character.combat.conditions.join(", ")}</p> : null}
      </section>
    </div>

    {(character.notes.backstory.trim() || details?.appearance) && <section className="print-box"><h2>Backstory</h2>{details?.appearance && <p>{details.appearance}</p>}<p className="print-prose">{character.notes.backstory}</p></section>}
    <footer className="print-footer">TaleForge · D&amp;D 2024 rules · printed {new Date().toLocaleDateString()}</footer>
  </article>;
}
