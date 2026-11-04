import { useState, type FormEvent } from "react";
import { CLASSES, defaultCharacterStats, type Character, type CharacterDraft } from "../data/characters";

type CharacterBuilderProps = {
  character?: Character;
  onSave: (draft: CharacterDraft) => void;
  onCancel: () => void;
};

export function CharacterBuilder({ character, onSave, onCancel }: CharacterBuilderProps) {
  const [name, setName] = useState(character?.name ?? "");
  const [concept, setConcept] = useState(character?.concept ?? "");
  const [species, setSpecies] = useState(character?.species ?? "");
  const [characterClass, setCharacterClass] = useState(character?.characterClass ?? "");
  const [subclass, setSubclass] = useState(character?.subclass ?? "");
  const [classLevels, setClassLevels] = useState<Record<string, number>>(() => {
    if (character?.classLevels && Object.keys(character.classLevels).length) return { ...character.classLevels };
    return character?.characterClass ? { [character.characterClass]: character.level } : {};
  });
  const [classSubclasses, setClassSubclasses] = useState<Record<string, string>>(() => character?.classSubclasses ?? (character?.characterClass && character.subclass ? { [character.characterClass]: character.subclass } : {}));
  const [background, setBackground] = useState(character?.background ?? "");
  const [level, setLevel] = useState(String(character?.level ?? 1));
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const normalizedLevels = Object.fromEntries(Object.entries(classLevels).filter(([name, value]) => name.trim() && value > 0));
    if (characterClass && !normalizedLevels[characterClass]) normalizedLevels[characterClass] = Number(level);
    const numericLevel = Object.values(normalizedLevels).reduce((sum, value) => sum + value, 0) || Number(level);

    if (!trimmedName) {
      setError("Give your character a name to continue.");
      return;
    }
    if (!Number.isInteger(numericLevel) || numericLevel < 1 || numericLevel > 20 || Object.values(normalizedLevels).some((value) => !Number.isInteger(value) || value < 1 || value > 20)) {
      setError("Combined class levels must total 1–20; each class level must also be 1–20.");
      return;
    }

    setError("");
    onSave({
      ...defaultCharacterStats(),
      ...(character ? {
        abilityScores: character.abilityScores,
        savingThrowProficiencies: character.savingThrowProficiencies,
        skillProficiencies: character.skillProficiencies,
        resourceUses: character.resourceUses,
        size: character.size,
        speedFeet: character.speedFeet,
        otherSpeedBonus: character.otherSpeedBonus,
        powerfulBuild: character.powerfulBuild,
        armorMode: character.armorMode,
        armorBaseAC: character.armorBaseAC,
        hasShield: character.hasShield,
        otherAcBonus: character.otherAcBonus,
        armorStrengthRequirement: character.armorStrengthRequirement,
        unarmoredDefenseChoice: character.unarmoredDefenseChoice,
        spellcastingAbility: character.spellcastingAbility,
      } : {}),
      name: trimmedName,
      concept: concept.trim(),
      species: species.trim(),
      characterClass: characterClass.trim(),
      subclass: subclass.trim(),
      classLevels: normalizedLevels,
      classSubclasses: { ...classSubclasses, ...(characterClass ? { [characterClass]: subclass.trim() } : {}) },
      background: background.trim(),
      level: numericLevel,
    });
  }

  return (
    <section className="builder-screen" aria-labelledby="builder-title">
      <div className="builder-progress">
        <span className="progress-current"><i>1</i> CHARACTER BASICS</span>
        <span><i>2</i> ABILITIES &amp; SKILLS</span>
        <span><i>3</i> REVIEW SHEET</span>
      </div>

      <form className="character-form" onSubmit={handleSubmit}>
        <div className="form-heading">
          <div>
            <p className="eyebrow">{character ? "UPDATE YOUR HERO" : "LET’S MEET YOUR HERO"}</p>
            <h2 id="builder-title">Start with the basics</h2>
            <p>These details are easy to change as your character takes shape.</p>
          </div>
          <span className="form-spark" aria-hidden="true">✧</span>
        </div>

        <div className="form-grid">
          <label className="form-field form-field-wide">
            <span>Character name <b>REQUIRED</b></span>
            <input autoFocus name="name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Bramble Underbough" required />
          </label>
          <label className="form-field form-field-wide">
            <span>Character idea <small>OPTIONAL</small></span>
            <input name="concept" maxLength={100} value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="A cheerful treasure hunter with a mysterious map" />
          </label>
          <label className="form-field">
            <span>Species <small>OPTIONAL</small></span>
            <input name="species" maxLength={40} value={species} onChange={(event) => setSpecies(event.target.value)} placeholder="Choose or type a species" />
          </label>
          <label className="form-field">
            <span>Starting class <small>OPTIONAL</small></span>
            <select name="class" value={characterClass} onChange={(event) => {
              const next = event.target.value;
              setClassLevels((previous) => { const updated = { ...previous }; delete updated[characterClass]; if (next) updated[next] = Number(level) || 1; return updated; });
              setCharacterClass(next);
              setSubclass(classSubclasses[next] ?? "");
            }}>
              <option value="">Choose a class</option>
              {CLASSES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>{characterClass || "Starting class"} subclass <small>OPTIONAL</small></span>
            <input name="subclass" maxLength={50} value={subclass} onChange={(event) => { setSubclass(event.target.value); if (characterClass) setClassSubclasses((previous) => ({ ...previous, [characterClass]: event.target.value })); }} placeholder="Choose at level 3" />
          </label>
          <label className="form-field">
            <span>Background <small>OPTIONAL</small></span>
            <input name="background" maxLength={50} value={background} onChange={(event) => setBackground(event.target.value)} placeholder="Choose or type a background" />
          </label>
          <label className="form-field level-field">
            <span>{characterClass || "Starting class"} level <small>1–20</small></span>
            <input name="level" type="number" min={1} max={20} step={1} value={classLevels[characterClass] ?? level} onChange={(event) => {
              setLevel(event.target.value);
              if (characterClass) setClassLevels((previous) => ({ ...previous, [characterClass]: Number(event.target.value) || 1 }));
            }} required />
          </label>
          {Object.entries(classLevels).filter(([name]) => name !== characterClass).map(([name, classLevel]) => <div className="form-field multiclass-row" key={name}>
            <span>{name} class level</span>
            <div className="multiclass-controls">
              <input aria-label={`${name} class level`} type="number" min={1} max={20} value={classLevel} onChange={(event) => setClassLevels((previous) => ({ ...previous, [name]: Number(event.target.value) || 1 }))} />
              <input aria-label={`${name} subclass`} placeholder="Subclass (optional)" value={classSubclasses[name] ?? ""} onChange={(event) => setClassSubclasses((previous) => ({ ...previous, [name]: event.target.value }))} />
              <button type="button" className="text-button" onClick={() => { setClassLevels((previous) => { const updated = { ...previous }; delete updated[name]; return updated; }); setClassSubclasses((previous) => { const updated = { ...previous }; delete updated[name]; return updated; }); }}>Remove</button>
            </div>
          </div>)}
          <div className="form-field">
            <span>Multiclass <small>OPTIONAL</small></span>
            <select value="" disabled={!characterClass} onChange={(event) => { const name = event.target.value; if (name) setClassLevels((previous) => previous[name] ? previous : { ...previous, [name]: 1 }); }}>
              <option value="">Add a class…</option>
              {CLASSES.filter((option) => option !== characterClass && !classLevels[option]).map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
        </div>

        <p className="form-hint">Total character level: {Object.values(classLevels).reduce((sum, value) => sum + value, characterClass && !classLevels[characterClass] ? Number(level) || 1 : 0) || Number(level) || 1} / 20. Your ability scores start as temporary placeholders; derived stats update as you go. Skill and other class proficiencies can be marked on the Abilities &amp; skills page.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="form-cancel" type="button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" type="submit">{character ? "Save changes" : "Save character"}<span>→</span></button>
        </div>
      </form>
    </section>
  );
}
