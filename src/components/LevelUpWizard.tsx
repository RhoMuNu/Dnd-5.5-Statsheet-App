import { pruneChoices } from "../data/buildChoices";
import { BuildChoicePicker } from "./BuildChoicePicker";
import { ProgressionSwaps } from "./ProgressionSwaps";
import { DiceModeControl, useDiceRoll } from "./DiceProvider";
import { subclassSpellNames } from "../data/subclassSpells";
import { useContext } from "react";
import { AdvancementContext } from "../data/advancementTransport";
import { useEffect, useRef, useState } from "react";
import { ABILITIES, CLASSES, makeCharacterId, type Character } from "../data/characters";
import { availableSpellClasses, applyLevelUp, eligibleFeats, hasFeatChoice, levelChoices, levelUpErrors, newLevelUpPlan, previewLevel, spellLimits } from "../data/advancement";
import { CLASS_CATALOG, SPELL_CATALOG, classLevel, gainedRuleFeatures, subclassOf } from "../data/rulesCatalog";
import { calculateCharacterStats } from "../data/calculations";

const steps = ["Your next level", "Features & choices", "Spells", "Review"];
const fingerprint = (character: Character) => JSON.stringify([character.customSubclasses, character.classLevels, character.level, character.abilityScores, character.spells, character.features, character.rulesChoices, character.customModifiers]);

export function LevelUpWizard({ character, onApply, onClose }: { character: Character; onApply: (updates: Partial<Character>) => void; onClose: () => void }) {
  const diceSource = useDiceRoll(character.updatedAt);
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
  const autoSpells = subclassSpellNames(plan.customSubclass ? "" : plan.subclass, nextClassLevel);
  const limits = spellLimits(base, plan), choices = levelChoices(base, plan), featChoice = hasFeatChoice(base, plan);
  const choiceDefinitions = JSON.stringify(choices);
  useEffect(() => { const cleaned = pruneChoices(plan.choices, choices); if (JSON.stringify(cleaned) !== JSON.stringify(plan.choices)) setPlan(current => ({ ...current, choices: cleaned })); }, [choiceDefinitions]);
  const subclasses = CLASS_CATALOG.filter((entry) => entry.subclass_of?.name === plan.className);
  const features = gainedRuleFeatures(plan.className, nextClassLevel, plan.customSubclass ? "" : plan.subclass);
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

  async function rollLevelHp() {
    try {
      const className = plan.className, sides = Number(CLASS_CATALOG.find((entry) => entry.name === className)?.hit_dice?.slice(1) ?? 8);
      const rolled = await diceSource.run(className + " level-up Hit Die", (die) => die(sides, base.name + ": " + className + " level-up HP"));
      if (rolled) setPlan((current) => current.className === className ? { ...current, hpRoll: rolled.result } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not enter HP roll."); }
  }
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
  return <div className="level-up-overlay"><div className="level-up-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="level-up-title" onKeyDown={(event) => {
    if (event.key === "Escape") onClose();
    if (event.key === "Tab") {
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <header className="level-up-heading"><div><p className="eyebrow">A NEW CHAPTER</p><h2 id="level-up-title">Level {currentStats.totalLevel + 1} awaits</h2><p>{base.name} · {plan.className} {nextClassLevel}</p></div><DiceModeControl /><button type="button" className="backup-button" onClick={onClose} aria-label="Cancel level up">Close ×</button></header>
    <nav className="level-up-steps" aria-label="Level-up steps">{steps.map((title, index) => <button type="button" key={title} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}><span>{index + 1}</span>{title}</button>)}</nav>
    <div className="level-up-body"><section className="level-up-options">
      {step === 0 && <><h3>Choose your path</h3><p>Gain one class level. You can continue your class or multiclass if you meet the ability requirements.</p><div className="level-up-card-grid">{CLASSES.map((name) => <button type="button" className={`level-choice-card ${plan.className === name ? "selected" : ""}`} key={name} aria-pressed={plan.className === name} onClick={() => setPlan(newLevelUpPlan(base, name))}><strong>{name}</strong><span>{classLevel(base, name) ? `${classLevel(base, name)} → ${classLevel(base, name) + 1}` : "Begin at level 1"}</span></button>)}</div>
        <h3>Hit points</h3><p>Use the fixed class average or roll the new Hit Die. Constitution increases apply to every character level.</p><div className="play-controls"><button type="button" className="backup-button" onClick={() => setPlan({ ...plan, hpRoll: null })}>Use class average</button>{diceSource.classic ? <label>Hit Die result (manual)<input type="number" min={1} max={Number(CLASS_CATALOG.find((entry) => entry.name === plan.className)?.hit_dice?.slice(1) ?? 8)} value={plan.hpRoll ?? ""} placeholder="Leave blank for average" onChange={(event) => setPlan({ ...plan, hpRoll: event.target.value.trim() ? Number(event.target.value) : null })} /></label> : <button type="button" className="backup-button" onClick={() => void rollLevelHp()}>Roll Hit Die</button>}<span>{plan.hpRoll === null ? "Fixed average selected" : `Rolled ${plan.hpRoll}`}</span></div></>}
      {step === 1 && <><h3>New features</h3>{features.map((feature) => <details className="level-feature" key={`${feature.source}-${feature.name}`}><summary>{feature.name}<small>{feature.source}</small></summary><p>{feature.description}</p></details>)}{!features.length && <p>Your class resources and spell slots improve automatically at this level.</p>}
        {nextClassLevel >= 3 && !subclassOf(base, plan.className) && <section className="level-choice-section"><h3>Choose your subclass</h3><p>Included subclasses come from the 2024 SRD. Their feature descriptions unlock at each class level.</p>{subclasses.map((subclass) => <button type="button" className={`level-choice-card ${!plan.customSubclass && plan.subclass === subclass.name ? "selected" : ""}`} key={subclass.key} aria-pressed={!plan.customSubclass && plan.subclass === subclass.name} onClick={() => setPlan({ ...plan, subclass: subclass.name, customSubclass: false, customDescription: "", customFeatures: [], choices: {}, spellKeys: [] })}><strong>{subclass.name}</strong><span>{subclass.desc.split("\n")[0].replaceAll("*", "")}</span></button>)}<button type="button" className={`level-choice-card ${plan.customSubclass ? "selected" : ""}`} aria-pressed={plan.customSubclass === true} onClick={() => setPlan({ ...plan, customSubclass: true, subclass: "", customDescription: "", customFeatures: [], choices: {}, spellKeys: [] })}><strong>Custom subclass</strong><span>Use your own subclass, with its rules and level features recorded on the sheet.</span></button></section>}
        {plan.customSubclass && <section className="level-choice-section custom-subclass-editor"><h3>Your custom subclass</h3><label>Subclass name<input maxLength={80} value={plan.subclass} disabled={!!subclassOf(base, plan.className)} onChange={(event) => setPlan({ ...plan, subclass: event.target.value })} /></label><label>Subclass description<textarea rows={3} maxLength={10000} value={plan.customDescription ?? ""} onChange={(event) => setPlan({ ...plan, customDescription: event.target.value })} placeholder="Describe its theme and general rules." /></label><p>Custom features use manual effects. Add features gained at this class level; you can add more during future level-ups or under Your features. Configure stat boosts and feature trackers separately. Add granted spells in Spellbook; custom spellcasting progressions are not inferred from the name.</p><h4>Features gained at {plan.className} {nextClassLevel}</h4>{(plan.customFeatures ?? []).map((feature, index) => <article className="custom-subclass-feature" key={index}><label>Feature {index + 1} name<input maxLength={80} value={feature.name} onChange={(event) => setPlan({ ...plan, customFeatures: plan.customFeatures!.map((entry, number) => number === index ? { ...entry, name: event.target.value } : entry) })} /></label><label>Feature {index + 1} description<textarea rows={3} maxLength={20000} value={feature.description} onChange={(event) => setPlan({ ...plan, customFeatures: plan.customFeatures!.map((entry, number) => number === index ? { ...entry, description: event.target.value } : entry) })} /></label><button type="button" className="text-button" onClick={() => setPlan({ ...plan, customFeatures: plan.customFeatures!.filter((_, number) => number !== index) })}>Remove custom feature {index + 1}</button></article>)}<button type="button" className="backup-button" disabled={(plan.customFeatures?.length ?? 0) >= 20} onClick={() => setPlan({ ...plan, customFeatures: [...(plan.customFeatures ?? []), { name: "", description: "" }] })}>Add custom subclass feature</button></section>}
        {featChoice && <section className="level-choice-section"><h3>Feat or ability improvement</h3><label>Choose a feat<select value={plan.feat} onChange={(event) => setPlan({ ...plan, feat: event.target.value, boosts: {}, choices: {} })}>{eligibleFeats(base, plan).map((feat) => <option key={feat.key}>{feat.name}</option>)}</select></label><p className="level-feature-description">{eligibleFeats(base, plan).find((feat) => feat.name === plan.feat)?.description}</p><div className="level-ability-grid">{ABILITIES.map((ability) => <label key={ability}>{ability}<span>{base.abilityScores[ability]} → {base.abilityScores[ability] + (plan.boosts[ability] ?? 0)}</span><select aria-label={`${ability} level-up boost`} value={plan.boosts[ability] ?? 0} onChange={(event) => setPlan({ ...plan, boosts: { ...plan.boosts, [ability]: Number(event.target.value) } })}><option value={0}>No increase</option><option value={1}>+1</option>{plan.feat === "Ability Score Improvement" && <option value={2}>+2</option>}</select></label>)}</div></section>}
        <BuildChoicePicker choices={choices} values={plan.choices} onChange={choices => setPlan({ ...plan, choices })} /><ProgressionSwaps character={base} plan={plan} onChange={setPlan} section="features" /></>}
      {step === 2 && <><h3>Build your spellbook</h3><p>{limits.cantrips} new cantrip{limits.cantrips === 1 ? "" : "s"}; {limits.requiredSpells === limits.spells ? limits.spells : `${limits.requiredSpells}–${limits.spells}`} new leveled spells. {limits.preparedCaster ? "Your class can change prepared spells after a Long Rest; adding spells here is optional." : "Choose the new spells gained at this class level."}</p><p>339 SRD spells are included offline. Descriptions remain available even when an effect requires manual resolution.</p>
        <ProgressionSwaps character={base} plan={plan} onChange={setPlan} section="spells" /><div className="play-controls"><label>Search spells<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, school, or spell text" /></label><label>Spell level<select value={spellLevel} onChange={(event) => setSpellLevel(event.target.value)}><option value="all">All available</option>{Array.from({ length: limits.maxLevel + 1 }, (_, level) => <option key={level} value={level}>{level === 0 ? "Cantrips" : `Level ${level}`}</option>)}</select></label></div>
        <p>Automatically prepared subclass spells: {autoSpells.join(", ") || "None at this level"}.{limits.evocationBonus > 0 ? ` Include ${limits.evocationBonus} Evocation spells for Evocation Savant.` : ""}</p><div className="level-spell-list">{SPELL_CATALOG.filter((spell) => spell.classes.some(name => availableSpellClasses(base, plan).includes(name)) && spell.level <= limits.maxLevel && (spell.level > 0 || limits.cantrips > 0) && (spellLevel === "all" || spell.level === Number(spellLevel)) && `${spell.name} ${spell.school} ${spell.description}`.toLowerCase().includes(search.toLowerCase()) && !autoSpells.includes(spell.name) && !base.spells.some((known) => (known.catalogKey === spell.key || known.name === spell.name) && (known.className ?? base.characterClass) === plan.className)).map((spell) => <article key={spell.key} className={`level-spell-card ${plan.spellKeys.includes(spell.key) ? "selected" : ""}`}><label><input type="checkbox" checked={plan.spellKeys.includes(spell.key)} onChange={(event) => setPlan({ ...plan, spellKeys: event.target.checked ? [...plan.spellKeys, spell.key] : plan.spellKeys.filter((key) => key !== spell.key) })} /><strong>{spell.name}</strong><small>{spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · {spell.school} · {spell.castingTime}{spell.concentration ? " · Concentration" : ""}</small></label><details><summary>Spell details</summary><p>{spell.range} · {spell.components}</p><p>{spell.description}</p></details></article>)}</div></>}
      {step === 3 && <><h3>Ready to grow</h3><p>Confirming applies the full level-up once. It preserves spent resources and damage taken; it does not count as a rest.</p><div className="level-review-grid"><p><strong>{plan.className} {nextClassLevel}</strong><span>{plan.subclass || "Subclass unlocks at class level 3"}</span></p><p><strong>Maximum HP {currentStats.maxHitPoints} → {finalStats.maxHitPoints}</strong><span>{plan.hpRoll === null ? "Fixed average" : `Hit Die roll: ${plan.hpRoll}`}</span></p><p><strong>Proficiency +{currentStats.proficiencyBonus} → +{finalStats.proficiencyBonus}</strong><span>Spell slots and feature resources recalculate</span></p></div>
        {featChoice && <p>Feat: <strong>{plan.feat}</strong>. {Object.entries(plan.boosts).filter(([, amount]) => amount).map(([ability, amount]) => `${ability} +${amount}`).join(", ")}</p>}
        <h4>Replacements</h4><p>{[...(plan.replacements ?? []).map(change => `${change.from} → ${change.to}`), ...(plan.spellReplacements ?? []).map(change => `${base.spells.find(spell => spell.id === change.fromId)?.name} → ${SPELL_CATALOG.find(spell => spell.key === change.toKey)?.name}`)].join(", ") || "Keep existing choices"}</p><h4>New spells</h4><p>{selectedSpells.map((spell) => spell.name).join(", ") || "No new spells selected"}</p><h4>New features</h4><p>{[...features.map((feature) => feature.name), ...(plan.customFeatures ?? []).map((feature) => feature.name)].join(", ") || "Class progression"}</p>{plan.customSubclass && <p>Custom subclass: {plan.subclass}. Its recorded features use manual effects.</p>}
        {errors.length > 0 && <div className="level-validation" role="status"><strong>Finish these choices</strong><ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul></div>}</>}
      {error && <p role="alert" className="lan-error">{error}</p>}
    </section><aside className="level-up-summary"><p className="eyebrow">YOUR NEXT LEVEL</p><h3>{base.name}</h3><strong className="level-summary-number">{currentStats.totalLevel} <span>→</span> {next.level}</strong><p>{plan.className} {nextClassLevel}</p><p>{plan.subclass || "Choose your path"}</p><hr /><p>{selectedSpells.filter((spell) => spell.level === 0).length} / {limits.cantrips} cantrips</p><p>{selectedSpells.filter((spell) => spell.level > 0).length} / {limits.spells} spells</p><p>{choices.filter((choice) => (plan.choices[choice.key]?.length ?? 0) === choice.count).length} / {choices.length} feature choices</p><p className="setup-note">{errors.length ? `${errors.length} choice${errors.length === 1 ? "" : "s"} to resolve before confirming.` : "All choices complete."}</p></aside></div>
    <footer className="level-up-footer"><button type="button" className="backup-button" onClick={() => step ? setStep(step - 1) : onClose()}>{step ? "← Back" : "Cancel"}</button><span>Step {step + 1} of {steps.length}</span>{step < 3 ? <button type="button" className="primary-button" onClick={() => setStep(step + 1)}>Continue →</button> : <button type="button" className="primary-button" disabled={errors.length > 0 || busy} onClick={() => void confirm()}>Confirm level {next.level} ✦</button>}</footer>
  </div></div>;
}
