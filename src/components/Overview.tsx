import { useRef } from "react";
import type { Character } from "../data/characters";

type OverviewProps = {
  characters: Character[];
  selectedCharacterId: string | null;
  onCreate: () => void;
  onExplore: () => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (character: Character) => void;
  onExportAll: () => void;
  onImport: (contents: string) => void;
  backupMessage: string;
};

export function Overview({ characters, selectedCharacterId, onCreate, onExplore, onSelect, onEdit, onDelete, onExport, onExportAll, onImport, backupMessage }: OverviewProps) {
  const backupInput = useRef<HTMLInputElement>(null);
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? characters[0];

  return (
    <>
      <section className="featured-card" aria-labelledby="first-hero-title">
        <div className="featured-art" aria-hidden="true">
          <div className="moon" />
          <div className="mountain mountain-back" />
          <div className="mountain mountain-front" />
          <div className="art-rune">✧</div>
        </div>
        <div className="featured-info">
          <div className="feature-heading">
            <div>
              {selectedCharacter && <p className="character-kicker">ACTIVE CHARACTER</p>}
              <h2 id="first-hero-title">{selectedCharacter?.name ?? "Create a character"}</h2>
            </div>
            <span className="level-seal" aria-label={selectedCharacter ? `Level ${selectedCharacter.level}` : "A new adventure"}>{selectedCharacter ? selectedCharacter.level : "✦"}</span>
          </div>
          <p className="feature-description">
            {selectedCharacter
              ? [selectedCharacter.concept, [selectedCharacter.species, selectedCharacter.characterClass, selectedCharacter.background].filter(Boolean).join(" · ")].filter(Boolean).join(" — ") || "No character details yet."
              : "Choose a class, species, and background in the character builder."}
          </p>
          <div className="feature-meta">
            {selectedCharacter ? <><span><i className="meta-icon">⚔</i> {selectedCharacter.characterClass || "Class not chosen"}</span><span><i className="meta-icon">◷</i> Level {selectedCharacter.level}</span></> : <span><i className="meta-icon">⚔</i> 2024 rules</span>}
          </div>
          <div className="feature-actions">
            {selectedCharacter ? <>
              <button className="primary-button" onClick={onExplore}>Open character sheet <span>→</span></button>
              <button className="text-button" onClick={() => onEdit(selectedCharacter.id)}>Edit basics <span>↗</span></button>
            </> : <>
              <button className="primary-button" onClick={onCreate}>Start character builder <span>→</span></button>
              <button className="text-button" onClick={onExplore}>Explore the sheet <span>↗</span></button>
            </>}
          </div>
        </div>
      </section>

      <section className="collection-section" aria-labelledby="collection-title">
        <div className="section-title-row">
          <div>
            <h2 id="collection-title">Characters <span className="count-chip">{characters.length}</span></h2>
          </div>
          <div className="backup-actions">
            {characters.length > 0 && <span className="sort-label">Saved on this device</span>}
            <button className="backup-button" onClick={() => backupInput.current?.click()}>Import backup</button>
            <button className="backup-button" onClick={onExportAll} disabled={characters.length === 0}>Export library</button>
            <input ref={backupInput} className="backup-file-input" type="file" accept=".json,application/json" aria-label="Choose a TaleForge backup file" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void file.text().then(onImport).catch(() => onImport(""));
              event.target.value = "";
            }} />
          </div>
        </div>
        {backupMessage && <p className="backup-message" role="status">{backupMessage}</p>}
        {characters.length === 0 ? (
          <button className="empty-card" onClick={onCreate}>
            <span className="empty-icon" aria-hidden="true">＋</span>
            <span className="empty-title">Your character roster is empty</span>
            <span className="empty-caption">Create a character to see them here.</span>
            <span className="empty-link">Make your first character <b>→</b></span>
          </button>
        ) : (
          <div className="character-roster">
            {characters.map((character) => (
              <article className={`character-roster-card ${character.id === selectedCharacter?.id ? "selected" : ""}`} key={character.id}>
                <button className="roster-select" onClick={() => onSelect(character.id)} aria-pressed={character.id === selectedCharacter?.id}>
                  <span className="roster-avatar" aria-hidden="true">{character.name.charAt(0).toUpperCase()}</span>
                  <span className="roster-copy"><strong>{character.name}</strong><span>{[character.species, character.characterClass, character.background].filter(Boolean).join(" · ") || "New adventurer"}</span></span>
                  <span className="roster-level">LV {character.level}</span>
                </button>
                <div className="roster-actions">
                  <button onClick={() => onEdit(character.id)} aria-label={`Edit ${character.name}`}>Edit</button>
                  <button onClick={() => onExport(character)} aria-label={`Export ${character.name}`}>Export</button>
                  <button onClick={() => onDelete(character.id)} aria-label={`Delete ${character.name}`}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="quick-links">
        <div className="quick-copy">
          <span className="quick-spark" aria-hidden="true">✧</span>
          <div><strong>Your sheets stay on this device</strong><span>Local saves are automatic in this browser. Use LAN party to share selected sheets with your group.</span></div>
        </div>
        <button onClick={onCreate}>Create another <span>→</span></button>
      </section>
    </>
  );
}

