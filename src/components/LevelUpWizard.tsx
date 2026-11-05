import { subclassSpellNames } from "../data/subclassSpells";
import { useContext } from "react";
import { AdvancementContext } from "../data/advancementTransport";
import { useEffect, useRef, useState } from "react";
import { ABILITIES, CLASSES, makeCharacterId, type Character } from "../data/characters";
import { applyLevelUp, eligibleFeats, hasFeatChoice, levelChoices, levelUpErrors, newLevelUpPlan, previewLevel, spellLimits } from "../data/advancement";
import { CLASS_CATALOG, SPELL_CATALOG, classLevel, gainedRuleFeatures, subclassOf } from "../data/rulesCatalog";
import { calculateCharacterStats } from "../data/calculations";
import { rollDie } from "../data/gameplay";

const steps = ["Your next level", "Features & choices", "Spells", "Review"];
const fingerprint = (character: Character) => JSON.stringify([character.classLevels, character.level, character.abilityScores, character.spells, character.features, character.rulesChoices]);

export function LevelUpWizard({ character, onApply, onClose }: { character: Character; onApply: (updates: Partial<Character>) => void; onClose: () => void }) {
  const transport = useContext(AdvancementContext);
  const requestId = useRef(makeCharacterId());
  const committing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [base] = useState(character);
  const [plan, setPlan] = useState(() => newLevelUpPlan(base));
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [spellLevel, setSpellLevel] = useState("all");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const next = previewLevel(base, plan), currentStats = calculateCharacterStats(base);
  const nextStats = calculateCharacterStats(next), nextClassLevel = classLevel(next, plan.className);
  const autoSpells = subclassSpellNames(plan.subclass, nextClassLevel);
  const limits = spellLimits(base, plan), choices = levelChoices(base, plan), featChoice = hasFeatChoice(base, plan);
  const subclasses = CLASS_CATALOG.filter((entry) => entry.subclass_of?.name === plan.className);
  const features = gainedRuleFeatures(plan.className, nextClassLevel, plan.subclass);
  const errors = levelUpErrors(base, plan);
  const selectedSpells = SPELL_CATALOG.filter((spell) => plan.spellKeys.includes(spell.key));
  const preview = errors.length ? null : { ...base, ...applyLevelUp(base, plan, "preview", "preview") };
  const finalStats = preview ? calculateCharacterStats(preview) : nextStats;

  useEffect(() => {
    const first = dialog.current?.querySelector<HTMLButtonElement>("button"); first?.focus();
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = oldOverflow; };
  }, []);

  useEffect(() => { dialog.current?.querySelector(".level-up-options")?.scrollTo(0, 0); }, [step]);

  async function confirm() {
    if (committing.current) return;
    committing.current = true; setBusy(true);
    try {
      if (fingerprint(character) !== fingerprint(base)) throw new Error("This sheet changed while leveling up. Close and reopen Level up to review the current version.");
      if (transport) await transport(character.id, plan, requestId.current);
      else onApply(applyLevelUp(character, plan, requestId.current, new Date().toISOString()));
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not apply this level."); }
    finally { committing.current = false; setBusy(false); }
  }
  function selectChoice(key: string, value: string, count: number) {
    const selected = plan.choices[key] ?? [];
    const result = selected.includes(value) ? selected.filter((option) => option !== value) : count === 1 ? [value] : [...selected, value];
    if (result.length <= count) setPlan({ ...plan, choices: { ...plan.choices, [key]: result } });
  }
  return <div className="level-up-overlay"><div className="level-up-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="level-up-title" onKeyDown={(event) => {
    if (event.key === "Escape") onClose();
    if (event.key === "Tab") {
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <header className="level-up-heading"><div><p className="eyebrow">A NEW CHAPTER</p><h2 id="level-up-title">Level {currentStats.totalLevel + 1} awaits</h2><p>{base.name} · {plan.className} {nextClassLevel}</p></div><button type="button" className="backup-button" onClick={onClose} aria-label="Cancel level up">Close ×</button></header>
    <nav className="level-up-steps" aria-label="Level-up steps">{steps.map((title, index) => <button type="button" key={title} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}><span>{index + 1}</span>{title}</button>)}</nav>
    <div className="level-up-body"><section className="level-up-options">
      {step === 0 && <><h3>Choose your path</h3><p>Gain one class level. You can continue your class or multiclass if you meet the ability requirements.</p><div className="level-up-card-grid">{CLASSES.map((name) => <button type="button" className={`level-choice-card ${plan.className === name ? "selected" : ""}`} key={name} aria-pressed={plan.className === name} onClick={() => setPlan({ ...newLevelUpPlan(base), className: name, subclass: subclassOf(base, name) })}><strong>{name}</strong><span>{classLevel(base, name) ? `${classLevel(base, name)} → ${classLevel(base, name) + 1}` : "Begin at level 1"}</span></button>)}</div>
        <h3>Hit points</h3><p>Use the fixed class average or roll the new Hit Die. Constitution increases apply to every character level.</p><div className="play-controls"><button type="button" className="backup-button" onClick={() => setPlan({ ...plan, hpRoll: null })}>Use class average</button><button type="button" className="backup-button" onClick={() => setPlan({ ...plan, hpRoll: rollDie(Number(CLASS_CATALOG.find((entry) => entry.name === plan.className)?.hit_dice?.slice(1) ?? 8)) })}>Roll Hit Die</button><span>{plan.hpRoll === null ? "Fixed average selected" : `Rolled ${plan.hpRoll}`}</span></div></>}
      {step === 1 && <><h3>New features</h3>{features.map((feature) => <details className="level-feature" key={`${feature.source}-${feature.name}`}><summary>{feature.name}<small>{feature.source}</small></summary><p>{feature.description}</p></details>)}{!features.length && <p>Your class resources and spell slots improve automatically at this level.</p>}
        {nextClassLevel >= 3 && !subclassOf(base, plan.className) && <section className="level-choice-section"><h3>Choose your subclass</h3><p>Included subclasses come from the 2024 SRD. Their feature descriptions unlock at each class level.</p>{subclasses.map((subclass) => <button type="button" className={`level-choice-card ${plan.subclass === subclass.name ? "selected" : ""}`} key={subclass.key} aria-pressed={plan.subclass === subclass.name} onClick={() => setPlan({ ...plan, subclass: subclass.name, choices: {}, spellKeys: [] })}><strong>{subclass.name}</strong><span>{subclass.desc.split("\n")[0].replaceAll("*", "")}</span></button>)}</section>}
        {featChoice && <section className="level-choice-section"><h3>Feat or ability improvement</h3><label>Choose a feat<select value={plan.feat} onChange={(event) => setPlan({ ...plan, feat: event.target.value, boosts: {}, choices: {} })}>{eligibleFeats(base, plan).map((feat) => <option key={feat.key}>{feat.name}</option>)}</select></label><p className="level-feature-description">{eligibleFeats(base, plan).find((feat) => feat.name === plan.feat)?.description}</p><div className="level-ability-grid">{ABILITIES.map((ability) => <label key={ability}>{ability}<span>{base.abilityScores[ability]} → {base.abilityScores[ability] + (plan.boosts[ability] ?? 0)}</span><select aria-label={`${ability} level-up boost`} value={plan.boosts[ability] ?? 0} onChange={(event) => setPlan({ ...plan, boosts: { ...plan.boosts, [ability]: Number(event.target.value) } })}><option value={0}>No increase</option><option value={1}>+1</option>{plan.feat === "Ability Score Improvement" && <option value={2}>+2</option>}</select></label>)}</div></section>}
        {choices.map((choice) => <section className="level-choice-section" key={choice.key}><h3>{choice.title} <small>{plan.choices[choice.key]?.length ?? 0} / {choice.count}</small></h3><p>{choice.description}</p><div className="level-up-card-grid">{choice.options.map((option) => <button type="button" className={`level-choice-card ${plan.choices[choice.key]?.includes(option) ? "selected" : ""}`} aria-pressed={plan.choices[choice.key]?.includes(option) ?? false} key={option} onClick={() => selectChoice(choice.key, option, choice.count)}>{option}</button>)}</div></section>)}</>}
      {step === 2 && <><h3>Build your spellbook</h3><p>{limits.cantrips} new cantrip{limits.cantrips === 1 ? "" : "s"}; {limits.requiredSpells === limits.spells ? limits.spells : `${limits.requiredSpells}–${limits.spells}`} new leveled spells. {limits.preparedCaster ? "Your class can change prepared spells after a Long Rest; adding spells here is optional." : "Choose the new spells gained at this class level."}</p><p>339 SRD spells are included offline. Descriptions remain available even when an effect requires manual resolution.</p>
        <div className="play-controls"><label>Search spells<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, school, or spell text" /></label><label>Spell level<select value={spellLevel} onChange={(event) => setSpellLevel(event.target.value)}><option value="all">All available</option>{Array.from({ length: limits.maxLevel + 1 }, (_, level) => <option key={level} value={level}>{level === 0 ? "Cantrips" : `Level ${level}`}</option>)}</select></label></div>
        <p>Automatically prepared subclass spells: {autoSpells.join(", ") || "None at this level"}.{limits.evocationBonus > 0 ? ` Include ${limits.evocationBonus} Evocation spells for Evocation Savant.` : ""}</p><div className="level-spell-list">{SPELL_CATALOG.filter((spell) => spell.classes.includes(plan.className) && spell.level <= limits.maxLevel && (spell.level > 0 || limits.cantrips > 0) && (spellLevel === "all" || spell.level === Number(spellLevel)) && `${spell.name} ${spell.school} ${spell.description}`.toLowerCase().includes(search.toLowerCase()) && !autoSpells.includes(spell.name) && !base.spells.some((known) => (known.catalogKey === spell.key || known.name === spell.name) && (known.className ?? base.characterClass) === plan.className)).map((spell) => <article key={spell.key} className={`level-spell-card ${plan.spellKeys.includes(spell.key) ? "selected" : ""}`}><label><input type="checkbox" checked={plan.spellKeys.includes(spell.key)} onChange={(event) => setPlan({ ...plan, spellKeys: event.target.checked ? [...plan.spellKeys, spell.key] : plan.spellKeys.filter((key) => key !== spell.key) })} /><strong>{spell.name}</strong><small>{spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · {spell.school} · {spell.castingTime}{spell.concentration ? " · Concentration" : ""}</small></label><details><summary>Spell details</summary><p>{spell.range} · {spell.components}</p><p>{spell.description}</p></details></article>)}</div></>}
      {step === 3 && <><h3>Ready to grow</h3><p>Confirming applies the full level-up once. It preserves spent resources and damage taken; it does not count as a rest.</p><div className="level-review-grid"><p><strong>{plan.className} {nextClassLevel}</strong><span>{plan.subclass || "Subclass unlocks at class level 3"}</span></p><p><strong>Maximum HP {currentStats.maxHitPoints} → {finalStats.maxHitPoints}</strong><span>{plan.hpRoll === null ? "Fixed average" : `Hit Die roll: ${plan.hpRoll}`}</span></p><p><strong>Proficiency +{currentStats.proficiencyBonus} → +{finalStats.proficiencyBonus}</strong><span>Spell slots and feature resources recalculate</span></p></div>
        {featChoice && <p>Feat: <strong>{plan.feat}</strong>. {Object.entries(plan.boosts).filter(([, amount]) => amount).map(([ability, amount]) => `${ability} +${amount}`).join(", ")}</p>}
        <h4>New spells</h4><p>{selectedSpells.map((spell) => spell.name).join(", ") || "No new spells selected"}</p><h4>New features</h4><p>{features.map((feature) => feature.name).join(", ") || "Class progression"}</p>
        {errors.length > 0 && <div className="level-validation" role="status"><strong>Finish these choices</strong><ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul></div>}</>}
      {error && <p role="alert" className="lan-error">{error}</p>}
    </section><aside className="level-up-summary"><p className="eyebrow">YOUR NEXT LEVEL</p><h3>{base.name}</h3><strong className="level-summary-number">{currentStats.totalLevel} <span>→</span> {next.level}</strong><p>{plan.className} {nextClassLevel}</p><p>{plan.subclass || "Choose your path"}</p><hr /><p>{selectedSpells.filter((spell) => spell.level === 0).length} / {limits.cantrips} cantrips</p><p>{selectedSpells.filter((spell) => spell.level > 0).length} / {limits.spells} spells</p><p>{choices.filter((choice) => (plan.choices[choice.key]?.length ?? 0) === choice.count).length} / {choices.length} feature choices</p><p className="setup-note">{errors.length ? `${errors.length} choice${errors.length === 1 ? "" : "s"} to resolve before confirming.` : "All choices complete."}</p></aside></div>
    <footer className="level-up-footer"><button type="button" className="backup-button" onClick={() => step ? setStep(step - 1) : onClose()}>{step ? "← Back" : "Cancel"}</button><span>Step {step + 1} of {steps.length}</span>{step < 3 ? <button type="button" className="primary-button" onClick={() => setStep(step + 1)}>Continue →</button> : <button type="button" className="primary-button" disabled={errors.length > 0 || busy} onClick={() => void confirm()}>Confirm level {next.level} ✦</button>}</footer>
  </div></div>;
}
