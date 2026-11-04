import { useState, type FormEvent } from "react";
import type { Character, CharacterDraft } from "../data/characters";

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
  const [background, setBackground] = useState(character?.background ?? "");
  const [level, setLevel] = useState(String(character?.level ?? 1));
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const numericLevel = Number(level);

    if (!trimmedName) {
      setError("Give your character a name to continue.");
      return;
    }
    if (!Number.isInteger(numericLevel) || numericLevel < 1 || numericLevel > 20) {
      setError("Choose a character level from 1 to 20.");
      return;
    }

    setError("");
    onSave({
      name: trimmedName,
      concept: concept.trim(),
      species: species.trim(),
      characterClass: characterClass.trim(),
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
            <span>Class <small>OPTIONAL</small></span>
            <input name="class" maxLength={40} value={characterClass} onChange={(event) => setCharacterClass(event.target.value)} placeholder="Choose or type a class" />
          </label>
          <label className="form-field">
            <span>Background <small>OPTIONAL</small></span>
            <input name="background" maxLength={50} value={background} onChange={(event) => setBackground(event.target.value)} placeholder="Choose or type a background" />
          </label>
          <label className="form-field level-field">
            <span>Level <small>1–20</small></span>
            <input name="level" type="number" min={1} max={20} step={1} value={level} onChange={(event) => setLevel(event.target.value)} required />
          </label>
        </div>

        <p className="form-hint">Free text for now. We’ll add searchable 2024 character options and guided ability choices in the next pass.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="form-cancel" type="button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" type="submit">{character ? "Save changes" : "Save character"}<span>→</span></button>
        </div>
      </form>
    </section>
  );
}
