import { useDiceRoll } from "./DiceProvider";
import type { DieRoller } from "../data/physicalDice";
import { useMemo, useState, type FormEvent } from "react";
import { ABILITIES, CLASSES, defaultCharacterStats, type AbilityName, type Character, type CharacterCreationDetails, type CharacterDraft, type SkillName } from "../data/characters";
import { BACKGROUNDS, CLASS_ARMOR, CLASS_EQUIPMENT, CLASS_SKILLS, CLASS_TOOLS, LANGUAGES, SPECIES, SPECIES_SKILL_CHOICES, STANDARD_ARRAY, STANDARD_ARRAY_BY_CLASS, pointBuyCost } from "../data/creationOptions";
import { StartingSpellPicker } from "./StartingSpellPicker";
import { createStartingSpells, startingSpellErrors, startingSpellLimits } from "../data/startingSpells";
import { calculateCharacterStats } from "../data/calculations";

type CharacterBuilderProps = { character?: Character; onSave: (draft: CharacterDraft) => void; onCancel: () => void };
type AbilityScores = Record<AbilityName, number>;
const emptyScores = (value = 10): AbilityScores => Object.fromEntries(ABILITIES.map((ability) => [ability, value])) as AbilityScores;
const standardScoresFor = (characterClass: string): AbilityScores => STANDARD_ARRAY_BY_CLASS[characterClass] ?? Object.fromEntries(ABILITIES.map((ability, index) => [ability, STANDARD_ARRAY[index]])) as AbilityScores;
const rollScores = (die: DieRoller): number[] => Array.from({ length: 6 }, (_, score) => {
  const dice = Array.from({ length: 4 }, () => die(6, `Ability score ${score + 1}: 4d6, drop the lowest`)).sort((a, b) => b - a);
  return dice.slice(0, 3).reduce((sum, die) => sum + die, 0);
}).sort((a, b) => b - a);

export function CharacterBuilder({ character, onSave, onCancel }: CharacterBuilderProps) {
  const diceSource = useDiceRoll(character?.updatedAt);
  const saved = character?.creationDetails;
  const [step, setStep] = useState(1);
  const [name, setName] = useState(character?.name ?? "");
  const [concept, setConcept] = useState(character?.concept ?? "");
  const savedSpeciesParts = character?.species?.match(/^([^()]+)(?:\s*\((.*)\))?$/);
  const knownSpecies = savedSpeciesParts?.[1]?.trim() ?? "";
  const [species, setSpecies] = useState(knownSpecies && (knownSpecies in SPECIES || knownSpecies === "Custom") ? knownSpecies : character?.species ? "Custom" : "");
  const [speciesChoice, setSpeciesChoice] = useState(savedSpeciesParts?.[2] ?? (character?.species && !(knownSpecies in SPECIES) ? character.species : ""));
  const [customSize, setCustomSize] = useState<Character["size"]>(character?.size ?? "Medium");
  const [customSpeed, setCustomSpeed] = useState(character?.speedFeet ?? 30);
  const [characterClass, setCharacterClass] = useState(character?.characterClass ?? "");
  const [subclass, setSubclass] = useState(character?.subclass ?? "");
  const [classLevels, setClassLevels] = useState<Record<string, number>>(() => character?.classLevels && Object.keys(character.classLevels).length ? { ...character.classLevels } : character?.characterClass ? { [character.characterClass]: character.level } : {});
  const [classSubclasses, setClassSubclasses] = useState<Record<string, string>>(() => character?.classSubclasses ?? (character?.characterClass && character.subclass ? { [character.characterClass]: character.subclass } : {}));
  const [background, setBackground] = useState(character?.background && !(character.background in BACKGROUNDS) ? "Custom" : character?.background ?? "");
  const [customBackground, setCustomBackground] = useState(character?.background && !(character.background in BACKGROUNDS) ? character.background : "");
  const [level, setLevel] = useState(String(character?.level ?? 1));
  const [abilityMethod, setAbilityMethod] = useState<CharacterCreationDetails["abilityMethod"]>(saved?.abilityMethod ?? "standard");
  const [baseScores, setBaseScores] = useState<AbilityScores>(() => saved?.baseAbilityScores ?? character?.abilityScores ?? { ...emptyScores(), Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 12, Wisdom: 10, Charisma: 8 });
  const [scoreDistributionTouched, setScoreDistributionTouched] = useState(Boolean(character || saved));
  const [abilityScoreOverrides, setAbilityScoreOverrides] = useState(character?.abilityScoreOverrides ?? {});
  const [rolledScores, setRolledScores] = useState<number[]>(() => Object.values(saved?.baseAbilityScores ?? character?.abilityScores ?? standardScoresFor(characterClass)).sort((a, b) => b - a));
  const [boosts, setBoosts] = useState<Partial<Record<AbilityName, 0 | 1 | 2>>>(saved?.backgroundAbilityBoosts ?? {});
  const [classSkills, setClassSkills] = useState<SkillName[]>(saved?.classSkills ?? []);
  const [languages, setLanguages] = useState<string[]>(saved?.languages?.length ? saved.languages : ["Common"]);
  const [toolProficiency, setToolProficiency] = useState(saved?.toolProficiency ?? "");
  const [speciesSkillProficiency, setSpeciesSkillProficiency] = useState<SkillName | "">(saved?.speciesSkillProficiency ?? "");
  const [classToolProficiency, setClassToolProficiency] = useState(saved?.classToolProficiency ?? "");
  const [equipmentChoice, setEquipmentChoice] = useState<CharacterCreationDetails["equipmentChoice"]>(saved?.equipmentChoice ?? "A");
  const [classEquipment, setClassEquipment] = useState(saved?.classEquipment ?? "");
  const [classEquipmentOption, setClassEquipmentOption] = useState<CharacterCreationDetails["classEquipmentOption"]>(saved?.classEquipmentOption ?? "A");
  const [gearChanged, setGearChanged] = useState(false);
  const [classChoices, setClassChoices] = useState(saved?.classChoices ?? "");
  const [appearance, setAppearance] = useState(saved?.appearance ?? "");
  const [startingSelections, setStartingSelections] = useState<Record<string, string[]>>({});
  const [chooseSpellsLater, setChooseSpellsLater] = useState(false);
  const [error, setError] = useState("");

  const backgroundData = BACKGROUNDS[background];
  const speciesData = SPECIES[species];
  const speciesSkillOptions = SPECIES_SKILL_CHOICES[species] ?? [];
  const classSkillData = CLASS_SKILLS[characterClass];
  const classEquipmentOptions = CLASS_EQUIPMENT[characterClass] ?? [];
  const classEquipmentSummary = classEquipmentOption === "custom" ? classEquipment : classEquipmentOptions.find((option) => option.startsWith(`${classEquipmentOption}:`)) ?? classEquipmentOptions[0] ?? "Choose or enter starting equipment";
  const selectedClassArmor = CLASS_ARMOR[characterClass]?.[classEquipmentOption];
  const gearSelectionChanged = !character || gearChanged;
  const scoreTotal = Object.values(baseScores).reduce((sum, value) => sum + pointBuyCost(value), 0);
  const abilityScores = useMemo(() => Object.fromEntries(ABILITIES.map((ability) => [ability, abilityScoreOverrides[ability] ?? Math.min(20, baseScores[ability] + (boosts[ability] ?? 0))])) as AbilityScores, [baseScores, boosts, abilityScoreOverrides]);
  const previewCharacter = useMemo(() => ({
    ...(character ?? defaultCharacterStats()), name, concept, species, characterClass, subclass, classLevels,
    classSubclasses, background, level: Object.values(classLevels).reduce((sum, value) => sum + value, 0) || Number(level) || 1,
    abilityScores, skillProficiencies: { ...defaultCharacterStats().skillProficiencies, ...(character?.skillProficiencies ?? {}), ...Object.fromEntries([...(backgroundData?.skills ?? []), ...classSkills, ...(speciesSkillProficiency ? [speciesSkillProficiency] : [])].map((skill) => [skill, 1])) },
    size: customSize, speedFeet: customSpeed,
    armorMode: gearSelectionChanged && selectedClassArmor ? selectedClassArmor.mode : character?.armorMode ?? "unarmored",
    armorBaseAC: gearSelectionChanged && selectedClassArmor ? selectedClassArmor.baseAC : character?.armorBaseAC ?? 10,
    armorStrengthRequirement: gearSelectionChanged && selectedClassArmor ? selectedClassArmor.strengthRequirement ?? 0 : character?.armorStrengthRequirement ?? 0,
    hasShield: gearSelectionChanged && selectedClassArmor ? selectedClassArmor.shield : character?.hasShield ?? false,
  }) as Character, [character, name, concept, species, speciesSkillProficiency, characterClass, subclass, classLevels, classSubclasses, background, level, abilityScores, backgroundData, classSkills, speciesData, customSize, customSpeed, gearSelectionChanged, selectedClassArmor]);
  const calculated = calculateCharacterStats(previewCharacter);
  const casterClasses = Object.keys(classLevels).filter((name) => { const limits = startingSpellLimits(previewCharacter, name); return limits.cantrips > 0 || limits.spells > 0; });
  const hasSpellStep = !character && casterClasses.length > 0;
  const reviewStep = hasSpellStep ? 4 : 3;
  const spellSelections = Object.fromEntries(casterClasses.map((name) => [name, startingSelections[name] ?? []]));
  const stepLabels = hasSpellStep ? ["CHARACTER", "ORIGIN & ABILITIES", "STARTING SPELLS", "REVIEW"] : ["CHARACTER", "ORIGIN & ABILITIES", "REVIEW"];
  const stepTitles = hasSpellStep ? ["Character details", "Origin & abilities", "Starting spells", "Review character"] : ["Character details", "Origin & abilities", "Review character"];
  const stepDescriptions = hasSpellStep ? ["Choose your class, background, and species.", "Set ability scores and proficiencies.", "Choose spells to add to your Spellbook.", "Check your character before saving."] : ["Choose your class, background, and species.", "Set ability scores and proficiencies.", "Check your character before saving."];

  async function rollAbilities() {
    try {
      const rolled = await diceSource.run("Ability scores · 4d6 drop lowest", rollScores);
      if (!rolled) return;
      setAbilityMethod("rolled"); setAbilityScoreOverrides({}); setScoreDistributionTouched(true);
      setRolledScores(rolled.result); setBaseScores(Object.fromEntries(ABILITIES.map((ability, index) => [ability, rolled.result[index]])) as AbilityScores);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not enter ability dice."); }
  }
  function setBaseScore(ability: AbilityName, value: number) {
    setBaseScores((current) => ({ ...current, [ability]: value }));
    setScoreDistributionTouched(true);
    setAbilityScoreOverrides((current) => { const next = { ...current }; delete next[ability]; return next; });
  }

  function validateStep(): boolean {
    if (step === 1) {
      if (!name.trim()) { setError("Give your character a name to continue."); return false; }
      if (!characterClass || !background || !species) { setError("Choose a class, background, and species to continue."); return false; }
      if (species === "Custom" && !speciesChoice.trim()) { setError("Enter your custom species name."); return false; }
      if (speciesSkillOptions.length && !speciesSkillProficiency) { setError(`Choose the ${species === "Elf" ? "Keen Senses" : "Skillful"} skill proficiency.`); return false; }
      if (background === "Custom" && !customBackground.trim()) { setError("Enter your custom background name."); return false; }
      const normalized = Object.entries(classLevels).filter(([key, value]) => key.trim() && value > 0);
      const total = normalized.reduce((sum, [, value]) => sum + value, 0) || Number(level);
      if (!Number.isInteger(total) || total < 1 || total > 20 || normalized.some(([, value]) => !Number.isInteger(value) || value < 1 || value > 20)) { setError("Combined class levels must total 1–20, and each class level must be 1–20."); return false; }
      if (Object.entries(classSubclasses).some(([className, subclassName]) => subclassName.trim() && (classLevels[className] ?? (className === characterClass ? Number(level) : 0)) < 3)) { setError("A subclass can only be added once that class reaches level 3."); return false; }
    }
    if (step === 2) {
      if (abilityMethod === "point-buy" && scoreTotal !== 27) { setError(`Point Buy uses exactly 27 points. You have spent ${scoreTotal}.`); return false; }
      if (backgroundData) {
        const chosen = ABILITIES.filter((ability) => (boosts[ability] ?? 0) > 0);
        const values = chosen.map((ability) => boosts[ability] ?? 0);
        const valid = chosen.every((ability) => backgroundData.abilities.includes(ability))
          && ((chosen.length === 2 && values.includes(2) && values.includes(1)) || (chosen.length === 3 && values.every((value) => value === 1)));
        if (!valid) { setError("Choose +2 to one eligible ability and +1 to a different one, or +1 to all three eligible abilities."); return false; }
      }
      if (classSkillData && classSkills.length !== classSkillData.count) { setError(`Choose ${classSkillData.count} class skills.`); return false; }
      if (languages.length !== 3 || languages[0] !== "Common" || new Set(languages).size !== 3) { setError("Keep Common as your first language and choose two different additional languages."); return false; }
    }
    if (hasSpellStep && (step === 3 || step === reviewStep) && !chooseSpellsLater) {
      const errors = startingSpellErrors(previewCharacter, spellSelections);
      if (errors.length) { setError(errors.join(" ")); return false; }
    }
    setError(""); return true;
  }

  function moveNext() { if (validateStep()) setStep((current) => Math.min(reviewStep, current + 1)); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < reviewStep) { moveNext(); return; }
    if (!validateStep()) { if (hasSpellStep) setStep(3); return; }
    const normalizedLevels = Object.fromEntries(Object.entries(classLevels).filter(([key, value]) => key.trim() && value > 0));
    if (characterClass && !normalizedLevels[characterClass]) normalizedLevels[characterClass] = Number(level) || 1;
    const totalLevel = Object.values(normalizedLevels).reduce((sum, value) => sum + value, 0) || Number(level);
    const skillProficiencies = { ...defaultCharacterStats().skillProficiencies, ...(character?.skillProficiencies ?? {}) };
    const previouslyGranted = [...(saved?.classSkills ?? []), ...(BACKGROUNDS[character?.background ?? ""]?.skills ?? []), ...(saved?.speciesSkillProficiency ? [saved.speciesSkillProficiency] : [])];
    for (const skill of previouslyGranted) if (skillProficiencies[skill] === 1) skillProficiencies[skill] = 0;
    for (const skill of [...(backgroundData?.skills ?? []), ...classSkills, ...(speciesSkillProficiency ? [speciesSkillProficiency] : [])]) skillProficiencies[skill] = Math.max(1, skillProficiencies[skill]) as 1 | 2;
    const selectedClassEquipment = classEquipmentOption === "custom" ? classEquipment.trim() : classEquipmentOptions.find((option) => option.startsWith(`${classEquipmentOption}:`)) ?? classEquipmentOptions[0] ?? classEquipment.trim();
    const characterCreation: CharacterCreationDetails = { abilityMethod, baseAbilityScores: baseScores, backgroundAbilityBoosts: boosts, classSkills, languages, toolProficiency, classToolProficiency: classToolProficiency.trim(), equipmentChoice, classEquipment: selectedClassEquipment, classEquipmentOption, classChoices: classChoices.trim(), appearance: appearance.trim(), ...(speciesSkillProficiency ? { speciesSkillProficiency } : {}) };
    onSave({
      ...defaultCharacterStats(),
      ...(character ? {
        abilityScores: character.abilityScores, savingThrowProficiencies: character.savingThrowProficiencies, skillProficiencies: character.skillProficiencies,
        advancement: character.advancement, rulesChoices: character.rulesChoices, hitPointAdjustment: character.hitPointAdjustment,
        attacks: character.attacks, combat: character.combat, resourceUses: character.resourceUses, customResources: character.customResources, currentHitPoints: character.currentHitPoints,
        temporaryHitPoints: character.temporaryHitPoints, size: character.size, speedFeet: character.speedFeet,
        otherSpeedBonus: character.otherSpeedBonus, powerfulBuild: character.powerfulBuild, armorMode: character.armorMode,
        armorSource: character.armorSource, inventoryArmorTrained: character.inventoryArmorTrained, inventoryShieldTrained: character.inventoryShieldTrained,
        armorBaseAC: character.armorBaseAC, hasShield: character.hasShield, otherAcBonus: character.otherAcBonus,
        armorStrengthRequirement: character.armorStrengthRequirement, unarmoredDefenseChoice: character.unarmoredDefenseChoice,
        spellcastingAbility: character.spellcastingAbility,
        features: character.features ?? [], inventory: character.inventory ?? defaultCharacterStats().inventory,
        spells: character.spells ?? [], notes: character.notes ?? { backstory: "", entries: [] },
      } : {}),
      name: name.trim(), concept: concept.trim(), species: species === "Custom" ? speciesChoice.trim() : speciesChoice ? `${species} (${speciesChoice})` : species,
      characterClass, subclass: subclass.trim(), classLevels: normalizedLevels,
      classSubclasses: { ...classSubclasses, ...(characterClass ? { [characterClass]: subclass.trim() } : {}) },
      background: background === "Custom" ? customBackground.trim() : background, level: totalLevel, abilityScores, skillProficiencies,
      size: customSize, speedFeet: customSpeed,
      abilityScoreOverrides,
      armorMode: gearSelectionChanged && selectedClassArmor ? selectedClassArmor.mode : character?.armorMode ?? "unarmored",
      armorBaseAC: gearSelectionChanged && selectedClassArmor ? selectedClassArmor.baseAC : character?.armorBaseAC ?? 10,
      armorStrengthRequirement: gearSelectionChanged && selectedClassArmor ? selectedClassArmor.strengthRequirement ?? 0 : character?.armorStrengthRequirement ?? 0,
      hasShield: gearSelectionChanged && selectedClassArmor ? selectedClassArmor.shield : character?.hasShield ?? false,
      ...(!character && hasSpellStep && !chooseSpellsLater ? { spells: createStartingSpells(previewCharacter, spellSelections) } : {}),
      creationDetails: characterCreation,
    });
  }

  function changeSpecies(next: string) {
    setSpecies(next); setSpeciesChoice(""); setCustomSize(SPECIES[next]?.size ?? "Medium"); setCustomSpeed(SPECIES[next]?.speed ?? 30); setSpeciesSkillProficiency("");
  }
  function changeClass(next: string) {
    setClassLevels((previous) => { const updated = { ...previous }; delete updated[characterClass]; if (next) updated[next] = Number(level) || 1; return updated; });
    setCharacterClass(next); setSubclass(classSubclasses[next] ?? ""); setClassSkills([]); setClassEquipmentOption("A"); setClassEquipment(""); setGearChanged(true);
    if (next && abilityMethod === "standard" && !scoreDistributionTouched && STANDARD_ARRAY_BY_CLASS[next]) setBaseScores(STANDARD_ARRAY_BY_CLASS[next]);
  }
  function chooseBoost(ability: AbilityName, value: number) {
    setBoosts((previous) => { const next = { ...previous }; if (value === 0) delete next[ability]; else next[ability] = value as 1 | 2; return next; });
    setAbilityScoreOverrides((current) => { const next = { ...current }; delete next[ability]; return next; });
  }

  return <section className="builder-screen" aria-labelledby="builder-title">
    <div className="builder-progress" aria-label="Character creation steps">
      {stepLabels.map((label, index) => <span key={label} className={step === index + 1 ? "progress-current" : step > index + 1 ? "progress-complete" : ""}><i>{step > index + 1 ? "✓" : index + 1}</i>{label}</span>)}
    </div>
    <form className="character-form" onSubmit={submit}>
      <div className="form-heading"><div><p className="eyebrow">{character ? "UPDATE YOUR HERO" : "LET’S MEET YOUR HERO"}</p><h2 id="builder-title">{stepTitles[step - 1]}</h2><p>{stepDescriptions[step - 1]}</p></div><span className="form-spark" aria-hidden="true">✧</span></div>

      {step === 1 && <div className="form-grid">
        <label className="form-field form-field-wide"><span>Character name <b>REQUIRED</b></span><input autoFocus maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Bramble Underbough" /></label>
        <label className="form-field form-field-wide"><span>Character idea <small>OPTIONAL</small></span><input maxLength={100} value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="A cheerful treasure hunter with a mysterious map" /></label>
        <label className="form-field"><span>Species <b>REQUIRED</b></span><select value={species} onChange={(event) => changeSpecies(event.target.value)}><option value="">Choose a species</option>{Object.keys(SPECIES).map((item) => <option key={item}>{item}</option>)}<option value="Custom">Custom / other</option></select></label>
        {species === "Custom" && <label className="form-field"><span>Species name</span><input maxLength={40} value={speciesChoice} onChange={(event) => setSpeciesChoice(event.target.value)} placeholder="Your species" /></label>}
        {species && <><label className="form-field"><span>Size</span><select value={customSize} onChange={(event) => setCustomSize(event.target.value as Character["size"])}>{["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"].map((size) => <option key={size}>{size}</option>)}</select></label><label className="form-field"><span>Walking speed (ft.)</span><input type="number" min={0} max={120} value={customSpeed} onChange={(event) => setCustomSpeed(Number(event.target.value))} /></label></>}
        {speciesSkillOptions.length > 0 && <label className="form-field"><span>{species === "Elf" ? "Keen Senses skill" : "Human Skillful skill"} <b>REQUIRED</b></span><select value={speciesSkillProficiency} onChange={(event) => setSpeciesSkillProficiency(event.target.value as SkillName)}><option value="">Choose a skill</option>{speciesSkillOptions.map((skill) => <option key={skill}>{skill}</option>)}</select></label>}
        {species && species !== "Custom" && ["Elf", "Gnome", "Tiefling", "Dragonborn", "Goliath"].includes(species) && <label className="form-field"><span>{species} lineage / ancestry <small>OPTIONAL</small></span><input maxLength={35} value={speciesChoice} onChange={(event) => setSpeciesChoice(event.target.value)} placeholder={species === "Elf" ? "Drow, High Elf, or Wood Elf" : species === "Tiefling" ? "Abyssal, Chthonic, or Infernal" : species === "Dragonborn" ? "Choose a dragon ancestry" : species === "Goliath" ? "Choose a giant ancestry" : "Forest or Rock"} /></label>}
        <label className="form-field"><span>Class <b>REQUIRED</b></span><select value={characterClass} onChange={(event) => changeClass(event.target.value)}><option value="">Choose a class</option>{CLASSES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="form-field"><span>Background <b>REQUIRED</b></span><select value={background} onChange={(event) => { const next = event.target.value; setBackground(next); setBoosts({}); setAbilityScoreOverrides({}); setToolProficiency(BACKGROUNDS[next]?.tool.startsWith("Choose") ? "" : BACKGROUNDS[next]?.tool ?? ""); setClassSkills((current) => current.filter((skill) => !BACKGROUNDS[next]?.skills.includes(skill))); }}><option value="">Choose a background</option>{Object.keys(BACKGROUNDS).map((item) => <option key={item}>{item}</option>)}<option value="Custom">Custom / other</option></select></label>
        {background === "Custom" && <label className="form-field"><span>Background name</span><input maxLength={50} value={customBackground} onChange={(event) => setCustomBackground(event.target.value)} placeholder="Your background" /></label>}
        <label className="form-field"><span>{characterClass || "Class"} level <small>1–20</small></span><input type="number" min={1} max={20} value={classLevels[characterClass] ?? level} onChange={(event) => { setLevel(event.target.value); if (characterClass) setClassLevels((current) => ({ ...current, [characterClass]: Number(event.target.value) || 1 })); }} /></label>
        <label className="form-field"><span>Subclass <small>LEVEL 3+</small></span><input maxLength={50} value={subclass} onChange={(event) => { setSubclass(event.target.value); if (characterClass) setClassSubclasses((current) => ({ ...current, [characterClass]: event.target.value })); }} placeholder="Choose when your class grants it" /></label>
        {Object.entries(classLevels).filter(([key]) => key !== characterClass).map(([key, value]) => <div className="form-field multiclass-row" key={key}><span>{key} class level</span><div className="multiclass-controls"><input aria-label={`${key} class level`} type="number" min={1} max={20} value={value} onChange={(event) => setClassLevels((current) => ({ ...current, [key]: Number(event.target.value) || 1 }))} /><input aria-label={`${key} subclass`} placeholder="Subclass (optional)" value={classSubclasses[key] ?? ""} onChange={(event) => setClassSubclasses((current) => ({ ...current, [key]: event.target.value }))} /><button type="button" className="text-button" onClick={() => setClassLevels((current) => { const next = { ...current }; delete next[key]; return next; })}>Remove</button></div></div>)}
        <label className="form-field"><span>Multiclass <small>OPTIONAL</small></span><select value="" disabled={!characterClass} onChange={(event) => { const next = event.target.value; if (next) setClassLevels((current) => current[next] ? current : { ...current, [next]: 1 }); }}><option value="">Add a class…</option>{CLASSES.filter((item) => item !== characterClass && !classLevels[item]).map((item) => <option key={item}>{item}</option>)}</select></label>
        <p className="form-hint form-field-wide">For a first character, level 1 keeps the choices simple. Spellcasting classes can choose starting spells before review.</p>
        {speciesData && <p className="form-hint form-field-wide">{speciesData.note} Base size {speciesData.size}; speed {speciesData.speed} ft.</p>}
      </div>}

      {step === 2 && <>
        <div className="creator-section"><h3>Ability scores</h3><p>Choose a method, then place your scores. Your background adds the final boosts.</p><div className="ability-methods">{([["standard", "Standard Array"], ["point-buy", "Point Buy"], ["manual", "Manual"], ["rolled", "Roll 4d6"]] as const).map(([method, label]) => <button type="button" key={method} className={abilityMethod === method ? "method-selected" : ""} onClick={() => { if (method === "rolled") { void rollAbilities(); return; } setAbilityMethod(method); setAbilityScoreOverrides({}); setScoreDistributionTouched(method !== "standard"); if (method === "standard") setBaseScores(standardScoresFor(characterClass)); if (method === "point-buy") setBaseScores(emptyScores(8)); }}>{label}</button>)}</div>
          {abilityMethod === "rolled" && <button className="text-button" type="button" onClick={() => void rollAbilities()}>Roll again: {rolledScores.join(" · ")}</button>}
          {abilityMethod === "point-buy" && <p className={scoreTotal === 27 ? "point-buy-total" : "form-hint"}>Points spent: {scoreTotal} / 27</p>}
          <div className="creator-ability-grid">{ABILITIES.map((ability) => <label className="creator-ability" key={ability}><span>{ability}</span>{abilityMethod === "manual" || abilityMethod === "point-buy" ? <input type="number" min={abilityMethod === "point-buy" ? 8 : 3} max={abilityMethod === "point-buy" ? 15 : 20} value={baseScores[ability]} onChange={(event) => setBaseScore(ability, Number(event.target.value))} /> : <select value={baseScores[ability]} onChange={(event) => setBaseScore(ability, Number(event.target.value))}>{Array.from(new Set(abilityMethod === "standard" ? STANDARD_ARRAY : rolledScores)).filter((score) => { const allScores = abilityMethod === "standard" ? STANDARD_ARRAY : rolledScores; const allowed = allScores.filter((entry) => entry === score).length; const usedElsewhere = ABILITIES.filter((other) => other !== ability && baseScores[other] === score).length; return score === baseScores[ability] || usedElsewhere < allowed; }).map((score) => <option key={score} value={score}>{score}</option>)}</select>}<small>Final {abilityScores[ability]} ({abilityScores[ability] >= 10 ? "+" : ""}{Math.floor((abilityScores[ability] - 10) / 2)})</small></label>)}</div>
        </div>
        <div className="creator-section"><h3>{background || "Background"} benefits</h3>{backgroundData ? <><p>Origin feat: <strong>{backgroundData.feat}</strong> · Skills: {backgroundData.skills.join(", ")} · Tool: {toolProficiency || backgroundData.tool}</p><p>Choose a valid background ability boost pattern.</p><div className="creator-boost-grid">{backgroundData.abilities.map((ability) => <label key={ability}>{ability}<select value={boosts[ability] ?? 0} onChange={(event) => chooseBoost(ability, Number(event.target.value))}><option value={0}>No boost</option><option value={1}>+1</option><option value={2}>+2</option></select></label>)}</div><label className="form-field creator-tool"><span>{backgroundData.tool.startsWith("Choose") ? "Choose your background tool proficiency" : "Background tool proficiency"}</span><input value={toolProficiency} onChange={(event) => setToolProficiency(event.target.value)} placeholder={backgroundData.tool.startsWith("Choose") ? backgroundData.tool : ""} /></label><label className="form-field creator-tool"><span>Starting equipment</span><select value={equipmentChoice} onChange={(event) => setEquipmentChoice(event.target.value as CharacterCreationDetails["equipmentChoice"])}><option value="A">A: {backgroundData.equipmentA}</option><option value="B">B: {backgroundData.equipmentB}</option></select></label></> : <p>Select a supported 2024 background to get its feat, skills, tool, equipment, and ability boost choices.</p>}</div>
        <div className="creator-section"><h3>Class skills</h3><p>{classSkillData ? `Choose ${classSkillData.count}. Background skills are already included.` : "Choose a class to see its skill choices."}</p>{classSkillData && <div className="creator-skill-grid">{classSkillData.options.filter((skill) => !backgroundData?.skills.includes(skill)).map((skill) => <label key={skill}><input type="checkbox" checked={classSkills.includes(skill)} onChange={(event) => setClassSkills((current) => event.target.checked ? [...current, skill] : current.filter((item) => item !== skill))} disabled={!classSkills.includes(skill) && classSkills.length >= classSkillData.count} />{skill}</label>)}</div>}</div>
        <div className="creator-section"><h3>Languages, equipment &amp; story</h3><p>Common plus two languages for your character.</p><div className="creator-language-grid">{[0, 1, 2].map((index) => <label className="form-field" key={index}><span>{index === 0 ? "Language 1" : `Additional language ${index}`}</span><select value={languages[index] ?? ""} onChange={(event) => setLanguages((current) => { const next = [...current]; next[index] = event.target.value; return next; })}>{(index === 0 ? LANGUAGES : LANGUAGES.filter((item) => item !== "Common")).map((language) => <option key={language}>{language}</option>)}</select></label>)}</div><label className="form-field creator-tool"><span>{characterClass} class equipment</span><select value={classEquipmentOption} onChange={(event) => { setClassEquipmentOption(event.target.value as CharacterCreationDetails["classEquipmentOption"]); setGearChanged(true); }}>{(CLASS_EQUIPMENT[characterClass] ?? []).map((option) => { const choice = option.slice(0, 1); return <option key={option} value={choice}>{option}</option>; })}<option value="custom">Custom equipment</option></select></label>{classEquipmentOption === "custom" && <label className="form-field creator-tool"><span>Equipment / gold</span><input maxLength={240} value={classEquipment} onChange={(event) => setClassEquipment(event.target.value)} placeholder="Record the gear or gold you chose" /></label>}{CLASS_TOOLS[characterClass] && <label className="form-field creator-tool"><span>{characterClass} tool proficiency · {CLASS_TOOLS[characterClass]}</span><input maxLength={100} value={classToolProficiency} onChange={(event) => setClassToolProficiency(event.target.value)} placeholder="Record your choice" /></label>}<label className="form-field creator-tool"><span>Class choices <small>OPTIONAL</small></span><input maxLength={240} value={classChoices} onChange={(event) => setClassChoices(event.target.value)} placeholder="Fighting style, expertise, or other choices" /></label><label className="form-field creator-tool"><span>Appearance or notes <small>OPTIONAL</small></span><input maxLength={140} value={appearance} onChange={(event) => setAppearance(event.target.value)} placeholder="A few words to help picture them" /></label></div>
      </>}

      {hasSpellStep && step === 3 && <><label className="toggle-row"><input type="checkbox" checked={chooseSpellsLater} onChange={(event) => { setChooseSpellsLater(event.target.checked); setError(""); }} />Choose spells later in the Spellbook</label>{!chooseSpellsLater && <StartingSpellPicker character={previewCharacter} selections={spellSelections} onChange={(value) => { setStartingSelections(value); setError(""); }} />}</>}
      {step === reviewStep && hasSpellStep && <div className="creator-section"><h3>Starting spells</h3>{chooseSpellsLater ? <p>No starting spells selected. Add them in the Spellbook.</p> : createStartingSpells(previewCharacter, spellSelections).map((spell) => <p key={spell.id}>{spell.name} · {spell.className}{spell.alwaysPrepared ? " · Always prepared" : spell.prepared ? " · Ready" : " · In spellbook"}</p>)}</div>}
      {step === reviewStep && <div className="creator-review"><div className="review-hero"><span className="review-avatar">{name.trim().charAt(0).toUpperCase() || "✦"}</span><div><h3>{name || "Unnamed Adventurer"}</h3><p>{species}{speciesChoice ? ` · ${speciesChoice}` : ""} · {background === "Custom" ? customBackground : background} · {calculated.classBreakdown.map((entry) => `${entry.name} ${entry.level}`).join(" / ")}</p>{concept && <p>{concept}</p>}</div></div><div className="review-stat-grid">{[["Armor Class", calculated.armorClass], ["Hit Points", calculated.maxHitPoints ?? "—"], ["Speed", `${calculated.speed} ft.`], ["Initiative", calculated.initiative >= 0 ? `+${calculated.initiative}` : calculated.initiative], ["Proficiency", `+${calculated.proficiencyBonus}`], ["Passive Perception", 10 + calculated.skillBonuses.Perception]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="creator-section"><h3>Ability scores</h3><div className="review-abilities">{ABILITIES.map((ability) => <span key={ability}>{ability.slice(0, 3).toUpperCase()} <strong>{abilityScores[ability]}</strong> ({Math.floor((abilityScores[ability] - 10) / 2) >= 0 ? "+" : ""}{Math.floor((abilityScores[ability] - 10) / 2)})</span>)}</div></div><div className="creator-section"><h3>Origin &amp; proficiencies</h3><p>{backgroundData ? `${backgroundData.feat} · ${backgroundData.skills.join(", ")} · ${toolProficiency || backgroundData.tool}` : "Custom origin"}</p><p>Class skills: {classSkills.join(", ") || "None chosen"}</p><p>Languages: {languages.join(", ")}</p><p>Background equipment: {backgroundData ? (equipmentChoice === "B" || equipmentChoice === "gold" ? backgroundData.equipmentB : backgroundData.equipmentA) : "Choose equipment with your DM."}</p><p>Class equipment: {classEquipmentSummary}</p>{classToolProficiency && <p>Class tool proficiency: {classToolProficiency}</p>}{classChoices && <p>Class choices: {classChoices}</p>}{speciesData && <p>{speciesData.note}</p>}{appearance && <p>{appearance}</p>}</div><div className="creator-section"><h3>Saving throws &amp; features</h3><p>Saving throw bonuses: {Object.entries(calculated.savingThrows).map(([ability, value]) => `${ability.slice(0, 3)} ${value >= 0 ? "+" : ""}${value}`).join(" · ")}</p><p>{calculated.classResources.map((resource) => resource.label).join(" · ") || "Class features are calculated on the sheet"}</p></div></div>}

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="form-cancel" type="button" onClick={step > 1 ? () => { setError(""); setStep((current) => current - 1); } : onCancel}>{step > 1 ? "Back" : "Cancel"}</button>{step < reviewStep ? <button key="next-step" className="primary-button" type="button" onClick={moveNext}>Continue <span>→</span></button> : <button key="save-character" className="primary-button" type="submit">{character ? "Save changes" : "Create character"}<span>✓</span></button>}</div>
    </form>
  </section>;
}








