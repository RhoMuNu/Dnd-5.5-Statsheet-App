import { InspirationControl } from "./InspirationControl";
import { PaperControls } from "./PaperControls";
import { CustomModifiersPanel } from "./CustomModifiersPanel";
import { HealthPanel } from "./HealthPanel";
import { useDiceRoll } from "./DiceProvider";
import { TurnPanel } from "./TurnPanel";
import { LevelUpWizard } from "./LevelUpWizard";
import { EquipmentSettings } from "./EquipmentSettings";
import { NumberField } from "./NumberField";
import { PrintableSheet } from "./PrintableSheet";
import { ABILITIES, SKILLS, type AbilityName, type Character, type SkillName } from "../data/characters";
import { calculateCharacterStats, isClassSavingThrowProficient } from "../data/calculations";
import { useEffect, useId, useState } from "react";
import { Icon } from "./Icon";
import { activeConditions } from "../data/conditions";
import { EffectsPanel } from "./EffectsPanel";
import { AttacksPanel } from "./AttacksPanel";
import { GameplayPanel } from "./GameplayPanel";
import { combatState, restCharacter } from "../data/gameplay";

type AbilitiesPageProps = { character: Character; onChange?: (updates: Partial<Character>) => void; readOnly?: boolean };

const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"] as const;
const ARMOR_MODES = [
  { value: "unarmored", label: "No armor · 10 + Dex" },
  { value: "light", label: "Light armor · base + full Dex" },
  { value: "medium", label: "Medium armor · base + Dex (max +2)" },
  { value: "heavy", label: "Heavy armor · base only" },
  { value: "custom", label: "Custom AC base" },
] as const;

export function AbilitiesPage({ character, onChange, readOnly = false }: AbilitiesPageProps) {
  const dice = useDiceRoll();
  const [levelingUp, setLevelingUp] = useState(false);
  const stats = calculateCharacterStats(character);
  const maximumHp = stats.maxHitPoints ?? 0;
  const currentHp = Math.min(maximumHp, character.currentHitPoints ?? maximumHp);
  const hpPercent = maximumHp > 0 ? (currentHp / maximumHp) * 100 : 0;
  const tabId = useId();
  const tabs = [{ id: "combat", name: "Combat", icon: "abilities", description: "Hit points, attacks & effects" }, { id: "abilities", name: "Abilities & skills", icon: "dice", description: "Scores, saves & proficiencies" }, { id: "resources", name: "Resources & rest", icon: "spells", description: "Spell slots & feature uses" }, { id: "setup", name: "Setup", icon: "shield", description: "Armor, movement & class notes" }] as const;
  type View = typeof tabs[number]["id"];
  const readView = (): View => {
    const requested = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("view");
    return tabs.some((tab) => tab.id === requested) ? requested as View : "combat";
  };
  const [view, setView] = useState<View>(readView);
  useEffect(() => {
    const sync = () => { if (window.location.hash.startsWith("#abilities")) setView(readView()); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  function chooseView(next: View) {
    setView(next);
    if (window.location.hash.startsWith("#abilities")) window.history.replaceState(null, "", `#abilities?view=${next}`);
  }
  const [resourceName, setResourceName] = useState("");
  const [resourceMax, setResourceMax] = useState("1");
  const [resourceRecovery, setResourceRecovery] = useState<Character["customResources"][number]["recovery"]>("long");

  function setAbilityScore(ability: AbilityName, rawValue: string) {
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 1 || value > 30) return;
    onChange?.({
      abilityScores: { ...character.abilityScores, [ability]: value },
      abilityScoreOverrides: { ...character.abilityScoreOverrides, [ability]: value },
    });
  }

  function setSaveProficiency(ability: AbilityName, proficient: boolean) {
    onChange?.({ savingThrowProficiencies: { ...character.savingThrowProficiencies, [ability]: proficient } });
  }

  function setSkillRank(skill: SkillName, rawRank: string) {
    const rank = Number(rawRank) as 0 | 1 | 2;
    onChange?.({ skillProficiencies: { ...character.skillProficiencies, [skill]: rank } });
  }

  function changeResource(key: string, amount: number, maxUses: number) {
    const used = Math.min(maxUses, Math.max(0, (character.resourceUses[key] ?? 0) + amount));
    onChange?.({ resourceUses: { ...character.resourceUses, [key]: used } });
  }

  function changeSpellSlot(key: string, amount: number, maxUses: number) {
    const used = Math.min(maxUses, Math.max(0, (character.resourceUses[key] ?? 0) + amount));
    onChange?.({ resourceUses: { ...character.resourceUses, [key]: used } });
  }

  function changeCustomResource(id: string, amount: number) {
    onChange?.({ customResources: character.customResources.map((resource) => resource.id === id ? { ...resource, used: Math.min(resource.maxUses, Math.max(0, resource.used + amount)) } : resource) });
  }

  function setHitPoints(rawValue: string) {
    if (rawValue === "") return;
    const value = Number(rawValue);
    if (Number.isInteger(value)) {
      const hp = Math.min(maximumHp, Math.max(0, value));
      onChange?.({ currentHitPoints: hp, ...(hp > 0 && !dice.paper ? { combat: { ...combatState(character), dead: false, stable: false, deathSuccesses: 0, deathFailures: 0 } } : {}) });
    }
  }

  function addCustomResource() {
    const name = resourceName.trim();
    const maxUses = Number(resourceMax);
    if (!name || !Number.isInteger(maxUses) || maxUses < 1 || maxUses > 999) return;
    onChange?.({ customResources: [...character.customResources, { id: globalThis.crypto?.randomUUID?.() ?? `custom-${Date.now()}`, name, maxUses, used: 0, recovery: resourceRecovery }] });
    setResourceName("");
    setResourceMax("1");
  }

  function recoverResources(recovery: "Short Rest" | "Long Rest") {
    onChange?.(restCharacter(character, recovery));
  }



  return (
    <section className="abilities-page" aria-label={`Character sheet for ${character.name}`}>
      {levelingUp && onChange && <LevelUpWizard character={character} onApply={onChange} onClose={() => setLevelingUp(false)} />}
      <header className="sheet-hero">
        <div className="sheet-hero-emblem"><Icon name="dice" /></div>
        <div className="sheet-hero-copy">{readOnly && <p className="eyebrow">SHARED CHARACTER</p>}<h2>{character.name}</h2><p>{[character.species, character.background].filter(Boolean).join(" · ")}</p><div className="hero-class-chips">{stats.classBreakdown.map(({ name, level }) => <span key={name}>{name} <b>{level}</b></span>)}{readOnly && <span>View only</span>}</div></div>
        <div className="hero-level"><span>LEVEL</span><strong>{stats.totalLevel.toString().padStart(2, "0")}</strong><small>2024 rules</small>{!readOnly && onChange && <button type="button" className="level-up-button" disabled={stats.totalLevel >= 20} onClick={() => setLevelingUp(true)}>{stats.totalLevel >= 20 ? "Maximum level" : "Level up ✦"}</button>}{!readOnly && <button type="button" className="text-button print-sheet-button" title="Print this character, or choose Save as PDF in the print dialog" onClick={() => window.print()}>Print sheet</button>}</div>
      </header>
      {!readOnly && <PrintableSheet character={character} />}
      {dice.classic && <div className="classic-mode-banner"><Icon name="dice" /><div><strong>{dice.paper ? "Paper sheet" : "Tracked sheet"}</strong><span>{dice.paper ? "Use calculated bonuses as a reference. Resolve rolls and effects yourself; enter final HP and resource changes." : "Roll and resolve effects at the table. Record casts, actions, slots, resources, and rests here."}</span></div></div>}
      <div className="vitals-strip" aria-label="Character vital statistics">
        <div className="vital-stat hp-vital"><span><Icon name="heart" />Hit points</span><strong>{currentHp}<small> / {stats.maxHitPoints ?? "—"}</small></strong><div className="vital-meter"><i style={{ width: `${hpPercent}%` }} /></div></div>
        {[{ label: "Armor class", value: stats.armorClass, icon: "shield" }, { label: "Initiative", value: formatModifier(stats.initiative), icon: "dice" }, { label: "Speed", value: `${stats.speed} ft`, icon: "arrow" }, { label: "Proficiency", value: formatModifier(stats.proficiencyBonus), icon: "spark" }, { label: "Passive Perception", value: stats.passivePerception, icon: "features" }].map(({label,value,icon}) => <div className="vital-stat" key={label}><span><Icon name={icon} />{label}</span><strong>{value}</strong></div>)}
      </div>
      <CustomModifiersPanel character={character} onChange={onChange} readOnly={readOnly} />
      {(activeConditions(character).length > 0 || (character.combat?.exhaustion ?? 0) > 0 || character.combat?.concentration) && <div className="sheet-status-chips">{activeConditions(character).map((condition) => <span key={condition}>{condition}</span>)}{(character.combat?.exhaustion ?? 0) > 0 && <span>Exhaustion {character.combat!.exhaustion}</span>}{character.combat?.concentration && <span className="concentration-chip">Concentrating · {character.combat.concentration}</span>}</div>}
      <div className="sheet-view-tabs" role="tablist" aria-label="Character sheet views">{tabs.map((tab) => <button type="button" role="tab" key={tab.id} id={`${tabId}-tab-${tab.id}`} aria-selected={view === tab.id} aria-controls={`${tabId}-panel-${tab.id}`} tabIndex={view === tab.id ? 0 : -1} onClick={() => chooseView(tab.id)} onKeyDown={(event) => {
        const index = tabs.findIndex((entry) => entry.id === tab.id);
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
        if (next >= 0) { event.preventDefault(); chooseView(tabs[next].id); document.getElementById(`${tabId}-tab-${tabs[next].id}`)?.focus(); }
      }}><Icon name={tab.icon} /><span><strong>{tab.name}</strong><small>{tab.description}</small></span></button>)}</div>
      <InspirationControl character={character} onChange={onChange} readOnly={readOnly} />
      <div className="sheet-tab-panel" role="tabpanel" id={`${tabId}-panel-combat`} aria-labelledby={`${tabId}-tab-combat`} hidden={view !== "combat"}>
        <div className="combat-layout"><div className="sheet-stack">          <section className="derived-panel">
            <p className="eyebrow">DEFENSE &amp; MOVEMENT</p>
            <div className="derived-stat-grid">
              <div><small>ARMOR CLASS</small><strong>{stats.armorClass}</strong></div>
              <div><small>MAX HIT POINTS</small><strong>{stats.maxHitPoints ?? "—"}</strong></div>
              <div><small>SPEED</small><strong>{stats.speed}<i> ft</i></strong></div>
              <div><small>HIT DIE</small><strong>{stats.hitDie ? `d${stats.hitDie}` : "—"}</strong></div>
            </div>
            <HealthPanel character={character} onChange={onChange ? (updates) => { if (updates.currentHitPoints !== undefined && updates.currentHitPoints !== null) setHitPoints(String(updates.currentHitPoints)); else onChange(updates); } : undefined} readOnly={readOnly} manual={dice.paper} />
            {stats.appliedClassFeatures.length > 0 && <div className="applied-features"><small>CLASS FEATURES APPLIED</small>{stats.appliedClassFeatures.map((feature) => <span key={feature}>✦ {feature}</span>)}</div>}
          </section>{dice.paper ? <PaperControls character={character} onChange={onChange} readOnly={readOnly} /> : <><TurnPanel character={character} onChange={onChange} readOnly={readOnly} /><GameplayPanel key={character.id} character={character} onChange={onChange} readOnly={readOnly} /></>}</div><div className="sheet-stack"><AttacksPanel key={`attacks-${character.id}`} character={character} onChange={onChange} readOnly={readOnly} />{!dice.paper && <EffectsPanel key={`effects-${character.id}`} character={character} onChange={onChange} readOnly={readOnly} />}</div></div>
      </div>
      <div className="sheet-tab-panel ability-view" role="tabpanel" id={`${tabId}-panel-abilities`} aria-labelledby={`${tabId}-tab-abilities`} hidden={view !== "abilities"}>          <section className="sheet-panel" aria-labelledby="ability-scores-title">
            <div className="panel-heading"><div><p className="eyebrow">THE SIX ABILITIES</p><h2 id="ability-scores-title">Ability scores</h2></div><span className="panel-hint">Modifiers update live</span></div>
            <div className="ability-score-grid">
              {ABILITIES.map((ability) => (
                <label className="ability-score-card" key={ability}>
                  <span>{ability}</span>
                  <NumberField disabled={readOnly} min={1} max={30} step={1} aria-label={`${ability} score`} value={character.abilityScores[ability]} onValue={(value) => setAbilityScore(ability, String(value))} />
                  <strong>{formatModifier(stats.abilityModifiers[ability])}</strong>
                </label>
              ))}
            </div>
            <p className="panel-footnote">Score range: 1–30. Ability modifier is floor((score − 10) ÷ 2).</p>
          </section>

          <section className="sheet-panel" aria-labelledby="saving-throws-title">
            <div className="panel-heading"><div><p className="eyebrow">RESIST A THREAT</p><h2 id="saving-throws-title">Saving throws</h2></div><span className="panel-hint">Mark your proficiencies</span></div>
            <div className="save-grid">
              {ABILITIES.map((ability) => (
                <label className="save-row" key={ability}>
                  <input type="checkbox" checked={character.savingThrowProficiencies[ability] || isClassSavingThrowProficient(character, ability)} disabled={readOnly || isClassSavingThrowProficient(character, ability)} onChange={(event) => setSaveProficiency(ability, event.target.checked)} />
                  <span>{ability}{isClassSavingThrowProficient(character, ability) && <small className="class-proficiency-label">CLASS</small>}</span><b>{formatModifier(stats.savingThrows[ability])}</b>
                </label>
              ))}
            </div>
          </section>

          <section className="sheet-panel" aria-labelledby="skills-title">
            <div className="panel-heading"><div><p className="eyebrow">TRAINED TALENTS</p><h2 id="skills-title">Skills</h2></div><span className="panel-hint">Expertise doubles proficiency</span></div>
            <div className="skills-table">
              {SKILLS.map(({ name, ability }) => (
                <div className="skill-row" key={name}>
                  <span className={`skill-rank rank-${character.skillProficiencies[name]}`} aria-hidden="true">{character.skillProficiencies[name] === 2 ? "◆" : character.skillProficiencies[name] === 1 ? "●" : "·"}</span>
                  <span className="skill-name">{name}</span>
                  <span className="skill-ability">{ability.slice(0, 3).toUpperCase()}</span>
                  <b>{formatModifier(stats.skillBonuses[name])}</b>
                  <label className="sr-only" htmlFor={`skill-${name.replaceAll(" ", "-")}`}>{name} proficiency</label>
                  <select disabled={readOnly} id={`skill-${name.replaceAll(" ", "-")}`} value={character.skillProficiencies[name]} onChange={(event) => setSkillRank(name, event.target.value)}>
                    <option value={0}>Not proficient</option>
                    <option value={1}>Proficient</option>
                    <option value={2}>Expertise</option>
                  </select>
                </div>
              ))}
            </div>
          </section>
</div>
      <div className="sheet-tab-panel resource-view" role="tabpanel" id={`${tabId}-panel-resources`} aria-labelledby={`${tabId}-tab-resources`} hidden={view !== "resources"}><div className="view-intro"><h3>Resources &amp; rest</h3><p>Manage spell slots and feature uses here. Rest when your party is ready.</p></div><div className="resource-view-grid">          <section className="derived-panel">
            <p className="eyebrow">STRENGTH &amp; MAGIC</p>
            <div className="derived-line"><span>Carry</span><strong>{formatWeight(stats.carryingCapacity)} lb.</strong></div>
            <div className="derived-line"><span>Drag, lift, or push</span><strong>{formatWeight(stats.pushDragLift)} lb.</strong></div>
            <div className="derived-line"><span>Effective size</span><strong>{stats.effectiveSize}</strong></div>
            <div className="derived-divider" />
            {stats.spellcastingProgressions.length === 0 ? <p className="no-spellcasting">Choose a spellcasting class to calculate spell stats.</p> : <>
              {stats.spellcastingProgressions.length === 1 && <><div className="derived-line"><span>Spell save DC</span><strong>{stats.spellcastingProgressions[0].saveDC}</strong></div><div className="derived-line"><span>Spell attack</span><strong>{formatModifier(stats.spellcastingProgressions[0].attackBonus)}</strong></div></>}
              {stats.spellSlots.length > 0 && <div className="spell-slot-list"><small>SPELL SLOTS · REMAINING / MAX</small>{stats.spellSlots.map(({ spellLevel, total, pool }) => { const key = spellSlotKey(pool, spellLevel); const used = Math.min(total, character.resourceUses[key] ?? 0); return <div className="derived-line tracked-resource" key={key}><span>{pool} · Level {spellLevel}</span><div className="resource-controls"><button type="button" disabled={readOnly || used === total} aria-label={`Use level ${spellLevel} spell slot`} onClick={() => changeSpellSlot(key, 1, total)}>−</button><strong>{total - used} / {total}</strong><button type="button" disabled={readOnly || used === 0} aria-label={`Restore level ${spellLevel} spell slot`} onClick={() => changeSpellSlot(key, -1, total)}>+</button></div></div>; })}</div>}
              {stats.spellcastingProgressions.length > 0 && <div className="spell-slot-list"><small>SPELLCASTING BY CLASS</small>{stats.spellcastingProgressions.map((entry) => <div className="derived-line" key={entry.className}><span>{entry.className}: {entry.cantrips === null ? "—" : `${entry.cantrips} cantrips`}{entry.count !== null ? ` · ${entry.count} ${entry.label?.toLowerCase()}` : ""} · DC {entry.saveDC} / {entry.attackBonus >= 0 ? "+" : ""}{entry.attackBonus}</span><strong>Lvl {stats.classBreakdown.find((item) => item.name === entry.className)?.level}</strong></div>)}</div>}
            </>}
          </section>          {stats.classResources.length > 0 && <section className="derived-panel class-resource-panel">
            <p className="eyebrow">CLASS FEATURES &amp; RESOURCES</p><p className="setup-note">Tracker only: − / + changes remaining uses, without applying the ability’s effects.</p>
            {stats.classResources.map(({ key, label, value, maxUses, used, recovery }) => <div className={`derived-line ${maxUses !== undefined ? "tracked-resource" : ""}`} key={key ?? label}><span>{label}{recovery && <small className="resource-recovery">{recovery} recovery</small>}</span>{maxUses !== undefined && key ? <div className="resource-controls"><button type="button" disabled={readOnly || used === maxUses} aria-label={`Use one ${label}`} onClick={() => changeResource(key, 1, maxUses)}>−</button><strong>{maxUses - (used ?? 0)} / {maxUses}{value ? ` ${value}` : ""}</strong><button type="button" disabled={readOnly || used === 0} aria-label={`Restore one ${label}`} onClick={() => changeResource(key, -1, maxUses)}>+</button></div> : <strong>{value}</strong>}</div>)}
          </section>}

          <section className="derived-panel class-resource-panel custom-resource-panel">
            <p className="eyebrow">FEATS &amp; CUSTOM FEATURE TRACKERS</p>
            <p className="setup-note">Add limited-use feats, subclass features, magic items, or any other resource. Choose how it recovers.</p>
            {character.customResources.map((resource) => <div className="derived-line tracked-resource" key={resource.id}><span>{resource.name}<small className="resource-recovery">{resourceRecoveryLabel(resource.recovery)}</small></span><div className="resource-controls"><button type="button" disabled={readOnly || resource.used >= resource.maxUses} aria-label={`Use one ${resource.name}`} onClick={() => changeCustomResource(resource.id, 1)}>−</button><strong>{resource.maxUses - resource.used} / {resource.maxUses}</strong><button type="button" disabled={readOnly || resource.used <= 0} aria-label={`Restore one ${resource.name}`} onClick={() => changeCustomResource(resource.id, -1)}>+</button><button type="button" className="resource-remove" disabled={readOnly} aria-label={`Remove ${resource.name} tracker`} onClick={() => onChange?.({ customResources: character.customResources.filter((entry) => entry.id !== resource.id) })}>×</button></div></div>)}
            {!readOnly && !dice.paper && (stats.classResources.some(({ recovery }) => recovery === "Short Rest") || stats.spellSlots.some(({ pool }) => pool.startsWith("Pact Magic")) || character.customResources.some(({ recovery }) => recovery.startsWith("short-")) || character.inventory.items.some((item) => item.charges?.recovery === "short")) && <button type="button" className="resource-rest-button" disabled={currentHp <= 0 || combatState(character).dead} onClick={() => recoverResources("Short Rest")}>Take a Short Rest <span>↻</span></button>}
            {!readOnly && !dice.paper && stats.maxHitPoints !== null && <button type="button" className="resource-rest-button" disabled={currentHp <= 0 || combatState(character).dead} onClick={() => recoverResources("Long Rest")}>Take a Long Rest <span>↻</span></button>}
            {!readOnly && <div className="custom-resource-form"><label><span>Feature / feat name</span><input value={resourceName} maxLength={50} placeholder="e.g. Lucky" onChange={(event) => setResourceName(event.target.value)} /></label><label><span>Uses</span><input type="number" min={1} max={999} value={resourceMax} onChange={(event) => setResourceMax(event.target.value)} /></label><label><span>Recovery</span><select value={resourceRecovery} onChange={(event) => setResourceRecovery(event.target.value as typeof resourceRecovery)}><option value="long">Long rest · all</option><option value="short-one">Short rest · one</option><option value="short-all">Short rest · all</option><option value="manual">Manual only</option></select></label><button type="button" className="resource-add-button" disabled={!resourceName.trim() || !Number.isInteger(Number(resourceMax)) || Number(resourceMax) < 1 || Number(resourceMax) > 999} onClick={addCustomResource}>Add tracker</button></div>}
          </section>

</div></div>
      <div className="sheet-tab-panel setup-view" role="tabpanel" id={`${tabId}-panel-setup`} aria-labelledby={`${tabId}-tab-setup`} hidden={view !== "setup"}>          <section className="sheet-panel setup-panel">
            <div className="panel-heading"><div><p className="eyebrow">CHARACTER CONFIGURATION</p><h2>Armor, movement &amp; spellcasting</h2></div></div>
            <EquipmentSettings character={character} onChange={onChange} readOnly={readOnly} />
            <fieldset className="setup-fields" disabled={readOnly}>
              <label className="compact-field"><span>Size</span><select value={character.size} onChange={(event) => onChange?.({ size: event.target.value as Character["size"] })}>{SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
              <label className="compact-field"><span>Base speed (feet)</span><NumberField min={0} max={500} value={character.speedFeet} onValue={(value) => onChange?.({ speedFeet: value })} /></label>
              <label className="compact-field"><span>Other speed bonus (feet)</span><NumberField min={-500} max={500} value={character.otherSpeedBonus} onValue={(value) => onChange?.({ otherSpeedBonus: value })} /></label>
              <label className="toggle-row"><input type="checkbox" checked={character.powerfulBuild} onChange={(event) => onChange?.({ powerfulBuild: event.target.checked })} /><span>Counts as one size larger for carrying</span></label>
              <label className="compact-field"><span>Armor formula</span><select disabled={character.armorSource === "inventory"} value={character.armorMode} onChange={(event) => onChange?.({ armorMode: event.target.value as Character["armorMode"] })}>{ARMOR_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
              {stats.classBreakdown.some(({ name }) => name === "Barbarian") && stats.classBreakdown.some(({ name }) => name === "Monk") && <label className="compact-field"><span>Unarmored Defense choice</span><select value={character.unarmoredDefenseChoice} onChange={(event) => onChange?.({ unarmoredDefenseChoice: event.target.value as Character["unarmoredDefenseChoice"] })}><option value="">Use starting class</option><option value="Barbarian">Barbarian · Dex + Con</option><option value="Monk">Monk · Dex + Wis (no shield)</option></select></label>}
              {character.armorMode !== "unarmored" && <label className="compact-field"><span>Armor base AC</span><NumberField min={1} max={40} disabled={character.armorSource === "inventory"} value={character.armorBaseAC} onValue={(value) => onChange?.({ armorBaseAC: value })} /></label>}
              {character.armorMode === "heavy" && <label className="compact-field"><span>Armor Strength requirement</span><NumberField min={0} max={30} disabled={character.armorSource === "inventory"} value={character.armorStrengthRequirement} onValue={(value) => onChange?.({ armorStrengthRequirement: value })} /></label>}
              <label className="toggle-row"><input disabled={character.armorSource === "inventory"} type="checkbox" checked={character.hasShield} onChange={(event) => onChange?.({ hasShield: event.target.checked })} /><span>Shield AC bonus (+2 when trained)</span></label>
              <label className="compact-field"><span>Other AC bonus</span><NumberField min={-20} max={20} value={character.otherAcBonus} onValue={(value) => onChange?.({ otherAcBonus: value })} /></label>
              <label className="compact-field"><span>Spellcasting ability override</span><select value={character.spellcastingAbility} onChange={(event) => onChange?.({ spellcastingAbility: event.target.value as AbilityName | "" })}><option value="">Use class default</option>{ABILITIES.map((ability) => <option key={ability}>{ability}</option>)}</select></label>
              <p className="setup-note">Class saving throw proficiencies and spell ability are applied automatically. For features that grant extras, use the save checkboxes or spell ability override. Choose Custom AC for an alternate class AC formula. Enter species speed and any armor Strength requirement here.</p>
            </fieldset>
          </section>          {stats.classFeatures.length > 0 && <section className="derived-panel class-resource-panel">
            <p className="eyebrow">UNLOCKED CLASS FEATURES</p>
            <div className="feature-list">{stats.classFeatures.map(({ level, name }) => <div className="derived-line" key={`${level}-${name}`}><span>Level {level} · {name}</span>{name.includes("Choose ") && <strong>Choice</strong>}</div>)}</div>
          </section>}

          {stats.multiclassWarnings.length > 0 && <section className="derived-panel class-resource-panel">
            <p className="eyebrow">MULTICLASS RULE NOTES</p>
            {stats.multiclassWarnings.map((warning) => <p className="setup-note" key={warning}>{warning}</p>)}
          </section>}

</div>
    </section>
  );
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function spellSlotKey(pool: string, spellLevel: number): string {
  return `spell-slot:${pool}:${spellLevel}`;
}

function resourceRecoveryLabel(recovery: Character["customResources"][number]["recovery"]): string {
  if (recovery === "short-one") return "Short Rest · regain one";
  if (recovery === "short-all") return "Short Rest · regain all";
  if (recovery === "long") return "Long Rest · regain all";
  return "Manual recovery";
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
