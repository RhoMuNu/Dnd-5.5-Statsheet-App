import { ABILITIES, SKILLS, type AbilityName, type Character, type SkillName } from "../data/characters";
import { calculateCharacterStats, isClassSavingThrowProficient } from "../data/calculations";
import { useState } from "react";

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
  const stats = calculateCharacterStats(character);
  const maximumHp = stats.maxHitPoints ?? 0;
  const currentHp = Math.min(maximumHp, character.currentHitPoints ?? maximumHp);
  const hpPercent = maximumHp > 0 ? (currentHp / maximumHp) * 100 : 0;
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

  function changeHitPoints(amount: number) {
    onChange?.({ currentHitPoints: Math.min(maximumHp, Math.max(0, currentHp + amount)) });
  }

  function setHitPoints(rawValue: string) {
    if (rawValue === "") return;
    const value = Number(rawValue);
    if (Number.isInteger(value)) onChange?.({ currentHitPoints: Math.min(maximumHp, Math.max(0, value)) });
  }

  function setTemporaryHitPoints(rawValue: string) {
    if (rawValue === "") return;
    const value = Number(rawValue);
    if (Number.isInteger(value)) onChange?.({ temporaryHitPoints: Math.max(0, Math.min(9999, value)) });
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
    const updates = { ...character.resourceUses };
    for (const resource of stats.classResources) {
      if (!resource.key || resource.maxUses === undefined) continue;
      if (recovery === "Long Rest") updates[resource.key] = 0;
      else if (resource.recovery === "Short Rest") {
        updates[resource.key] = resource.shortRestRecovery === "all"
          ? 0
          : Math.max(0, (updates[resource.key] ?? 0) - 1);
      }
    }
    for (const slot of stats.spellSlots) {
      const key = spellSlotKey(slot.pool, slot.spellLevel);
      if (recovery === "Long Rest" || slot.pool.startsWith("Pact Magic")) updates[key] = 0;
    }
    const customResources = character.customResources.map((resource) => {
      if (recovery === "Long Rest" && resource.recovery !== "manual") return { ...resource, used: 0 };
      if (recovery === "Short Rest" && resource.recovery === "short-all") return { ...resource, used: 0 };
      if (recovery === "Short Rest" && resource.recovery === "short-one") return { ...resource, used: Math.max(0, resource.used - 1) };
      return resource;
    });
    onChange?.({
      resourceUses: updates,
      customResources,
      ...(recovery === "Long Rest" && stats.maxHitPoints !== null ? { currentHitPoints: stats.maxHitPoints, temporaryHitPoints: 0 } : {}),
    });
  }

  return (
    <section className="abilities-page" aria-label={`Abilities and calculated stats for ${character.name}`}>
      <div className="sheet-context-bar">
        <div className="roster-avatar" aria-hidden="true">{character.name.charAt(0).toUpperCase()}</div>
        <div><small>LIVE CHARACTER SHEET</small><strong>{character.name}</strong><span>{stats.classBreakdown.map(({ name, level }) => `${name} ${level}`).join(" / ") || "Class not chosen"} · Level {stats.totalLevel}</span></div>
        <div className="proficiency-chip"><small>PROFICIENCY</small><strong>+{stats.proficiencyBonus}</strong></div>
      </div>

      <div className="abilities-layout">
        <div className="ability-input-column">
          <section className="sheet-panel" aria-labelledby="ability-scores-title">
            <div className="panel-heading"><div><p className="eyebrow">THE SIX ABILITIES</p><h2 id="ability-scores-title">Ability scores</h2></div><span className="panel-hint">Modifiers update live</span></div>
            <div className="ability-score-grid">
              {ABILITIES.map((ability) => (
                <label className="ability-score-card" key={ability}>
                  <span>{ability}</span>
                  <input disabled={readOnly} type="number" min={1} max={30} step={1} aria-label={`${ability} score`} value={character.abilityScores[ability]} onChange={(event) => setAbilityScore(ability, event.target.value)} />
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

        <aside className="derived-column" aria-label="Calculated stats">
          <section className="derived-panel highlight-panel">
            <p className="eyebrow">AT A GLANCE</p>
            <div className="headline-stat"><span>Proficiency bonus</span><strong>+{stats.proficiencyBonus}</strong><small>Based on total character level {stats.totalLevel}</small></div>
            <div className="headline-stat"><span>Initiative</span><strong>{formatModifier(stats.initiative)}</strong><small>Dexterity modifier</small></div>
            <div className="headline-stat"><span>Passive Perception</span><strong>{stats.passivePerception}</strong><small>10 + Perception check modifier</small></div>
          </section>

          <section className="derived-panel">
            <p className="eyebrow">DEFENSE &amp; MOVEMENT</p>
            <div className="derived-stat-grid">
              <div><small>ARMOR CLASS</small><strong>{stats.armorClass}</strong></div>
              <div><small>MAX HIT POINTS</small><strong>{stats.maxHitPoints ?? "—"}</strong></div>
              <div><small>SPEED</small><strong>{stats.speed}<i> ft</i></strong></div>
              <div><small>HIT DIE</small><strong>{stats.hitDie ? `d${stats.hitDie}` : "—"}</strong></div>
            </div>
            <div className="hp-tracker" aria-label="Hit points">
              <div className="hp-tracker-heading"><strong>Hit points</strong><span>{stats.maxHitPoints === null ? "Choose a class to calculate maximum HP" : `${currentHp} / ${maximumHp} HP`}</span></div>
              <div className="hp-bar" role="meter" aria-label="Hit points remaining" aria-valuemin={0} aria-valuemax={maximumHp} aria-valuenow={currentHp}><span style={{ width: `${hpPercent}%` }} /></div>
              <div className="hp-controls"><button type="button" aria-label="Take one damage" disabled={readOnly || currentHp <= 0 || maximumHp === 0} onClick={() => changeHitPoints(-1)}>− Damage</button><label><span>Current HP</span><input type="number" min={0} max={maximumHp} disabled={readOnly || maximumHp === 0} value={currentHp} onChange={(event) => setHitPoints(event.target.value)} /></label><button type="button" aria-label="Heal one hit point" disabled={readOnly || currentHp >= maximumHp || maximumHp === 0} onClick={() => changeHitPoints(1)}>+ Heal</button><label className="temp-hp-field"><span>Temp HP</span><input type="number" min={0} max={9999} disabled={readOnly} value={character.temporaryHitPoints} onChange={(event) => setTemporaryHitPoints(event.target.value)} /></label></div>
            </div>
            {stats.appliedClassFeatures.length > 0 && <div className="applied-features"><small>CLASS FEATURES APPLIED</small>{stats.appliedClassFeatures.map((feature) => <span key={feature}>✦ {feature}</span>)}</div>}
          </section>

          <section className="derived-panel">
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
          </section>

          {stats.classResources.length > 0 && <section className="derived-panel class-resource-panel">
            <p className="eyebrow">CLASS FEATURES &amp; RESOURCES</p>
            {stats.classResources.map(({ key, label, value, maxUses, used, recovery }) => <div className={`derived-line ${maxUses !== undefined ? "tracked-resource" : ""}`} key={key ?? label}><span>{label}{recovery && <small className="resource-recovery">{recovery} recovery</small>}</span>{maxUses !== undefined && key ? <div className="resource-controls"><button type="button" disabled={readOnly || used === maxUses} aria-label={`Use one ${label}`} onClick={() => changeResource(key, 1, maxUses)}>−</button><strong>{maxUses - (used ?? 0)} / {maxUses}{value ? ` ${value}` : ""}</strong><button type="button" disabled={readOnly || used === 0} aria-label={`Restore one ${label}`} onClick={() => changeResource(key, -1, maxUses)}>+</button></div> : <strong>{value}</strong>}</div>)}
          </section>}

          <section className="derived-panel class-resource-panel custom-resource-panel">
            <p className="eyebrow">FEATS &amp; CUSTOM FEATURE TRACKERS</p>
            <p className="setup-note">Add limited-use feats, subclass features, magic items, or any other resource. Choose how it recovers.</p>
            {character.customResources.map((resource) => <div className="derived-line tracked-resource" key={resource.id}><span>{resource.name}<small className="resource-recovery">{resourceRecoveryLabel(resource.recovery)}</small></span><div className="resource-controls"><button type="button" disabled={readOnly || resource.used >= resource.maxUses} aria-label={`Use one ${resource.name}`} onClick={() => changeCustomResource(resource.id, 1)}>−</button><strong>{resource.maxUses - resource.used} / {resource.maxUses}</strong><button type="button" disabled={readOnly || resource.used <= 0} aria-label={`Restore one ${resource.name}`} onClick={() => changeCustomResource(resource.id, -1)}>+</button><button type="button" className="resource-remove" disabled={readOnly} aria-label={`Remove ${resource.name} tracker`} onClick={() => onChange?.({ customResources: character.customResources.filter((entry) => entry.id !== resource.id) })}>×</button></div></div>)}
            {!readOnly && (stats.classResources.some(({ recovery }) => recovery === "Short Rest") || stats.spellSlots.some(({ pool }) => pool.startsWith("Pact Magic")) || character.customResources.some(({ recovery }) => recovery.startsWith("short-"))) && <button type="button" className="resource-rest-button" onClick={() => recoverResources("Short Rest")}>Take a Short Rest <span>↻</span></button>}
            {!readOnly && stats.maxHitPoints !== null && <button type="button" className="resource-rest-button" onClick={() => recoverResources("Long Rest")}>Take a Long Rest <span>↻</span></button>}
            {!readOnly && <div className="custom-resource-form"><label><span>Feature / feat name</span><input value={resourceName} maxLength={50} placeholder="e.g. Lucky" onChange={(event) => setResourceName(event.target.value)} /></label><label><span>Uses</span><input type="number" min={1} max={999} value={resourceMax} onChange={(event) => setResourceMax(event.target.value)} /></label><label><span>Recovery</span><select value={resourceRecovery} onChange={(event) => setResourceRecovery(event.target.value as typeof resourceRecovery)}><option value="long">Long rest · all</option><option value="short-one">Short rest · one</option><option value="short-all">Short rest · all</option><option value="manual">Manual only</option></select></label><button type="button" className="resource-add-button" disabled={!resourceName.trim() || !Number.isInteger(Number(resourceMax)) || Number(resourceMax) < 1 || Number(resourceMax) > 999} onClick={addCustomResource}>Add tracker</button></div>}
          </section>

          {stats.classFeatures.length > 0 && <section className="derived-panel class-resource-panel">
            <p className="eyebrow">UNLOCKED CLASS FEATURES</p>
            <div className="feature-list">{stats.classFeatures.map(({ level, name }) => <div className="derived-line" key={`${level}-${name}`}><span>Level {level} · {name}</span>{name.includes("Choose ") && <strong>Choice</strong>}</div>)}</div>
          </section>}

          {stats.multiclassWarnings.length > 0 && <section className="derived-panel class-resource-panel">
            <p className="eyebrow">MULTICLASS RULE NOTES</p>
            {stats.multiclassWarnings.map((warning) => <p className="setup-note" key={warning}>{warning}</p>)}
          </section>}

          <details className="sheet-panel setup-panel">
            <summary>Movement, armor &amp; spell setup</summary>
            <fieldset className="setup-fields" disabled={readOnly}>
              <label className="compact-field"><span>Size</span><select value={character.size} onChange={(event) => onChange?.({ size: event.target.value as Character["size"] })}>{SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
              <label className="compact-field"><span>Base speed (feet)</span><input type="number" min={0} max={500} value={character.speedFeet} onChange={(event) => onChange?.({ speedFeet: numberOr(event.target.value, character.speedFeet, 0, 500) })} /></label>
              <label className="compact-field"><span>Other speed bonus (feet)</span><input type="number" min={-500} max={500} value={character.otherSpeedBonus} onChange={(event) => onChange?.({ otherSpeedBonus: numberOr(event.target.value, character.otherSpeedBonus, -500, 500) })} /></label>
              <label className="toggle-row"><input type="checkbox" checked={character.powerfulBuild} onChange={(event) => onChange?.({ powerfulBuild: event.target.checked })} /><span>Counts as one size larger for carrying</span></label>
              <label className="compact-field"><span>Armor formula</span><select value={character.armorMode} onChange={(event) => onChange?.({ armorMode: event.target.value as Character["armorMode"] })}>{ARMOR_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
              {stats.classBreakdown.some(({ name }) => name === "Barbarian") && stats.classBreakdown.some(({ name }) => name === "Monk") && <label className="compact-field"><span>Unarmored Defense choice</span><select value={character.unarmoredDefenseChoice} onChange={(event) => onChange?.({ unarmoredDefenseChoice: event.target.value as Character["unarmoredDefenseChoice"] })}><option value="">Use starting class</option><option value="Barbarian">Barbarian · Dex + Con</option><option value="Monk">Monk · Dex + Wis (no shield)</option></select></label>}
              {character.armorMode !== "unarmored" && <label className="compact-field"><span>Armor base AC</span><input type="number" min={1} max={40} value={character.armorBaseAC} onChange={(event) => onChange?.({ armorBaseAC: numberOr(event.target.value, character.armorBaseAC, 1, 40) })} /></label>}
              {character.armorMode === "heavy" && <label className="compact-field"><span>Armor Strength requirement</span><input type="number" min={0} max={30} value={character.armorStrengthRequirement} onChange={(event) => onChange?.({ armorStrengthRequirement: numberOr(event.target.value, character.armorStrengthRequirement, 0, 30) })} /></label>}
              <label className="toggle-row"><input type="checkbox" checked={character.hasShield} onChange={(event) => onChange?.({ hasShield: event.target.checked })} /><span>Shield AC bonus (+2 when trained)</span></label>
              <label className="compact-field"><span>Other AC bonus</span><input type="number" min={-20} max={20} value={character.otherAcBonus} onChange={(event) => onChange?.({ otherAcBonus: numberOr(event.target.value, character.otherAcBonus, -20, 20) })} /></label>
              <label className="compact-field"><span>Spellcasting ability override</span><select value={character.spellcastingAbility} onChange={(event) => onChange?.({ spellcastingAbility: event.target.value as AbilityName | "" })}><option value="">Use class default</option>{ABILITIES.map((ability) => <option key={ability}>{ability}</option>)}</select></label>
              <p className="setup-note">Class saving throw proficiencies and spell ability are applied automatically. For features that grant extras, use the save checkboxes or spell ability override. Choose Custom AC for an alternate class AC formula. Enter species speed and any armor Strength requirement here.</p>
            </fieldset>
          </details>
        </aside>
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

function numberOr(raw: string, current: number, min: number, max: number): number {
  if (raw === "") return current;
  const number = Number(raw);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : current;
}
