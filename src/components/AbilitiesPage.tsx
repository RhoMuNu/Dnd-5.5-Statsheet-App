import { ABILITIES, SKILLS, type AbilityName, type Character, type SkillName } from "../data/characters";
import { calculateCharacterStats, isClassSavingThrowProficient } from "../data/calculations";

type AbilitiesPageProps = { character: Character; onChange: (updates: Partial<Character>) => void };

const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"] as const;
const ARMOR_MODES = [
  { value: "unarmored", label: "No armor · 10 + Dex" },
  { value: "light", label: "Light armor · base + full Dex" },
  { value: "medium", label: "Medium armor · base + Dex (max +2)" },
  { value: "heavy", label: "Heavy armor · base only" },
  { value: "custom", label: "Custom AC base" },
] as const;

export function AbilitiesPage({ character, onChange }: AbilitiesPageProps) {
  const stats = calculateCharacterStats(character);

  function setAbilityScore(ability: AbilityName, rawValue: string) {
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 1 || value > 30) return;
    onChange({ abilityScores: { ...character.abilityScores, [ability]: value } });
  }

  function setSaveProficiency(ability: AbilityName, proficient: boolean) {
    onChange({ savingThrowProficiencies: { ...character.savingThrowProficiencies, [ability]: proficient } });
  }

  function setSkillRank(skill: SkillName, rawRank: string) {
    const rank = Number(rawRank) as 0 | 1 | 2;
    onChange({ skillProficiencies: { ...character.skillProficiencies, [skill]: rank } });
  }

  return (
    <section className="abilities-page" aria-label={`Abilities and calculated stats for ${character.name}`}>
      <div className="sheet-context-bar">
        <div className="roster-avatar" aria-hidden="true">{character.name.charAt(0).toUpperCase()}</div>
        <div><small>LIVE CHARACTER SHEET</small><strong>{character.name}</strong><span>{character.characterClass || "Class not chosen"} · Level {character.level}</span></div>
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
                  <input type="number" min={1} max={30} step={1} aria-label={`${ability} score`} value={character.abilityScores[ability]} onChange={(event) => setAbilityScore(ability, event.target.value)} />
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
                  <input type="checkbox" checked={character.savingThrowProficiencies[ability] || isClassSavingThrowProficient(character, ability)} disabled={isClassSavingThrowProficient(character, ability)} onChange={(event) => setSaveProficiency(ability, event.target.checked)} />
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
                  <select id={`skill-${name.replaceAll(" ", "-")}`} value={character.skillProficiencies[name]} onChange={(event) => setSkillRank(name, event.target.value)}>
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
            <div className="headline-stat"><span>Proficiency bonus</span><strong>+{stats.proficiencyBonus}</strong><small>Based on character level</small></div>
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
            {stats.appliedClassFeatures.length > 0 && <div className="applied-features"><small>CLASS FEATURES APPLIED</small>{stats.appliedClassFeatures.map((feature) => <span key={feature}>✦ {feature}</span>)}</div>}
          </section>

          <section className="derived-panel">
            <p className="eyebrow">STRENGTH &amp; MAGIC</p>
            <div className="derived-line"><span>Carry</span><strong>{formatWeight(stats.carryingCapacity)} lb.</strong></div>
            <div className="derived-line"><span>Drag, lift, or push</span><strong>{formatWeight(stats.pushDragLift)} lb.</strong></div>
            <div className="derived-line"><span>Effective size</span><strong>{stats.effectiveSize}</strong></div>
            <div className="derived-divider" />
            {stats.spellSaveDC === null ? <p className="no-spellcasting">Choose a spellcasting ability below to calculate spell stats.</p> : <>
              <div className="derived-line"><span>Spell save DC</span><strong>{stats.spellSaveDC}</strong></div>
              <div className="derived-line"><span>Spell attack</span><strong>{formatModifier(stats.spellAttackBonus ?? 0)}</strong></div>
              {stats.spellSlots.length > 0 && <div className="spell-slot-list"><small>SPELL SLOTS · {stats.spellSlotRecovery.toUpperCase()}</small>{stats.spellSlots.map(({ spellLevel, total }) => <div className="derived-line" key={spellLevel}><span>Level {spellLevel}</span><strong>{total}</strong></div>)}</div>}
              {(stats.cantrips !== null || stats.preparedSpellCount !== null) && <div className="spell-slot-list"><small>SPELLCASTING PROGRESSION</small>{stats.cantrips !== null && <div className="derived-line"><span>Cantrips known</span><strong>{stats.cantrips}</strong></div>}{stats.preparedSpellCount !== null && <div className="derived-line"><span>{stats.spellCountLabel}</span><strong>{stats.preparedSpellCount}</strong></div>}</div>}
            </>}
          </section>

          {stats.classResources.length > 0 && <section className="derived-panel class-resource-panel">
            <p className="eyebrow">CLASS FEATURES &amp; RESOURCES</p>
            {stats.classResources.map(({ label, value }) => <div className="derived-line" key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </section>}

          {stats.classFeatures.length > 0 && <section className="derived-panel class-resource-panel">
            <p className="eyebrow">UNLOCKED CLASS FEATURES</p>
            <div className="feature-list">{stats.classFeatures.map(({ level, name }) => <div className="derived-line" key={`${level}-${name}`}><span>Level {level} · {name}</span>{name.includes("Choose ") && <strong>Choice</strong>}</div>)}</div>
          </section>}

          <details className="sheet-panel setup-panel">
            <summary>Movement, armor &amp; spell setup</summary>
            <div className="setup-fields">
              <label className="compact-field"><span>Size</span><select value={character.size} onChange={(event) => onChange({ size: event.target.value as Character["size"] })}>{SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
              <label className="compact-field"><span>Base speed (feet)</span><input type="number" min={0} max={500} value={character.speedFeet} onChange={(event) => onChange({ speedFeet: numberOr(event.target.value, character.speedFeet, 0, 500) })} /></label>
              <label className="compact-field"><span>Other speed bonus (feet)</span><input type="number" min={-500} max={500} value={character.otherSpeedBonus} onChange={(event) => onChange({ otherSpeedBonus: numberOr(event.target.value, character.otherSpeedBonus, -500, 500) })} /></label>
              <label className="toggle-row"><input type="checkbox" checked={character.powerfulBuild} onChange={(event) => onChange({ powerfulBuild: event.target.checked })} /><span>Counts as one size larger for carrying</span></label>
              <label className="compact-field"><span>Armor formula</span><select value={character.armorMode} onChange={(event) => onChange({ armorMode: event.target.value as Character["armorMode"] })}>{ARMOR_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
              {character.armorMode !== "unarmored" && <label className="compact-field"><span>Armor base AC</span><input type="number" min={1} max={40} value={character.armorBaseAC} onChange={(event) => onChange({ armorBaseAC: numberOr(event.target.value, character.armorBaseAC, 1, 40) })} /></label>}
              {character.armorMode === "heavy" && <label className="compact-field"><span>Armor Strength requirement</span><input type="number" min={0} max={30} value={character.armorStrengthRequirement} onChange={(event) => onChange({ armorStrengthRequirement: numberOr(event.target.value, character.armorStrengthRequirement, 0, 30) })} /></label>}
              <label className="toggle-row"><input type="checkbox" checked={character.hasShield} onChange={(event) => onChange({ hasShield: event.target.checked })} /><span>Shield AC bonus (+2 when trained)</span></label>
              <label className="compact-field"><span>Other AC bonus</span><input type="number" min={-20} max={20} value={character.otherAcBonus} onChange={(event) => onChange({ otherAcBonus: numberOr(event.target.value, character.otherAcBonus, -20, 20) })} /></label>
              <label className="compact-field"><span>Spellcasting ability override</span><select value={character.spellcastingAbility} onChange={(event) => onChange({ spellcastingAbility: event.target.value as AbilityName | "" })}><option value="">Use class default</option>{ABILITIES.map((ability) => <option key={ability}>{ability}</option>)}</select></label>
              <p className="setup-note">Class saving throw proficiencies and spell ability are applied automatically. For features that grant extras, use the save checkboxes or spell ability override. Choose Custom AC for an alternate class AC formula. Enter species speed and any armor Strength requirement here.</p>
            </div>
          </details>
        </aside>
      </div>
    </section>
  );
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function numberOr(raw: string, current: number, min: number, max: number): number {
  if (raw === "") return current;
  const number = Number(raw);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : current;
}
