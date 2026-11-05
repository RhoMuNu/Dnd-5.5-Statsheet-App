import { AutomationBadge, AutomationDetails, AutomationLegend } from "./AutomationNotice";
import { featureCoverage, spellCoverage, type CoverageMode } from "../data/automationCoverage";
import { RulesDescription } from "./RulesDescription";
import { useDiceRoll } from "./DiceProvider";
import { LanSpellTargets } from "./LanSpellTargets";
import { EquipmentSettings } from "./EquipmentSettings";
import { ARMOR_PRESETS, armorForItem, equipInventoryItem, inventoryArmor } from "../data/equipment";
import { useTableActivity } from "../data/tableActivity";
import { useMemo, useState, type FormEvent } from "react";
import { calculateCharacterStats } from "../data/calculations";
import type { Character, CharacterFeature, CharacterInventory, CharacterNotes, CharacterSpell, InventoryCurrency, InventoryItem } from "../data/characters";
import { castCharacterSpell, combatState, spellSlotKey } from "../data/gameplay";
import { SPELL_FORMULAS, resolveSpellCast } from "../data/spellEffects";
import { isIncapacitated, type RollMode } from "../data/conditions";
import { buildChoiceDescriptions, characterRuleFeatures, featureDescription, originDescriptions } from "../data/featureDescriptions";
import { SPELL_CATALOG, findSpellByName, spellFromCatalog } from "../data/rulesCatalog";
import { BACKGROUNDS } from "../data/creationOptions";

type SectionProps = { character: Character; onChange: (updates: Partial<Character>) => void };
const itemCategories = ["Weapon", "Armor", "Gear", "Treasure", "Other"];
const spellSchools = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation", "Other"];

function newId() { return globalThis.crypto?.randomUUID?.() ?? `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function FeaturesPage({ character, onChange }: SectionProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CharacterFeature["category"]>("feat");
  const [description, setDescription] = useState("");
  const dice = useDiceRoll();
  const coverageMode: CoverageMode = dice.paper ? "paper" : dice.classic ? "classic" : dice.mode;
  const coverageFor = (name: string, custom = false) => featureCoverage(name, character, coverageMode, custom);
  const features = character.features ?? [];
  const ruleFeatures = characterRuleFeatures(character);
  const origins = originDescriptions(character);
  const choices = buildChoiceDescriptions(character);
  const [featureSearch, setFeatureSearch] = useState("");
  const matches = (feature: { name: string; description: string; source?: string }) => (feature.name + " " + (feature.source ?? "") + " " + feature.description).toLowerCase().includes(featureSearch.trim().toLowerCase());

  function addFeature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !(description.trim() || featureDescription(name, character))) return;
    onChange({ features: [...features, { id: newId(), name: name.trim(), category, description: description.trim() || featureDescription(name, character) }] });
    setName(""); setDescription("");
  }
  function updateFeature(id: string, updates: Partial<CharacterFeature>) {
    onChange({ features: features.map((feature) => feature.id === id ? { ...feature, ...updates } : feature) });
  }

  return <section className="collection-page" aria-label={`Features and traits for ${character.name}`}>
    <div className="collection-page-heading"><div><p className="eyebrow">WHAT MAKES THEM UNIQUE</p><h2>Features &amp; traits</h2><p>Your class, subclass, species, origin feat, and recorded choices include offline rules references.</p></div></div>
    <AutomationLegend />
    <label className="feature-search">Search abilities<input type="search" value={featureSearch} onChange={(event) => setFeatureSearch(event.target.value)} placeholder="Name or rules text" /></label>
    {(character.advancement?.length ?? 0) > 0 && <details className="collection-panel feature-history"><summary>Level-up history</summary>{character.advancement!.map((entry) => <details className="level-feature" key={entry.id}><summary>Level {entry.level} · {entry.className} {entry.classLevel}</summary><p>{entry.subclass}{entry.feat ? ` · ${entry.feat}` : ""}</p><p>{Object.entries(entry.boosts ?? {}).filter(([, amount]) => amount).map(([ability, amount]) => `${ability} +${amount}`).join(", ")}</p>{Object.entries(entry.choices ?? {}).map(([key, choices]) => <p key={key}>{key.split(":").slice(1).join(" ")}: {choices.join(", ")}</p>)}<p>{entry.spells.length} spells selected · {entry.hpRoll === null ? "Average HP" : `Hit Die roll ${entry.hpRoll}`}</p></details>)}</details>}
    <section className="collection-panel"><h3>Class &amp; subclass features</h3>{ruleFeatures.length ? ruleFeatures.filter(matches).map((feature) => <details className="level-feature" key={feature.source + feature.level + feature.name}><summary>{feature.source} · Level {feature.level} · {feature.name}<AutomationBadge coverage={coverageFor(feature.name)} /></summary><AutomationDetails coverage={coverageFor(feature.name)} /><RulesDescription description={feature.description} /></details>) : <p className="collection-empty-copy">Choose a class and level to see class features here.</p>}</section>
    <section className="collection-panel"><h3>Origin &amp; species</h3>{origins.filter(matches).map((feature) => <details className="level-feature" key={feature.name}><summary>{feature.name}<small className="feature-source">{feature.source}</small><AutomationBadge coverage={coverageFor(feature.name)} /></summary><AutomationDetails coverage={coverageFor(feature.name)} /><RulesDescription description={feature.description} /></details>)}</section>
    {choices.length > 0 && <section className="collection-panel"><h3>Selected build abilities</h3>{choices.filter(matches).map((feature, index) => <details className="level-feature" key={feature.source + feature.name + index}><summary>{feature.name}<small className="feature-source">{feature.source}</small><AutomationBadge coverage={coverageFor(feature.name)} /></summary><AutomationDetails coverage={coverageFor(feature.name)} /><RulesDescription description={feature.description} /></details>)}</section>}
    <section className="collection-panel"><h3>Your features</h3>{features.length ? <div className="editable-feature-list">{features.filter((feature) => matches({ ...feature, description: feature.description || featureDescription(feature.name, character) })).map((feature) => <article className="editable-feature-card" key={feature.id}><div className="editable-feature-heading"><input aria-label="Feature name" maxLength={80} value={feature.name} onChange={(event) => updateFeature(feature.id, { name: event.target.value })} /><select aria-label="Feature category" value={feature.category} onChange={(event) => updateFeature(feature.id, { category: event.target.value as CharacterFeature["category"] })}><option value="class">Class</option><option value="species">Species</option><option value="feat">Feat</option><option value="other">Other</option></select><button type="button" className="text-button" onClick={() => onChange({ features: features.filter((entry) => entry.id !== feature.id) })}>Remove</button></div><AutomationBadge coverage={coverageFor(feature.name, true)} /><AutomationDetails coverage={coverageFor(feature.name, true)} /><textarea aria-label={`${feature.name || "Feature"} description`} rows={3} maxLength={20000} value={feature.description || featureDescription(feature.name, character)} onChange={(event) => updateFeature(feature.id, { description: event.target.value })} placeholder="What does this feature do?" /></article>)}</div> : <p className="collection-empty-copy">Your added traits and feats will appear here.</p>}</section>
    <form className="collection-panel collection-entry-form" onSubmit={addFeature}><h3>Add a feature, trait, or feat</h3><div className="collection-form-grid"><label><span>Name</span><input maxLength={80} value={name} onChange={(event) => { setName(event.target.value); setDescription(featureDescription(event.target.value, character)); }} placeholder="e.g. Alert" required /></label><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as CharacterFeature["category"])}><option value="class">Class</option><option value="species">Species</option><option value="feat">Feat</option><option value="other">Other</option></select></label><label className="collection-field-wide"><span>Description</span><textarea rows={3} maxLength={20000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what this feature does." required /></label></div><button className="primary-button" type="submit">Add feature <span>＋</span></button></form>
    <p className="collection-helper">Limited-use abilities can also have a counter on the Abilities &amp; Skills page.</p>
  </section>;
}

export function InventoryPage({ character, onChange }: SectionProps) {
  const stats = calculateCharacterStats(character);
  const inventory = character.inventory ?? { items: [], currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, startingKitsAdded: false };
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [weight, setWeight] = useState("0");
  const [category, setCategory] = useState("Gear");
  const [equipped, setEquipped] = useState(false);
  const carriedWeight = useMemo(() => inventory.items.reduce((total, item) => total + item.quantity * item.weight, 0) + Object.values(inventory.currency).reduce((total, coins) => total + coins, 0) / 50, [inventory]);

  function saveInventory(updates: Partial<CharacterInventory>) { onChange({ inventory: { ...inventory, ...updates } }); }
  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedQuantity = Number(quantity); const parsedWeight = Number(weight);
    if (!name.trim() || !Number.isInteger(parsedQuantity) || parsedQuantity < 1 || !Number.isFinite(parsedWeight) || parsedWeight < 0) return;
    const item: InventoryItem = { id: newId(), name: name.trim(), quantity: parsedQuantity, weight: parsedWeight, category, equipped, notes: "" };
    saveInventory({ items: equipInventoryItem([...inventory.items, item], item.id, {}) });
    setName(""); setQuantity("1"); setWeight("0"); setEquipped(false);
  }
  function updateItem(id: string, updates: Partial<InventoryItem>) {
    saveInventory({ items: equipInventoryItem(inventory.items, id, updates) });
  }
  function updateCurrency(key: keyof InventoryCurrency, rawValue: string) {
    const value = Math.max(0, Math.trunc(Number(rawValue) || 0));
    saveInventory({ currency: { ...inventory.currency, [key]: value } });
  }
  const backgroundData = BACKGROUNDS[character.background];
  const backgroundPackage = backgroundData ? (character.creationDetails?.equipmentChoice === "B" ? backgroundData.equipmentB : backgroundData.equipmentA) : "";
  const startingPackages = [{ source: "Class", text: character.creationDetails?.classEquipment ?? "" }, { source: "Background", text: backgroundPackage }].filter((entry) => entry.text);
  function addStartingKit() {
    const items: InventoryItem[] = [];
    const currency = { ...inventory.currency };
    for (const { text: equipmentPackage } of startingPackages) {
      for (const rawPart of equipmentPackage.replace(/^[A-C]:\s*/, "").split(/,\s*/)) {
        const part = rawPart.replace(/^and\s+/i, "").trim();
        const coins = part.match(/^(\d+)\s*(cp|sp|ep|gp|pp)$/i);
        if (coins) { currency[coins[2].toLowerCase() as keyof InventoryCurrency] += Number(coins[1]); continue; }
        if (!part) continue;
        const quantityMatch = part.match(/^(\d+)\s+(.+)$/);
        const itemName = quantityMatch?.[2] ?? part;
        const armor = armorForItem({ name: itemName });
        const category = armor || /armor|mail|shirt/i.test(itemName) ? "Armor" : /sword|axe|bow|spear|mace|flail|dagger|staff|javelin|sickle/i.test(itemName) ? "Weapon" : "Gear";
        items.push({ id: newId(), name: itemName, quantity: quantityMatch ? Number(quantityMatch[1]) : 1, weight: armor?.weight ?? 0, category, equipped: false, notes: armor ? "Starting equipment" : "Starting equipment · enter the weight when known." });
      }
    }
    saveInventory({ items: [...inventory.items, ...items], currency, startingKitsAdded: true });
  }

  return <section className="collection-page" aria-label={`Inventory for ${character.name}`}>
    <div className="collection-page-heading"><div><p className="eyebrow">WHAT THEY CARRY</p><h2>Inventory</h2><p>Track equipment, quantities, weight, and coins. Equipped standard weapons appear in attacks automatically. Custom weapon names need a manual attack profile. Enable equipped armor below to update AC, speed, and Stealth automatically.</p></div></div>
    <EquipmentSettings character={character} onChange={onChange} />
    <section className="collection-panel"><h3>Armor presets</h3><div className="play-controls"><label>Add standard armor<select aria-label="Add standard armor" value="" onChange={(event) => { const armor = ARMOR_PRESETS.find((entry) => entry.name === event.target.value); if (armor) saveInventory({ items: [...inventory.items, { id: newId(), name: armor.name, category: "Armor", quantity: 1, weight: armor.weight, equipped: false, notes: "" }] }); }}><option value="">Choose armor or shield…</option>{ARMOR_PRESETS.map((armor) => <option key={armor.name}>{armor.name}</option>)}</select></label></div></section>
    {startingPackages.length > 0 && <section className="collection-panel starting-kit-panel"><div className="collection-panel-heading"><h3>Starting equipment</h3>{!inventory.startingKitsAdded && <button className="backup-button" type="button" onClick={addStartingKit}>Add to inventory</button>}</div>{startingPackages.map(({ source, text }) => <p className="starting-kit-line" key={`${source}-${text}`}>{source}: {text}</p>)}<p className="collection-helper">The creator saves packages as rule text. Adding them creates item rows and coins; standard armor weights are filled in. Enter weights for other items.</p></section>}
    <section className="collection-panel"><div className="collection-panel-heading"><h3>Carrying load</h3><strong>{carriedWeight.toFixed(1)} / {stats.carryingCapacity} lb.</strong></div><div className="carry-meter" role="meter" aria-label="Carrying load" aria-valuemin={0} aria-valuemax={stats.carryingCapacity} aria-valuenow={Math.min(carriedWeight, stats.carryingCapacity)}><span style={{ width: `${Math.min(100, stats.carryingCapacity > 0 ? carriedWeight / stats.carryingCapacity * 100 : 0)}%` }} /></div>{carriedWeight > stats.carryingCapacity && <p className="collection-warning">This load exceeds the character’s calculated carrying capacity.</p>}</section>
    <section className="collection-panel"><div className="collection-panel-heading"><h3>Coins</h3><span>Coin weight included in carrying load</span></div><div className="coin-grid">{(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => <label key={coin}><span>{coin.toUpperCase()}</span><input type="number" min={0} max={999999} value={inventory.currency[coin]} onChange={(event) => updateCurrency(coin, event.target.value)} /></label>)}</div></section>
    <section className="collection-panel"><h3>Items</h3>{inventory.items.length ? <div className="inventory-list">{inventory.items.map((item) => <article className="inventory-item" key={item.id}><div className="inventory-item-main"><label><span>Item</span><input maxLength={100} value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} /></label><label><span>Type</span><select value={item.category} onChange={(event) => updateItem(item.id, { category: event.target.value })}>{itemCategories.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label><span>Qty</span><input type="number" min={0} max={9999} value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(0, Math.trunc(Number(event.target.value) || 0)) })} /></label><label><span>Each (lb.)</span><input type="number" min={0} max={99999} step="0.1" value={item.weight} onChange={(event) => updateItem(item.id, { weight: Math.max(0, Number(event.target.value) || 0) })} /></label><label className="inventory-equipped"><input type="checkbox" checked={item.equipped} onChange={(event) => updateItem(item.id, { equipped: event.target.checked })} /><span>Equipped</span></label><button type="button" className="text-button" onClick={() => saveInventory({ items: inventory.items.filter((entry) => entry.id !== item.id) })}>Remove</button></div><label className="inventory-item-notes"><span>Notes</span><input maxLength={300} value={item.notes} onChange={(event) => updateItem(item.id, { notes: event.target.value })} placeholder="Optional details" /></label></article>)}</div> : <p className="collection-empty-copy">No items yet. Add starting gear, weapons, or treasure below.</p>}</section>
    <form className="collection-panel collection-entry-form" onSubmit={addItem}><h3>Add item</h3><div className="collection-form-grid"><label><span>Name</span><input maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Longsword" required /></label><label><span>Type</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{itemCategories.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label><span>Quantity</span><input type="number" min={1} max={9999} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label><span>Weight each (lb.)</span><input type="number" min={0} max={99999} step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} /></label><label className="inventory-equipped"><input type="checkbox" checked={equipped} onChange={(event) => setEquipped(event.target.checked)} /><span>Equipped</span></label></div><button className="primary-button" type="submit">Add item <span>＋</span></button></form>
  </section>;
}

export function SpellbookPage({ character, onChange }: SectionProps) {
  const dice = useDiceRoll(character.updatedAt);
  const publish = useTableActivity(character.id);
  const stats = calculateCharacterStats(character);
  const spells = character.spells ?? [];
  const [name, setName] = useState("");
  const [level, setLevel] = useState("0");
  const [school, setSchool] = useState("Other");
  const [castingTime, setCastingTime] = useState("1 action");
  const [range, setRange] = useState("");
  const [components, setComponents] = useState("V, S");
  const [concentration, setConcentration] = useState(false);
  const [description, setDescription] = useState("");
  const [ready, setReady] = useState(true);
  const [filter, setFilter] = useState("all");
  const [spellSearch, setSpellSearch] = useState("");
  const [expandedSpells, setExpandedSpells] = useState<Set<string>>(() => new Set());
  const [spellMode, setSpellMode] = useState<RollMode>("normal");
  const [spellAC, setSpellAC] = useState("");
  const [castMessage, setCastMessage] = useState("");
  const [castingClass, setCastingClass] = useState("");
  const [healSelf, setHealSelf] = useState(false);
  const [slotSelections, setSlotSelections] = useState<Record<string, string>>({});
  const visibleSpells = spells.filter((spell) => (filter === "all" || (filter === "ready" ? spell.prepared : !spell.prepared)) && `${spell.name} ${spell.school}`.toLowerCase().includes(spellSearch.trim().toLowerCase()));

  function changeSpellName(value: string) {
    setName(value);
    const match = findSpellByName(value);
    if (!match) return;
    setLevel(String(match.level)); setSchool(match.school); setCastingTime(match.castingTime);
    setRange(match.range); setComponents(match.components); setConcentration(match.concentration); setDescription(match.description);
  }
  function updateSpell(id: string, updates: Partial<CharacterSpell>) {
    onChange({ spells: spells.map((spell) => spell.id === id ? { ...spell, ...updates } : spell) });
  }
  function addSpell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const match = findSpellByName(name);
    const spell: CharacterSpell = { ...(match ? spellFromCatalog(match.key, "", "") : {}), id: newId(), name: match?.name ?? name.trim(), level: Number(level), school, castingTime: castingTime.trim(), range: range.trim(), components: components.trim(), concentration, description: description.trim(), prepared: ready };
    onChange({ spells: [...spells, spell] });
    setName(""); setLevel("0"); setSchool("Other"); setCastingTime("1 action"); setComponents("V, S"); setRange(""); setDescription(""); setConcentration(false); setReady(true);
  }
  function availableSlots(spell: CharacterSpell) {
    return stats.spellSlots.filter((slot) => slot.spellLevel >= spell.level && (character.resourceUses[spellSlotKey(slot.pool, slot.spellLevel)] ?? 0) < slot.total)
      .sort((a, b) => a.spellLevel - b.spellLevel);
  }
  function selectedSlot(spell: CharacterSpell) {
    const slots = availableSlots(spell);
    return slots.find((slot) => spellSlotKey(slot.pool, slot.spellLevel) === slotSelections[spell.id]) ?? slots[0];
  }
  async function castSpell(spell: CharacterSpell) {
    const slot = selectedSlot(spell);
    try {
      if (dice.classic) { if (character.armorSource === "inventory" && inventoryArmor(character).untrained) throw new Error("Cannot cast while wearing armor without training."); const updates = castCharacterSpell(character, spell.id, slot ? spellSlotKey(slot.pool, slot.spellLevel) : undefined); onChange(updates); setCastMessage(`${spell.name}: casting recorded. Resolve its effects at the table.`); return; }
      const rolled = await dice.run(`${spell.name} cast`, (die) => resolveSpellCast(character, spell.id, slot ? spellSlotKey(slot.pool, slot.spellLevel) : undefined, spell.className || castingClass || stats.spellcastingProgressions[0]?.className || "", healSelf, die, spellMode, spellAC.trim() && Number.isInteger(Number(spellAC)) ? Number(spellAC) : null));
      if (!rolled) return; const result = rolled.result;
      if (rolled.physical) result.summary = `Physical dice · ${result.summary}`;
      onChange(result.updates); setCastMessage(result.summary); publish(result.summary);
    } catch (reason) { setCastMessage(reason instanceof Error ? reason.message : "Could not cast spell."); }
  }

  return <section className="collection-page" aria-label={`Spellbook for ${character.name}`}>
    <p className="collection-helper">Add the spells your character knows. {dice.paper ? "Use this as a spell reference. Resolve casting and effects at the table, then adjust slots and resources manually." : dice.classic ? "Resolve dice and spell effects at the table. Mark casts here to track slots, actions, and concentration." : "Mark ready spells and choose a slot to cast or upcast. Concentration spells replace your previous concentration."}</p>
    {combatState(character).concentration && <div className="collection-panel"><strong>Concentrating: {combatState(character).concentration}</strong><button type="button" className="text-button" onClick={() => onChange({ combat: { ...combatState(character), concentration: "", concentrationDC: null } })}>End concentration</button></div>}
    <AutomationLegend />
    <div className="spellbook-summary"><span>{spells.length} spell{spells.length === 1 ? "" : "s"}</span><span>{spells.filter((spell) => spell.prepared).length} ready</span><span>{stats.spellSlots.reduce((sum, slot) => sum + slot.total - Math.min(slot.total, character.resourceUses[`spell-slot:${slot.pool}:${slot.spellLevel}`] ?? 0), 0)} spell slots left</span></div>
    {!dice.classic && <details className="spell-cast-settings"><summary>Cast settings</summary><div className="play-controls"><label>Casting class<select value={castingClass || stats.spellcastingProgressions[0]?.className || ""} onChange={(event) => setCastingClass(event.target.value)}>{stats.spellcastingProgressions.map((entry) => <option key={entry.className}>{entry.className}</option>)}</select></label><label className="toggle-row"><input type="checkbox" checked={healSelf} onChange={(event) => setHealSelf(event.target.checked)} />Apply automated healing to my own HP</label></div>
    <div className="play-controls"><label>Spell attack roll mode<select value={spellMode} onChange={(event) => setSpellMode(event.target.value as RollMode)}><option value="normal">Normal</option><option value="advantage">Advantage</option><option value="disadvantage">Disadvantage</option></select></label><label>Spell target AC (optional)<input type="number" min={0} max={50} value={spellAC} onChange={(event) => setSpellAC(event.target.value)} /></label></div></details>}
    {castMessage && <p role="status" aria-live="polite">{castMessage}</p>}

    <div className="spellbook-tools"><label>Search spellbook<input type="search" value={spellSearch} onChange={(event) => setSpellSearch(event.target.value)} placeholder="Spell name or school" /></label><label><span>Show</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All spells</option><option value="ready">Ready to cast</option><option value="unready">Not ready</option></select></label><span>{visibleSpells.length} shown</span><button type="button" className="backup-button" onClick={() => setExpandedSpells(new Set(visibleSpells.map((spell) => spell.id)))}>Expand all</button><button type="button" className="backup-button" onClick={() => setExpandedSpells(new Set())}>Collapse all</button></div>
    <section className="spellbook-list">{visibleSpells.length ? visibleSpells.map((spell) => <details className="spell-card spell-card-collapsible" key={spell.id} open={expandedSpells.has(spell.id)} onToggle={(event) => {
      if (event.target !== event.currentTarget) return;
      const open = event.currentTarget.open;
      setExpandedSpells((previous) => { if (previous.has(spell.id) === open) return previous; const next = new Set(previous); if (open) next.add(spell.id); else next.delete(spell.id); return next; });
    }}>
      <summary className="spell-card-summary"><span className="spell-summary-name"><strong>{spell.name}</strong><small>{spell.level === 0 ? "Cantrip" : "Level " + spell.level} · {spell.school} · {spell.castingTime || "Casting time not set"}{spell.concentration ? " · Concentration" : ""}</small></span><AutomationBadge coverage={spellCoverage(spell, dice.paper ? "paper" : dice.classic ? "classic" : dice.mode)} /><span className="spell-summary-ready">{spell.alwaysPrepared ? "Always prepared" : spell.prepared ? "Ready" : "Not ready"}</span></summary>
      <div className="spell-card-body"><AutomationDetails coverage={spellCoverage(spell, dice.paper ? "paper" : dice.classic ? "classic" : dice.mode)} /><label className="spell-ready-toggle"><input type="checkbox" checked={spell.prepared} disabled={spell.alwaysPrepared} onChange={(event) => updateSpell(spell.id, { prepared: event.target.checked })} /><span>{spell.alwaysPrepared ? "Always prepared" : "Ready"}</span></label>
      <div className="spell-meta"><span>{spell.castingTime || "Casting time not set"}</span><span>{spell.range || "Range not set"}</span><span>{spell.components || "Components not set"}</span>{spell.concentration && <span>Concentration</span>}</div>
      {spell.description && <p className="rule-description">{spell.description}</p>}
      {!dice.classic && <><div className="play-controls"><label>Effect automation<select aria-label={"Automation for " + spell.name} value={spell.automation ?? ""} onChange={(event) => updateSpell(spell.id, { automation: event.target.value })}><option value="">Manual effects · record casting only</option>{SPELL_FORMULAS.filter((formula) => formula.level === spell.level).map((formula) => <option key={formula.name} value={formula.name}>2024 {formula.name} formula</option>)}</select></label></div><LanSpellTargets character={character} spell={spell} slotKey={selectedSlot(spell) ? spellSlotKey(selectedSlot(spell)!.pool, selectedSlot(spell)!.spellLevel) : undefined} className={spell.className || castingClass || stats.spellcastingProgressions[0]?.className || ""} mode={spellMode} /></>}
      <div className="spell-card-actions">{!dice.paper && spell.level > 0 && <label>Spell slot<select aria-label={"Slot for " + spell.name} value={selectedSlot(spell) ? spellSlotKey(selectedSlot(spell)!.pool, selectedSlot(spell)!.spellLevel) : ""} onChange={(event) => setSlotSelections({ ...slotSelections, [spell.id]: event.target.value })}>{availableSlots(spell).length ? availableSlots(spell).map((slot) => <option key={spellSlotKey(slot.pool, slot.spellLevel)} value={spellSlotKey(slot.pool, slot.spellLevel)}>Level {slot.spellLevel} · {slot.pool}</option>) : <option value="">No suitable slot</option>}</select></label>}{!dice.paper && <button type="button" className="backup-button" disabled={!spell.prepared || isIncapacitated(character) || (spell.level > 0 && !selectedSlot(spell))} onClick={() => castSpell(spell)}>{dice.classic ? spell.level === 0 ? "Mark cantrip cast" : "Mark cast · spend slot" : spell.level === 0 ? "Cast cantrip" : "Cast · spend selected slot"}</button>}<button type="button" className="text-button" onClick={() => onChange({ spells: spells.filter((entry) => entry.id !== spell.id) })}>Remove</button></div></div>
    </details>) : <p className="collection-empty-copy">{spells.length ? "No spells match that filter." : "Your spellbook is empty. Add a spell below."}</p>}</section>
    <form className="collection-panel collection-entry-form" onSubmit={addSpell}><h3>Add a spell</h3><p className="collection-helper">Enter a catalog spell name to fill its details automatically, or enter a custom spell.</p><datalist id="spell-catalog-names">{SPELL_CATALOG.map((spell) => <option key={spell.key} value={spell.name} />)}</datalist><div className="collection-form-grid"><label><span>Name</span><input maxLength={100} value={name} onChange={(event) => changeSpellName(event.target.value)} list="spell-catalog-names" placeholder="e.g. Cure Wounds" required /></label><label><span>Level</span><select value={level} onChange={(event) => setLevel(event.target.value)}>{Array.from({ length: 10 }, (_, index) => <option key={index} value={index}>{index === 0 ? "Cantrip" : `Level ${index}`}</option>)}</select></label><label><span>School</span><select value={school} onChange={(event) => setSchool(event.target.value)}>{spellSchools.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label><span>Casting time</span><input maxLength={50} value={castingTime} onChange={(event) => setCastingTime(event.target.value)} placeholder="1 action" /></label><label><span>Range</span><input maxLength={50} value={range} onChange={(event) => setRange(event.target.value)} placeholder="60 feet" /></label><label><span>Components</span><input maxLength={50} value={components} onChange={(event) => setComponents(event.target.value)} placeholder="V, S, M" /></label><label className="inventory-equipped"><input type="checkbox" checked={concentration} onChange={(event) => setConcentration(event.target.checked)} /><span>Requires concentration</span></label><label className="inventory-equipped"><input type="checkbox" checked={ready} onChange={(event) => setReady(event.target.checked)} /><span>Ready to cast</span></label><label className="collection-field-wide"><span>Description / reminder</span><textarea rows={3} maxLength={20000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a quick rules reminder." /></label></div><button className="primary-button" type="submit">Add spell <span>＋</span></button></form>
  </section>;
}

export function NotesPage({ character, onChange }: SectionProps) {
  const notes = character.notes ?? { backstory: "", entries: [] };
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  function updateNotes(updates: Partial<CharacterNotes>) { onChange({ notes: { ...notes, ...updates } }); }
  function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() && !body.trim()) return;
    const now = new Date().toISOString();
    updateNotes({ entries: [{ id: newId(), title: title.trim() || "Session note", body: body.trim(), createdAt: now, updatedAt: now }, ...notes.entries] });
    setTitle(""); setBody("");
  }
  function updateEntry(id: string, updates: { title?: string; body?: string }) {
    updateNotes({ entries: notes.entries.map((entry) => entry.id === id ? { ...entry, ...updates, updatedAt: new Date().toISOString() } : entry) });
  }

  return <section className="collection-page" aria-label={`Notes for ${character.name}`}>
    <div className="collection-page-heading"><div><p className="eyebrow">KEEP THE STORY CLOSE</p><h2>Notes &amp; journal</h2><p>Backstory and session notes save with this character.</p></div></div>
    <section className="collection-panel"><label className="collection-block-field"><span>Backstory</span><textarea rows={7} maxLength={10000} value={notes.backstory} onChange={(event) => updateNotes({ backstory: event.target.value })} placeholder="Where did your character come from? What keeps them adventuring?" /></label></section>
    <form className="collection-panel collection-entry-form" onSubmit={addEntry}><h3>Add a journal entry</h3><div className="collection-form-grid"><label className="collection-field-wide"><span>Title</span><input maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Session 1 · The road to Redbrook" /></label><label className="collection-field-wide"><span>Note</span><textarea rows={4} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Clues, NPCs, promises, or anything to remember…" /></label></div><button className="primary-button" type="submit">Save journal entry <span>＋</span></button></form>
    <section className="collection-panel"><h3>Journal</h3>{notes.entries.length ? <div className="journal-list">{notes.entries.map((entry) => <article className="journal-entry" key={entry.id}><div className="journal-entry-heading"><input aria-label="Journal title" maxLength={100} value={entry.title} onChange={(event) => updateEntry(entry.id, { title: event.target.value })} /><small>{new Date(entry.updatedAt).toLocaleDateString()}</small><button type="button" className="text-button" onClick={() => updateNotes({ entries: notes.entries.filter((note) => note.id !== entry.id) })}>Remove</button></div><textarea aria-label={`${entry.title} note`} rows={4} maxLength={5000} value={entry.body} onChange={(event) => updateEntry(entry.id, { body: event.target.value })} placeholder="Write a note…" /></article>)}</div> : <p className="collection-empty-copy">Your adventure log is waiting for its first entry.</p>}</section>
  </section>;
}
